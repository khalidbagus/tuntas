import { MAX_TEXT } from "./domain.js";
export async function extract(blob, mime) {
  if (mime === "text/plain") return { text: await blob.text(), partial: false };
  if (mime.startsWith("image/")) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      if (bitmap.width * bitmap.height > 24_000_000) throw Error();
    } catch {
      throw Error("Image could not be read or exceeds 24 megapixels.");
    } finally {
      bitmap?.close();
    }
    return { text: "", image: true, partial: false };
  }
  const pdfjs = await import("pdfjs-dist"),
    worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    isEvalSupported: false,
    useSystemFonts: false,
    stopAtErrors: true,
  });
  try {
    const pdf = await task.promise,
      parts = [];
    let partial = pdf.numPages > 8;
    for (let i = 1; i <= Math.min(8, pdf.numPages); i++) {
      const page = await pdf.getPage(i),
        content = await page.getTextContent();
      const str = content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
        .join("")
        .trim();
      if (!str) partial = true;
      parts.push(str);
      page.cleanup();
      if (parts.join("\n").length > MAX_TEXT) {
        partial = true;
        break;
      }
    }
    const text = parts.join("\n").trim().slice(0, MAX_TEXT);
    if (!text)
      throw Error(
        "This PDF has no readable text layer. Save it manually or capture a page as a photo.",
      );
    return { text, partial };
  } catch (e) {
    if (e.message.startsWith("This PDF")) throw e;
    throw Error(
      "This PDF could not be read. It may be damaged or password-protected.",
    );
  } finally {
    await task.destroy();
  }
}

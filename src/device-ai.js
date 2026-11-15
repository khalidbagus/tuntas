// API presence is a capability hint. Model initialization can still fail.
export function supportsDeviceAI(api = globalThis.LanguageModel) {
  return (
    typeof api?.availability === "function" && typeof api?.create === "function"
  );
}

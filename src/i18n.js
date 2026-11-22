export const DEFAULT_LANG = "en";
export const LANG_STORAGE_KEY = "tuntas-lang";
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
];

export function normalizeLang(value) {
  return value === "id" ? "id" : DEFAULT_LANG;
}

export function loadLang(storage = globalThis.localStorage) {
  try {
    return normalizeLang(storage?.getItem?.(LANG_STORAGE_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function saveLang(lang, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(LANG_STORAGE_KEY, normalizeLang(lang));
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}

export function localeFor(lang) {
  return normalizeLang(lang) === "id" ? "id-ID" : "en-US";
}

export function formatDate(timestamp, lang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

const categoryLabels = {
  "Money & Bills": "Keuangan & Tagihan",
  "Home & Living": "Rumah & Tempat Tinggal",
  "Work & Study": "Kerja & Studi",
  Purchases: "Belanja",
  "Personal Records": "Dokumen Pribadi",
  Other: "Lainnya",
};

export function translateCategory(category, lang) {
  if (normalizeLang(lang) !== "id") return category;
  return categoryLabels[category] || category;
}

const modeLabels = {
  "Local rules": "Aturan lokal",
  "Manual filing": "Pengarsipan manual",
  "Not analyzed": "Belum dianalisis",
  "Firebase · on device": "Firebase · di perangkat",
  "Firebase · cloud": "Firebase · cloud",
  "Firebase · source unreported": "Firebase · sumber tidak dilaporkan",
  "Firebase · unsuccessful": "Firebase · gagal",
  "Synthetic sample · seeded example": "Contoh sintetis · data awal",
  "Redacted receipt sample · fields entered manually":
    "Sampel struk disensor · kolom diisi manual",
  "Photographed receipt · sample fields entered manually":
    "Foto struk · kolom contoh diisi manual",
};

export function translateMode(mode, lang) {
  if (normalizeLang(lang) !== "id") return mode;
  return modeLabels[mode] || mode;
}

const runtimeMessages = {
  "Saving original": "Menyimpan dokumen asli",
  "Reading original": "Membaca dokumen asli",
  "Waiting for Firebase AI": "Menunggu Firebase AI",
  "Checking local filing rules": "Memeriksa aturan pengarsipan lokal",
  "This image needs a visual review. Local rules do not read images.":
    "Gambar ini perlu tinjauan visual. Aturan lokal tidak membaca gambar.",
  "This PDF has no readable text layer. Save it manually or capture a page as a photo.":
    "PDF ini tidak memiliki lapisan teks yang dapat dibaca. Simpan secara manual atau potret halaman sebagai foto.",
  "This PDF could not be read. It may be damaged or password-protected.":
    "PDF ini tidak dapat dibaca. File mungkin rusak atau dilindungi kata sandi.",
  "Image could not be read or exceeds 24 megapixels.":
    "Gambar tidak dapat dibaca atau melebihi 24 megapiksel.",
  "Choose a nonempty file up to 8 MB.":
    "Pilih file yang tidak kosong hingga 8 MB.",
  "Choose a PDF, JPEG or PNG with a matching file format.":
    "Pilih file PDF, JPEG, atau PNG dengan format yang sesuai.",
  "Paste between 1 and 16,000 characters.":
    "Tempel antara 1 hingga 16.000 karakter.",
  "Analysis timed out.": "Analisis melebihi batas waktu.",
  "The on-device model is unavailable. Retry in supported Chrome or file manually.":
    "Model di perangkat tidak tersedia. Coba lagi di Chrome yang didukung atau arsipkan manual.",
  "AI analysis did not finish with a usable result. Retry or file manually.":
    "Analisis AI tidak selesai dengan hasil yang dapat digunakan. Coba lagi atau arsipkan manual.",
  "AI analysis did not finish with a usable result. Retry, choose local rules, or file manually.":
    "Analisis AI tidak selesai dengan hasil yang dapat digunakan. Coba lagi, pilih aturan lokal, atau arsipkan manual.",
  "Check the reading against the original image.":
    "Periksa hasil pembacaan terhadap gambar asli.",
  "Only part of the original was analyzed.":
    "Hanya sebagian dari dokumen asli yang dianalisis.",
  "An unsupported field was omitted.":
    "Kolom yang tidak didukung telah dilewati.",
  "Check the suggested category.": "Periksa kategori yang disarankan.",
  "Filing undone. Choose a category when you’re ready.":
    "Pengarsipan dibatalkan. Pilih kategori saat Anda siap.",
  "Two plausible dates appear in the notice (18 December 2026 autopay draft and 28 December 2026 payment due date). Check the original before filing or setting a due date.":
    "Ada dua tanggal yang masuk akal pada pemberitahuan ini (penarikan otomatis 18 Desember 2026 dan jatuh tempo pembayaran 28 Desember 2026). Periksa dokumen asli sebelum mengarsipkan atau menetapkan tenggat.",
  "This browser workspace is full (300 documents).":
    "Ruang kerja browser ini penuh (300 dokumen).",
  "Firebase initialization failed.": "Inisialisasi Firebase gagal.",
  "Model response too large.": "Respons model terlalu besar.",
  "The classification could not be validated.":
    "Klasifikasi tidak dapat divalidasi.",
  "Invalid extracted field.": "Kolom hasil ekstraksi tidak valid.",
  "Document not found.": "Dokumen tidak ditemukan.",
  "Give your action a short title.": "Beri tindakan Anda judul singkat.",
  "The source is missing.": "Dokumen sumber tidak ditemukan.",
  "Image read failed.": "Pembacaan gambar gagal.",
  "Browser storage is unavailable. Allow site storage and reload.":
    "Penyimpanan browser tidak tersedia. Izinkan penyimpanan situs lalu muat ulang.",
  "Firebase AI could not load. You can use local rules.":
    "Firebase AI gagal dimuat. Anda dapat menggunakan aturan lokal.",
  "Choose an available processing method first.":
    "Pilih metode pemrosesan yang tersedia terlebih dahulu.",
  "Already captured. Opened the existing original.":
    "Sudah pernah disimpan. Membuka dokumen asli yang ada.",
  "Filed in Library. You can undo this filing.":
    "Terarsip di Pustaka. Anda dapat membatalkan pengarsipan ini.",
  "Original saved. Processing needs attention.":
    "Dokumen asli tersimpan. Pemrosesan perlu perhatian.",
  "Original saved. Check the suggested details.":
    "Dokumen asli tersimpan. Periksa detail yang disarankan.",
  "Storage is full. Your document could not be saved.":
    "Penyimpanan penuh. Dokumen Anda tidak dapat disimpan.",
  "Could not save the document.": "Dokumen tidak dapat disimpan.",
  "The change could not be saved. Try again.":
    "Perubahan tidak dapat disimpan. Coba lagi.",
  "Filing saved.": "Pengarsipan disimpan.",
  "Moved to Inbox. Original kept.":
    "Dipindahkan ke Kotak Masuk. Dokumen asli tetap disimpan.",
  "Added to Actions.": "Ditambahkan ke Tindakan.",
  "Follow-up already saved in Actions.":
    "Tindak lanjut sudah tersimpan di Tindakan.",
  "Follow-up draft dismissed.": "Draf tindak lanjut diabaikan.",
};

export function translateRuntimeMessage(message, lang) {
  if (normalizeLang(lang) !== "id" || typeof message !== "string") {
    return message;
  }
  return runtimeMessages[message] || message;
}

const messages = {
  en: {
    skipToContent: "Skip to content",
    mainNav: "Main",
    mobileNav: "Mobile navigation",
    languageLabel: "Language",
    workspace: "Workspace",
    sampleWorkspace: "Sample workspace",
    localWorkspace: "Local workspace",
    thisBrowserOnly: "This browser only",
    sampleDataIsolated: "Sample data · isolated",
    searchLibrary: "Search library",
    searchShortcutHint: "Ctrl K",
    exitDemo: "Exit demo",
    demoBannerDefault:
      "Synthetic and redacted sample records stored separately from your personal workspace.",
    demoBannerLocalReceipts:
      "Includes private receipt photos stored in this browser’s sample workspace.",
    offlineNote:
      "Offline · Your local workspace is still available in this tab.",
    dismissMessage: "Dismiss message",
    openingWorkspace: "Opening workspace…",
    workspaceUnavailable: "Workspace unavailable.",
    pageNotFound: "Page not found",
    backToHome: "Back to Home",
    navHome: "Home",
    navInbox: "Inbox",
    navLibrary: "Library",
    navActions: "Actions",
    navCapture: "Capture",
    pageCapture: "Capture",
    pageDocument: "Document",
    pageFallback: "Page",
    appTitleSuffix: "Tuntas ✦",
    personalWorkspace: "Personal workspace",
    homeTitlePrefix: "Life, sorted",
    homeDescription:
      "A home for your paperwork, from the first scan to the next step.",
    documentIntake: "Document intake",
    captureDocumentTitle: "Capture a document",
    captureDocumentSubtitle: "Drop a file here, or choose how to add it.",
    uploadFile: "Upload file",
    scan: "Scan",
    pasteText: "Paste text",
    acceptedFilesShort: "PDF, JPEG or PNG · Up to 8 MB",
    liveAiOption: "Live AI option",
    sampleNotice: "Sample notice",
    optInIndex: "OPT-IN",
    sampleIndex: "01 / 01",
    tryFreshInput: "Try a fresh input",
    householdRenewal: "Household renewal",
    seededNoAi: "Seeded records make no AI calls",
    syntheticLocalRules: "Synthetic sample · local rules",
    openCapture: "Open Capture",
    trySample: "Try sample",
    recentDocuments: "Recent documents",
    viewLibrary: "View library",
    emptyFirstDocTitle: "Your first document goes here.",
    emptyFirstDocBody:
      "Capture your own, try the sample notice above, or explore a pre-filled synthetic workspace.",
    exploreDemo: "Explore demo",
    workspaceOverview: "Workspace overview",
    exploreThisWorkspace: "Explore this workspace",
    documentCaptureSection: "Document capture",
    readyForReview: "Ready for review",
    nothingToReview: "Nothing to review",
    filedDocuments: "Filed documents",
    noFiledDocuments: "No filed documents",
    openFollowUps: "Open follow-ups",
    noOpenFollowUps: "No open follow-ups",
    statusFiled: "Filed",
    statusNeedsAttention: "Needs attention",
    statusReview: "Review",
    sourceRedactedSample: "Redacted receipt sample",
    sourcePhotoSample: "Photographed sample",
    sourceSyntheticSample: "Synthetic sample",
    libraryKicker: "Document archive",
    libraryDescription:
      "Find a document by its title, category, or words inside.",
    searchDocumentsLabel: "Search documents",
    searchDocumentsPlaceholder: "Search documents…",
    filterByCategoryLabel: "Filter by category",
    allCategories: "All categories",
    searchResultsHeading: "Search results",
    filedDocumentsHeading: "Filed documents",
    documentCount: ({ n }) => (n === 1 ? "1 document" : `${n} documents`),
    noMatchingDocuments: "No matching documents",
    libraryReady: "Your library is ready.",
    clearSearchFilters: "Clear search and filters",
    captureFirstDocument: "Capture your first document",
    inboxKicker: "Review queue",
    inboxDescription: "Only documents that need a decision land here.",
    inboxCaughtUpTitle: "You’re all caught up.",
    inboxCaughtUpBody: "Confident matches go straight to your Library.",
    actionsKicker: "Follow-ups",
    actionsDescription:
      "Small next steps, each linked to its source document.",
    noActionsTitle: "No actions yet.",
    noActionsPrefix: "Open a document in your",
    noActionsSuffix: "to add a follow-up.",
    completedHeading: "Completed",
    openHeading: "Open",
    reopenAction: ({ title }) => `Reopen ${title}`,
    completeAction: ({ title }) => `Complete ${title}`,
    duePrefix: ({ date }) => `Due ${date}`,
    openSource: "Open source",
    noCompletedActions: "No completed actions.",
    noOpenActions: "No open actions.",
    processingMethod: "Processing method",
    modeRules: "Local filing rules · no AI",
    modeDevice: "Firebase AI · device only",
    modeHybrid: "Firebase AI · prefer device, allow cloud",
    payloadImage: "the captured image",
    payloadText: "the pasted text",
    payloadPdf: "the extracted PDF text",
    payloadFallback: "the extracted text or image",
    onDeviceUnavailableHint:
      "On-device AI is unavailable in this browser. Cloud analysis requires your permission.",
    cloudConsentLabel: ({ payload }) =>
      `For this document, allow Firebase to send ${payload} to Google’s cloud model if needed.`,
    deviceOnlyHint:
      "Requires a supported Chrome device. A model download may be needed. No document is sent to the cloud.",
    rulesConnectedHint:
      "Uses simple text matches in this browser. No AI request.",
    rulesDisconnectedHint:
      "Firebase AI is not connected. Text-based filing rules run in this browser.",
    captureDescription: "Bring the original. Tuntas will help with the filing.",
    documentTextLabel: "Document text",
    documentTextPlaceholder: "Paste a receipt, bill or note…",
    capturePagePrompt: "Capture a page",
    dropDocumentHere: "Drop your document here",
    cameraSubtext: "Use the camera on supported devices, or choose a photo.",
    fileSubtext: "PDF, JPEG or PNG · 8 MB maximum",
    selectOriginalFile: "Select original file",
    chooseAnother: "Choose another",
    openCameraOrPhotos: "Open camera or photos",
    browseFiles: "Browse files",
    consentHintCapture:
      "Confirm cloud permission above to continue, or switch to Local filing rules.",
    saveAndOrganize: "Save & organize",
    privacyFootnote: "Original stays in this browser profile.",
    originalDocumentSummary: "Original document",
    originalCapturedAlt: "Original captured document",
    imagePreviewUnavailable:
      "Image preview is unavailable. Download the original file to inspect it.",
    downloadPdfFallback: "Download the original PDF to inspect it.",
    downloadOriginal: "Download original",
    kickerRedactedSample: "Redacted receipt sample · Document",
    kickerPhotoSample: "Photographed sample · Document",
    kickerSyntheticSample: "Synthetic sample · Document",
    kickerDocumentRecord: "Document record",
    addedDate: ({ name, date }) => `${name} · Added ${date}`,
    statusFiledInLibrary: "Filed in Library",
    statusNeedsReview: "Needs review",
    interruptedFallback:
      "Processing was interrupted. Retry or file the original manually.",
    checkBeforeFiling: "Check the details before filing.",
    consentHintRetry:
      "Confirm cloud permission above to retry with AI, or file manually below.",
    retryProcessing: "Retry processing",
    documentTitleLabel: "Document title",
    primaryCategoryLabel: "Primary category",
    tagsLabel: "Tags",
    tagsOptional: "(optional, comma separated)",
    sourceExcerpt: ({ quote }) => `Source excerpt: ${quote}`,
    fileWithoutAi: "File without AI",
    saveChanges: "Save changes",
    confirmAndFile: "Confirm & file",
    cancel: "Cancel",
    filingDetails: "Filing details",
    editDetails: "Edit details",
    categoryLabel: "Category",
    editedSuffix: " · edited",
    sourcePrefix: ({ quote }) => `Source: ${quote}`,
    filingEvidence: "Filing evidence",
    proposedSentenceStart: ({ mode }) => `${mode} proposed `,
    proposedBasedOn: ({ evidence }) => ` based on “${evidence}”.`,
    currentFilingConfirmed: "Current filing confirmed by you.",
    suggestedFollowUp: "Suggested follow-up",
    modelReadChip: "Model-read · compare with original",
    sourceExcerptChip: "Source excerpt",
    savedInActions: "Saved in Actions",
    confirmedActionSummary: ({ title, due }) =>
      `Confirmed: ${title}${due ? ` · Due ${due}` : ""}`,
    draftVisualReview: ({ title, due }) =>
      `Draft: ${title}${due ? ` · Suggested due date: ${due}` : ""} · Model-read from photo; compare with the original image below before confirming.`,
    draftWithDue: ({ title, due }) =>
      `Draft: ${title} · Suggested due date: ${due}`,
    draftWithoutDue: ({ title }) =>
      `Draft: ${title} · No clear calendar date in the quote — leave blank or enter one when confirming.`,
    openInActions: "Open in Actions",
    addFollowUp: "Add follow-up",
    compareWithOriginal: "Compare with original",
    dismiss: "Dismiss",
    addAnAction: "Add an action",
    undoFiling: "Undo filing",
    actionTitleLabel: "Action title",
    dueDateLabel: "Due date",
    optionalParen: "(optional)",
    createAction: "Create action",
    noticeStorageUnavailable:
      "Browser storage is unavailable. Allow site storage and reload.",
    noticeFirebaseLoadFailed:
      "Firebase AI could not load. You can use local rules.",
    noticeChooseMethod: "Choose an available processing method first.",
    noticeDuplicate: "Already captured. Opened the existing original.",
    noticeFiledWithUndo: "Filed in Library. You can undo this filing.",
    noticeSavedNeedsAttention: "Original saved. Processing needs attention.",
    noticeSavedCheckDetails: "Original saved. Check the suggested details.",
    noticeQuotaFull: "Storage is full. Your document could not be saved.",
    noticeCouldNotSaveDoc: "Could not save the document.",
    noticeCouldNotSaveChange: "The change could not be saved. Try again.",
    noticeFilingSaved: "Filing saved.",
    noticeMovedToInbox: "Moved to Inbox. Original kept.",
    noticeAddedToActions: "Added to Actions.",
    noticeFollowUpAlreadySaved: "Follow-up already saved in Actions.",
    noticeFollowUpDismissed: "Follow-up draft dismissed.",
  },
  id: {
    skipToContent: "Lewati ke konten",
    mainNav: "Navigasi utama",
    mobileNav: "Navigasi seluler",
    languageLabel: "Bahasa",
    workspace: "Ruang kerja",
    sampleWorkspace: "Ruang kerja sampel",
    localWorkspace: "Ruang kerja lokal",
    thisBrowserOnly: "Hanya di browser ini",
    sampleDataIsolated: "Data sampel · terpisah",
    searchLibrary: "Cari pustaka",
    searchShortcutHint: "Ctrl K",
    exitDemo: "Keluar demo",
    demoBannerDefault:
      "Catatan sintetis dan tersensor disimpan terpisah dari ruang kerja pribadi Anda.",
    demoBannerLocalReceipts:
      "Berisi foto struk pribadi yang disimpan di ruang kerja sampel browser ini.",
    offlineNote:
      "Offline · Ruang kerja lokal Anda tetap tersedia di tab ini.",
    dismissMessage: "Tutup pesan",
    openingWorkspace: "Membuka ruang kerja…",
    workspaceUnavailable: "Ruang kerja tidak tersedia.",
    pageNotFound: "Halaman tidak ditemukan",
    backToHome: "Kembali ke Beranda",
    navHome: "Beranda",
    navInbox: "Kotak Masuk",
    navLibrary: "Pustaka",
    navActions: "Tindakan",
    navCapture: "Tangkap",
    pageCapture: "Tangkap",
    pageDocument: "Dokumen",
    pageFallback: "Halaman",
    appTitleSuffix: "Tuntas ✦",
    personalWorkspace: "Ruang kerja pribadi",
    homeTitlePrefix: "Tertata rapi",
    homeDescription:
      "Rumah untuk dokumen Anda, dari pemindaian awal hingga langkah berikutnya.",
    documentIntake: "Masukan dokumen",
    captureDocumentTitle: "Tangkap dokumen",
    captureDocumentSubtitle:
      "Seret file ke sini, atau pilih cara menambahkannya.",
    uploadFile: "Unggah file",
    scan: "Pindai",
    pasteText: "Tempel teks",
    acceptedFilesShort: "PDF, JPEG, atau PNG · Maks. 8 MB",
    liveAiOption: "Opsi AI langsung",
    sampleNotice: "Contoh pemberitahuan",
    optInIndex: "OPSIONAL",
    sampleIndex: "01 / 01",
    tryFreshInput: "Coba masukan baru",
    householdRenewal: "Perpanjangan rumah tangga",
    seededNoAi: "Data awal tidak memanggil AI",
    syntheticLocalRules: "Sampel sintetis · aturan lokal",
    openCapture: "Buka Tangkap",
    trySample: "Coba sampel",
    recentDocuments: "Dokumen terbaru",
    viewLibrary: "Lihat pustaka",
    emptyFirstDocTitle: "Dokumen pertama Anda muncul di sini.",
    emptyFirstDocBody:
      "Tangkap dokumen Anda, coba pemberitahuan sampel di atas, atau jelajahi ruang kerja sintetis.",
    exploreDemo: "Jelajahi demo",
    workspaceOverview: "Ringkasan ruang kerja",
    exploreThisWorkspace: "Jelajahi ruang kerja ini",
    documentCaptureSection: "Pengambilan dokumen",
    readyForReview: "Siap ditinjau",
    nothingToReview: "Tidak ada yang perlu ditinjau",
    filedDocuments: "Dokumen terarsip",
    noFiledDocuments: "Belum ada dokumen terarsip",
    openFollowUps: "Tindak lanjut terbuka",
    noOpenFollowUps: "Tidak ada tindak lanjut terbuka",
    statusFiled: "Terarsip",
    statusNeedsAttention: "Perlu perhatian",
    statusReview: "Tinjau",
    sourceRedactedSample: "Sampel struk disensor",
    sourcePhotoSample: "Sampel foto",
    sourceSyntheticSample: "Sampel sintetis",
    libraryKicker: "Arsip dokumen",
    libraryDescription:
      "Temukan dokumen berdasarkan judul, kategori, atau kata di dalamnya.",
    searchDocumentsLabel: "Cari dokumen",
    searchDocumentsPlaceholder: "Cari dokumen…",
    filterByCategoryLabel: "Filter berdasarkan kategori",
    allCategories: "Semua kategori",
    searchResultsHeading: "Hasil pencarian",
    filedDocumentsHeading: "Dokumen terarsip",
    documentCount: ({ n }) => `${n} dokumen`,
    noMatchingDocuments: "Tidak ada dokumen yang cocok",
    libraryReady: "Pustaka Anda siap.",
    clearSearchFilters: "Hapus pencarian dan filter",
    captureFirstDocument: "Tangkap dokumen pertama Anda",
    inboxKicker: "Antrean tinjauan",
    inboxDescription:
      "Hanya dokumen yang membutuhkan keputusan yang masuk ke sini.",
    inboxCaughtUpTitle: "Semua sudah tertangani.",
    inboxCaughtUpBody: "Kecocokan yang pasti langsung masuk ke Pustaka Anda.",
    actionsKicker: "Tindak lanjut",
    actionsDescription:
      "Langkah kecil berikutnya, masing-masing tertaut ke dokumen sumbernya.",
    noActionsTitle: "Belum ada tindakan.",
    noActionsPrefix: "Buka dokumen di",
    noActionsSuffix: "untuk menambahkan tindak lanjut.",
    completedHeading: "Selesai",
    openHeading: "Terbuka",
    reopenAction: ({ title }) => `Buka kembali ${title}`,
    completeAction: ({ title }) => `Selesaikan ${title}`,
    duePrefix: ({ date }) => `Tenggat ${date}`,
    openSource: "Buka sumber",
    noCompletedActions: "Belum ada tindakan selesai.",
    noOpenActions: "Tidak ada tindakan terbuka.",
    processingMethod: "Metode pemrosesan",
    modeRules: "Aturan pengarsipan lokal · tanpa AI",
    modeDevice: "Firebase AI · khusus perangkat",
    modeHybrid: "Firebase AI · utamakan perangkat, izinkan cloud",
    payloadImage: "gambar yang ditangkap",
    payloadText: "teks yang ditempel",
    payloadPdf: "teks PDF yang diekstrak",
    payloadFallback: "teks atau gambar yang diekstrak",
    onDeviceUnavailableHint:
      "AI di perangkat tidak tersedia di browser ini. Analisis cloud memerlukan izin Anda.",
    cloudConsentLabel: ({ payload }) =>
      `Untuk dokumen ini, izinkan Firebase mengirim ${payload} ke model cloud Google jika diperlukan.`,
    deviceOnlyHint:
      "Memerlukan perangkat Chrome yang didukung. Unduhan model mungkin diperlukan. Dokumen tidak dikirim ke cloud.",
    rulesConnectedHint:
      "Menggunakan pencocokan teks sederhana di browser ini. Tanpa permintaan AI.",
    rulesDisconnectedHint:
      "Firebase AI tidak terhubung. Aturan pengarsipan berbasis teks berjalan di browser ini.",
    captureDescription:
      "Bawa dokumen aslinya. Tuntas akan membantu pengarsipannya.",
    documentTextLabel: "Teks dokumen",
    documentTextPlaceholder: "Tempel struk, tagihan, atau catatan…",
    capturePagePrompt: "Potret halaman",
    dropDocumentHere: "Letakkan dokumen Anda di sini",
    cameraSubtext: "Gunakan kamera di perangkat yang didukung, atau pilih foto.",
    fileSubtext: "PDF, JPEG, atau PNG · Maksimal 8 MB",
    selectOriginalFile: "Pilih file asli",
    chooseAnother: "Pilih file lain",
    openCameraOrPhotos: "Buka kamera atau foto",
    browseFiles: "Telusuri file",
    consentHintCapture:
      "Konfirmasi izin cloud di atas untuk melanjutkan, atau beralih ke Aturan pengarsipan lokal.",
    saveAndOrganize: "Simpan & rapikan",
    privacyFootnote: "Dokumen asli tetap berada di profil browser ini.",
    originalDocumentSummary: "Dokumen asli",
    originalCapturedAlt: "Dokumen asli yang ditangkap",
    imagePreviewUnavailable:
      "Pratinjau gambar tidak tersedia. Unduh file asli untuk memeriksanya.",
    downloadPdfFallback: "Unduh PDF asli untuk memeriksanya.",
    downloadOriginal: "Unduh dokumen asli",
    kickerRedactedSample: "Sampel struk disensor · Dokumen",
    kickerPhotoSample: "Sampel foto · Dokumen",
    kickerSyntheticSample: "Sampel sintetis · Dokumen",
    kickerDocumentRecord: "Catatan dokumen",
    addedDate: ({ name, date }) => `${name} · Ditambahkan ${date}`,
    statusFiledInLibrary: "Terarsip di Pustaka",
    statusNeedsReview: "Perlu ditinjau",
    interruptedFallback:
      "Pemrosesan terhenti. Coba lagi atau arsipkan dokumen asli secara manual.",
    checkBeforeFiling: "Periksa detail sebelum mengarsipkan.",
    consentHintRetry:
      "Konfirmasi izin cloud di atas untuk mencoba ulang dengan AI, atau arsipkan manual di bawah.",
    retryProcessing: "Coba proses lagi",
    documentTitleLabel: "Judul dokumen",
    primaryCategoryLabel: "Kategori utama",
    tagsLabel: "Tag",
    tagsOptional: "(opsional, pisahkan dengan koma)",
    sourceExcerpt: ({ quote }) => `Kutipan sumber: ${quote}`,
    fileWithoutAi: "Arsipkan tanpa AI",
    saveChanges: "Simpan perubahan",
    confirmAndFile: "Konfirmasi & arsipkan",
    cancel: "Batal",
    filingDetails: "Detail pengarsipan",
    editDetails: "Edit detail",
    categoryLabel: "Kategori",
    editedSuffix: " · diedit",
    sourcePrefix: ({ quote }) => `Sumber: ${quote}`,
    filingEvidence: "Bukti pengarsipan",
    proposedSentenceStart: ({ mode }) => `${mode} mengusulkan `,
    proposedBasedOn: ({ evidence }) => ` berdasarkan “${evidence}”.`,
    currentFilingConfirmed: "Pengarsipan saat ini telah Anda konfirmasi.",
    suggestedFollowUp: "Saran tindak lanjut",
    modelReadChip: "Dibaca model · bandingkan dengan asli",
    sourceExcerptChip: "Kutipan sumber",
    savedInActions: "Tersimpan di Tindakan",
    confirmedActionSummary: ({ title, due }) =>
      `Terkonfirmasi: ${title}${due ? ` · Tenggat ${due}` : ""}`,
    draftVisualReview: ({ title, due }) =>
      `Draf: ${title}${due ? ` · Saran tenggat: ${due}` : ""} · Dibaca model dari foto; bandingkan dengan gambar asli di bawah sebelum mengonfirmasi.`,
    draftWithDue: ({ title, due }) => `Draf: ${title} · Saran tenggat: ${due}`,
    draftWithoutDue: ({ title }) =>
      `Draf: ${title} · Tidak ada tanggal kalender yang jelas pada kutipan — biarkan kosong atau isi saat mengonfirmasi.`,
    openInActions: "Buka di Tindakan",
    addFollowUp: "Tambah tindak lanjut",
    compareWithOriginal: "Bandingkan dengan asli",
    dismiss: "Abaikan",
    addAnAction: "Tambah tindakan",
    undoFiling: "Batalkan pengarsipan",
    actionTitleLabel: "Judul tindakan",
    dueDateLabel: "Tanggal tenggat",
    optionalParen: "(opsional)",
    createAction: "Buat tindakan",
    noticeStorageUnavailable:
      "Penyimpanan browser tidak tersedia. Izinkan penyimpanan situs lalu muat ulang.",
    noticeFirebaseLoadFailed:
      "Firebase AI gagal dimuat. Anda dapat menggunakan aturan lokal.",
    noticeChooseMethod: "Pilih metode pemrosesan yang tersedia terlebih dahulu.",
    noticeDuplicate: "Sudah pernah disimpan. Membuka dokumen asli yang ada.",
    noticeFiledWithUndo:
      "Terarsip di Pustaka. Anda dapat membatalkan pengarsipan ini.",
    noticeSavedNeedsAttention:
      "Dokumen asli tersimpan. Pemrosesan perlu perhatian.",
    noticeSavedCheckDetails:
      "Dokumen asli tersimpan. Periksa detail yang disarankan.",
    noticeQuotaFull: "Penyimpanan penuh. Dokumen Anda tidak dapat disimpan.",
    noticeCouldNotSaveDoc: "Dokumen tidak dapat disimpan.",
    noticeCouldNotSaveChange: "Perubahan tidak dapat disimpan. Coba lagi.",
    noticeFilingSaved: "Pengarsipan disimpan.",
    noticeMovedToInbox:
      "Dipindahkan ke Kotak Masuk. Dokumen asli tetap disimpan.",
    noticeAddedToActions: "Ditambahkan ke Tindakan.",
    noticeFollowUpAlreadySaved: "Tindak lanjut sudah tersimpan di Tindakan.",
    noticeFollowUpDismissed: "Draf tindak lanjut diabaikan.",
  },
};

export function createTranslator(lang) {
  const active = normalizeLang(lang);
  const dict = messages[active];
  return (key, params = {}) => {
    const entry = dict[key] ?? messages.en[key];
    if (typeof entry === "function") return entry(params);
    return entry ?? key;
  };
}

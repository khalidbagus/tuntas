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
  "Firebase AI access was blocked (App Check or API permission). Retry or file manually.":
    "Akses Firebase AI diblokir (App Check atau izin API). Coba lagi atau arsipkan manual.",
  "Firebase AI is temporarily rate-limited. Wait a moment and retry, or file manually.":
    "Firebase AI sedang mencapai batas permintaan sementara. Tunggu sebentar lalu coba lagi, atau arsipkan manual.",
  "AI analysis timed out. Retry or file manually.":
    "Analisis AI melebihi batas waktu. Coba lagi atau arsipkan manual.",
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
  "Action not found.": "Tindakan tidak ditemukan.",
  "Choose a valid calendar date.": "Pilih tanggal kalender yang valid.",
  "Give your group a short name.": "Beri grup Anda nama singkat.",
  "Group not found.": "Grup tidak ditemukan.",
  "Both actions must exist before linking.":
    "Kedua tindakan harus ada sebelum ditautkan.",
  "An action cannot depend on itself.":
    "Tindakan tidak dapat bergantung pada dirinya sendiri.",
  "Place both actions in the same group before linking them.":
    "Masukkan kedua tindakan ke grup yang sama sebelum menautkannya.",
  "This connection already exists.": "Tautan ini sudah ada.",
  "This link would create a circular dependency.":
    "Tautan ini akan membuat ketergantungan melingkar.",
  "Due date updated.": "Tanggal tenggat diperbarui.",
  "Due date removed.": "Tanggal tenggat dihapus.",
  "Group created.": "Grup dibuat.",
  "Group renamed.": "Nama grup diperbarui.",
  "Group removed. Actions kept.": "Grup dihapus. Tindakan tetap disimpan.",
  "Added to group.": "Ditambahkan ke grup.",
  "Moved out of group.": "Dikeluarkan dari grup.",
  "Connection added.": "Tautan ditambahkan.",
  "Connection removed.": "Tautan dihapus.",
  "Action completed.": "Tindakan diselesaikan.",
  "Action reopened.": "Tindakan dibuka kembali.",
  "Document deleted.": "Dokumen dihapus.",
  "The document could not be deleted. Try again.":
    "Dokumen tidak dapat dihapus. Coba lagi.",
  "Signed in.": "Berhasil masuk.",
  "Account created. Check your inbox for a verification email.":
    "Akun dibuat. Periksa kotak masuk Anda untuk email verifikasi.",
  "Account created.": "Akun dibuat.",
  "Signed out. Switched back to your device-only workspace.":
    "Berhasil keluar. Beralih kembali ke ruang kerja khusus perangkat Anda.",
  "Progress sync enabled.": "Sinkronisasi progres diaktifkan.",
  "Progress sync paused. Your workspace stays on this device.":
    "Sinkronisasi progres dijeda. Ruang kerja Anda tetap tersimpan di perangkat ini.",
  "Local records imported into your account workspace.":
    "Catatan lokal diimpor ke ruang kerja akun Anda.",
  "Verification email sent.": "Email verifikasi dikirim.",
  "Verification status updated.": "Status verifikasi diperbarui.",
  "Password reset email sent. Check your inbox.":
    "Email pengaturan ulang kata sandi dikirim. Periksa kotak masuk Anda.",
  "Workflow template created in Actions.":
    "Alur kerja dibuat di Tindakan.",
  "Workflow template already added.": "Alur kerja sudah ditambahkan.",
  "Workflow template dismissed.": "Saran alur kerja diabaikan.",
  "Calendar reminder downloaded.": "Pengingat kalender diunduh.",
  "Invalid workflow template.": "Templat alur kerja tidak valid.",
  "Split bill actions created.": "Tindakan patungan dibuat.",
  "Add at least one other participant.": "Tambahkan minimal satu peserta lain.",
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
    allDocuments: "All Documents",
    categoryPickerLabel: "Browse by category",
    clearSearch: "Clear search",
    urgencyOverdue: "Overdue",
    urgencyDueToday: "Due Today",
    urgencyDueSoon: "Due Soon",
    urgencyUpcoming: "Upcoming",
    urgencyNoDueDate: "No Due Date",
    urgencyCompleted: "Completed",
    noDueDateLabel: "No due date",
    todaysFocusHeading: "Today’s Focus",
    todaysFocusReadyLabel: "Recommended next step",
    todaysFocusGroupContext: ({ group }) => `In ${group}`,
    todaysFocusWhyOverdue:
      "This ready step is past its due date and has no unfinished prerequisites.",
    todaysFocusWhyDueToday:
      "This ready step is due today and can be completed now.",
    todaysFocusWhyDueSoon: ({ days }) =>
      days === 1
        ? "This ready step is due tomorrow."
        : `This ready step is due in ${days} days.`,
    todaysFocusWhyUpcoming:
      "This is the earliest ready follow-up with a confirmed due date.",
    todaysFocusWhyNoDate:
      "This ready follow-up is waiting for your attention and has no due date yet.",
    todaysFocusOpenAction: "Open action",
    todaysFocusOpenDocument: "Open source document",
    todaysFocusWaitingTitle:
      "All open steps are waiting on an earlier step",
    todaysFocusWaitingBody: ({ count, group }) =>
      group
        ? `${count} open follow-up(s) in “${group}” are waiting on unfinished prerequisites. Review steps in Actions.`
        : `${count} open follow-up(s) are waiting on unfinished prerequisites. Review steps in Actions.`,
    todaysFocusGoActions: "Review in Actions",
    todaysFocusAllDoneTitle: "Everything on your list is complete",
    todaysFocusAllDoneBody: ({ count }) =>
      count === 1
        ? "1 completed follow-up is saved in Actions."
        : `${count} completed follow-ups are saved in Actions.`,
    todaysFocusEmptyTitle: "No follow-ups need attention right now",
    todaysFocusEmptyBody:
      "When a document needs a next step, confirm a follow-up on its detail page and it will appear here.",
    actionsFilterLabel: "Filter actions",
    filterAll: "All",
    filterOpen: "Open",
    filterNoDueDate: "No Due Date",
    filterCompleted: "Completed",
    noActionsInFilter: "No actions match this filter.",
    showAllActions: "Show all actions",
    newGroup: "New group",
    groupNameLabel: "Group name",
    groupNamePlaceholder: "e.g., Household membership renewal",
    createGroup: "Create group",
    renameGroup: "Rename",
    saveGroupName: "Save name",
    deleteGroup: "Remove group",
    deleteGroupConfirm:
      "Remove this group? Its actions will stay in Standalone actions and their step links will be cleared.",
    confirmRemoveGroup: "Confirm removal",
    collapseGroup: "Collapse group",
    expandGroup: "Expand group",
    groupProgress: ({ completed, total }) =>
      `${completed} of ${total} steps completed`,
    groupProgressBarLabel: ({ title, completed, total }) =>
      `${title}: ${completed} of ${total} steps completed`,
    emptyGroupNote:
      "No steps in this group yet. Use “Add to group” on any action below to include it here.",
    standaloneActionsHeading: "Standalone actions",
    stateReady: "Ready",
    stateWaiting: "Waiting",
    waitingSummary: ({ count }) =>
      count === 1 ? "Waiting on 1 step" : `Waiting on ${count} steps`,
    showDetails: "Details",
    hideDetails: "Hide details",
    overridePromptTitle:
      "This step is waiting on unfinished prerequisites:",
    completeAnyway: "Complete anyway",
    evidenceHeading: "Evidence at a glance",
    evidenceSourceDoc: "Source document",
    evidenceSourceQuote: "Quoted from original document",
    evidenceNoQuote:
      "No source excerpt was recorded for this action. Open the original document to review the full record.",
    evidenceDueAndStatus: "Confirmed due date & status",
    evidenceUserEnteredNote:
      "Due dates and steps can be adjusted by you; original source files never change.",
    openOriginalDocument: "Open original document",
    editDueDateHeading: "Due date",
    saveDueDate: "Save date",
    removeDueDate: "Remove date",
    groupAssignmentLabel: "Group",
    noGroupOption: "No group (standalone)",
    addToGroupLabel: "Add to group",
    groupChangeClearsLinksHint:
      "Moving an action between groups clears its step connections.",
    manageStepsHeading: "Step connections",
    dependsOnHeading: "Depends on",
    unlocksHeading: "Unlocks",
    noPrerequisites:
      "No prerequisites — this step is ready whenever you are.",
    addPrerequisiteLabel: "Add prerequisite",
    choosePrerequisiteOption: "Choose a step in this group…",
    linkStepButton: "Connect step",
    removeLink: "Remove link",
    jumpToStep: "Jump to step",
    groupNeededToLink:
      "Assign this action to a group above before linking prerequisites.",
    noOtherStepsInGroup:
      "Add another action to this group to connect prerequisites.",
    viewConnections: "View connections",
    hideConnections: "Hide connections",
    connectionsGraphTitle: ({ title }) => `Connections · ${title}`,
    connectionsGraphHint:
      "Arrows point from each prerequisite step to the step it unlocks. Select a step to inspect its relationships.",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    zoomReset: "Reset zoom",
    zoomResetShort: "Reset",
    graphAriaLabel: ({ title }) => `Dependency diagram for ${title}`,
    graphNodeAria: ({ title, status }) => `${title}, ${status}`,
    graphSelectedStep: "Selected step",
    graphNoConnectionsYet:
      "No connections in this group yet. Expand a step below and use “Add prerequisite” to connect steps.",
    graphTextListHeading: "Text relationship list",
    graphOpenStepInList: "Focus step in list",
    graphArrowLabel: "unlocks",
    graphStandaloneStep: "Independent step (no prerequisite links yet)",
    deleteDocument: "Delete document",
    deleteDocumentConfirmHeading: ({ title }) => `Delete “${title}”?`,
    deleteDocumentConfirmBody:
      "This permanently removes the saved original and any follow-ups linked to it from this workspace.",
    deleteDocumentConfirmWithActions: ({ count }) =>
      count === 1
        ? "This permanently removes the saved original and 1 linked follow-up from this workspace."
        : `This permanently removes the saved original and ${count} linked follow-ups from this workspace.`,
    confirmDeleteDocument: "Delete permanently",
    deletingDocument: "Deleting…",
    navAccount: "Account",
    pageAccount: "Account",
    accountKicker: "Account & sync",
    accountTitle: "Account",
    accountDescription:
      "Sign in to keep filing status and action progress synced across devices while keeping originals on this device.",
    accountRailSignInHint: "Sign in or manage sync",
    accountRailSignedInSub: "Account workspace · this device",
    accountDemoTitle: "Accounts are disabled in the sample workspace",
    accountDemoBody:
      "Sample mode keeps synthetic data isolated in this browser profile with zero cloud writes. Exit demo to sign in or access your personal workspace.",
    accountUnavailableTitle: "Cloud sign-in is not configured here",
    accountUnavailableBody:
      "This build has no Firebase Authentication configuration. You can still capture, organize, and track actions offline on this device.",
    continueOnThisDevice: "Continue on this device",
    continueWithGoogle: "Continue with Google",
    googleHint:
      "Creates your account on first sign-in and signs you back in on return visits.",
    authTabSignIn: "Sign in",
    authTabCreate: "Create account",
    authTabReset: "Forgot password",
    authEmailLabel: "Email address",
    authPasswordLabel: "Password",
    authPasswordHint: "At least 6 characters",
    authSubmitSignIn: "Sign in",
    authSubmitCreate: "Create account",
    authSubmitReset: "Send reset email",
    authErrorPopupClosed:
      "Google sign-in was canceled before finishing. Try again when ready.",
    authErrorPopupBlocked:
      "Your browser blocked the sign-in popup. Allow popups for this site or sign in with email and password.",
    authErrorDifferentCredential:
      "An account with this email already exists using another sign-in method (such as email and password). Sign in with that method first.",
    authErrorEmailInUse:
      "An account already exists with this email. Sign in or reset your password instead.",
    authErrorInvalidCredentials:
      "Email or password did not match an account.",
    authErrorWeakPassword: "Choose a password with at least 6 characters.",
    authErrorInvalidEmail: "Enter a valid email address.",
    authErrorTooManyRequests:
      "Too many attempts right now. Wait a moment and try again.",
    authErrorNetwork:
      "Network error while contacting Firebase Auth. Check your connection and try again.",
    authErrorUnauthorizedDomain:
      "This domain is not authorized for Google sign-in in Firebase Console. Add this host to Authorized Domains.",
    authErrorRecentLogin:
      "For security, sign out and sign back in before retrying that action.",
    authErrorGeneric: "Sign-in could not be completed. Try again.",
    signedInAsHeading: "Signed in",
    providerGoogle: "Google",
    providerEmail: "Email & password",
    uidIsolatedChip: "UID-isolated workspace",
    emailVerifiedChip: "Verified",
    emailPendingChip: "Verification pending",
    emailVerifyHint:
      "Verify your email address so password resets and account recovery stay reliable.",
    resendVerification: "Resend verification email",
    refreshVerification: "I’ve verified",
    signOut: "Sign out",
    syncSectionTitle: "Optional progress sync",
    syncWhatSyncsLabel: "Synced to your account",
    syncWhatSyncsBody:
      "Document titles, categories, tags, filing status, action due dates, completion states, groups, and prerequisite links.",
    syncWhatStaysLocalLabel: "Kept on this device only",
    syncWhatStaysLocalBody:
      "Original PDFs and photos, extracted document text, and evidence excerpts stay in browser storage and are never uploaded.",
    syncBillingNote:
      "Original-file cloud sync across devices is a separate future feature requiring a Firebase billing decision.",
    syncRemoteDetectedNote:
      "Progress sync is already active on another device for this account. Enable sync on this device to view and update shared progress.",
    syncStatusOff: "Sync off",
    syncStatusPending: "Pending",
    syncStatusSynced: "Synced",
    syncStatusFailed: "Failed",
    syncPendingCount: ({ n }) =>
      n === 1 ? "1 change waiting to sync" : `${n} changes waiting to sync`,
    syncLastSyncedAt: ({ time }) => `Last synced ${time}`,
    enableSync: "Enable sync",
    disableSync: "Disable sync",
    syncNow: "Sync now",
    retrySync: "Retry sync",
    importPromptHeading: "Import records from this device?",
    importPromptBody: ({ docs, actions }) =>
      `This browser has ${docs} local document(s) and ${actions} follow-up(s) created while signed out. Your local copies stay preserved on this device.`,
    importAndEnableSync: "Import local records & enable sync",
    enableWithoutImport: "Enable sync without importing",
    importLocalRecords: ({ docs, actions }) =>
      `Import local records (${docs} docs · ${actions} actions)`,
    remoteOnlyChip: "Synced from another device",
    originalUnavailableOnDevice:
      "Original file, extracted text, and evidence excerpts stay on the device where this document was captured. Original-file sync is not included on this plan.",
    authEntryKicker: "Paperwork workspace",
    authEntryTitle: "Sign in to Tuntas",
    authHighlightLocal:
      "Originals, extracted text, and evidence excerpts stay in your browser storage.",
    authHighlightHybrid:
      "Hybrid AI prefers Chrome on-device inference and asks before using cloud Gemini.",
    authHighlightSync:
      "Opt-in account sync keeps titles, filing status, and action progress updated across devices.",
    authDemoHint:
      "Preview a pre-filled synthetic workspace as demo@example.com with zero cloud writes.",
    enterDemo: "Enter demo",
    demoIdentityBadge: "Demo account",
    privacyBadgeLocalRules: "Local rules · On device",
    privacyBadgeOnDevice: "On-device AI · No cloud upload",
    privacyBadgeHybridPreferDevice: "Hybrid AI · Prefers on-device",
    privacyBadgeCloudOptIn: "Cloud Gemini · Explicit opt-in",
    privacyDetailRulesConnected:
      "Runs deterministic text matching locally; nothing leaves this device.",
    privacyDetailRulesDisconnected:
      "Runs deterministic text matching locally without network AI calls.",
    privacyDetailOnDevice:
      "Uses Chrome’s built-in on-device Gemini model; your document stays offline.",
    privacyDetailHybridConsented:
      "Tries on-device AI first; cloud fallback permitted for this document only.",
    privacyDetailHybridNeedsConsent:
      "Tries on-device AI first; confirm permission below only if cloud fallback is needed.",
    privacyDetailCloudConsented:
      "On-device AI is unavailable here; you allowed cloud Gemini for this document.",
    privacyDetailCloudNeedsConsent:
      "On-device AI is unavailable here; confirm permission below before sending this document.",
    privacyDocOnDevice: "Processed on device · Chrome Gemini",
    privacyDocCloud: "Processed with Cloud Gemini · Consented",
    privacyDocLocalRules: "Processed locally · Rules only",
    privacyDocManual: "Filed manually · On device",
    privacyDocRetry: "AI processing incomplete · On device",
    privacyDocSynced: "Progress metadata synced",
    workflowTemplateHeading: "Suggested workflow template",
    workflowTemplateStepCount: ({ count }) => `${count} connected steps`,
    workflowTemplateAppliedChip: "Workflow created",
    createWorkflowButton: ({ count }) => `Create ${count}-step workflow`,
    creatingWorkflow: "Creating workflow…",
    calendarExportLabel: "Calendar export",
    downloadIcs: "Download .ics",
    addToGoogleCalendar: "Google Calendar",
    calendarExportNeedsDue:
      "Save a due date above to export a calendar reminder.",
    splitThisBill: "Split bill",
    splitBillKicker: "Split bill",
    splitBillTitle: "Create split bill",
    splitBillSubtitle:
      "Divide this bill equally or by item, track shares in Actions, and optionally invite friends by email.",
    splitCurrencyLabel: "Currency",
    splitTotalLabel: "Total bill amount",
    splitTaxTipLabel: "Tax & service charge",
    splitModeLabel: "Split method",
    splitModeEqual: "Split equally",
    splitModeItemized: "Itemized",
    splitItemsHeading: "Receipt items",
    splitItemNameLabel: "Item name",
    splitItemNamePlaceholder: "e.g., Dinner main course",
    splitItemPriceLabel: "Price",
    splitAddItem: "Add item",
    splitParticipantsHeading: "Participants",
    splitAddPerson: "Add person",
    splitPersonNameLabel: "Participant name",
    splitYourNamePlaceholder: "Your name",
    splitPersonNamePlaceholder: "Friend’s name",
    splitPersonEmailLabel: "Google email (optional for multi-user invite)",
    splitPersonEmailPlaceholder: "friend@gmail.com",
    remove: "Remove",
    splitPreviewHeading: ({ total }) => `Share breakdown · Total ${total}`,
    splitPaymentInstructionsLabel: "Payment instructions (QRIS / Bank / E-wallet / PayNow / Venmo)",
    splitPaymentInstructionsPlaceholder:
      "e.g., BCA 1234567890 a.n. Budi, QRIS note, or Venmo @handle",
    splitEmailInviteNote:
      "Participants with an email address will see this split when they sign in to Tuntas.",
    createSplitButton: "Create split bill",
    creatingSplit: "Creating split bill…",
    splitCreatedHeading: "Split bill ready",
    splitPublishedCloudChip: "Shared in Tuntas",
    splitSavedLocalChip: "Saved in Actions",
    splitSparkEmailNote:
      "Automated email dispatch via Cloud Functions is planned for production; on this Spark plan demo, share the invite link or pre-filled email below.",
    splitLocalOnlyNote:
      "Actions created in this workspace. Share the breakdown below via email or message.",
    openSplitDetail: "Open shared split",
    copyInviteLink: "Copy invite link",
    copyShareSummary: "Copy breakdown",
    sendSplitEmail: "Send email",
    copiedLabel: "Copied",
    close: "Close",
    sharedSplitsHeading: "Shared split bills",
    splitIncomingSummary: ({ amount, organizer }) =>
      `Your share: ${amount} · From ${organizer}`,
    splitOutgoingSummary: ({ total, confirmed, count }) =>
      `Total ${total} · ${confirmed} of ${count} confirmed`,
    splitOrganizerLabel: "Organizer",
    splitStatusPending: "Pending",
    splitStatusAccepted: "Accepted",
    splitStatusDeclined: "Declined",
    splitStatusProofSubmitted: "Proof submitted",
    splitStatusConfirmed: "Confirmed",
    splitStatusOpen: "Open",
    splitDetailMeta: ({ total, organizer }) => `Total ${total} · Organized by ${organizer}`,
    splitYourShareLabel: "Your share",
    splitAcceptShare: "Accept share",
    splitDeclineShare: "Decline",
    splitTransferProofHeading: "QRIS / Bank / E-wallet proof",
    splitTransferProofHint:
      "Pay using the organizer’s instructions above, then verify your transfer text or screenshot before submitting.",
    splitProofTextLabel: "Transfer reference or pasted receipt text",
    splitProofTextPlaceholder: "e.g., Transfer Rp 92.000 · Ref TRX-8841",
    splitProofScreenshotLabel: "Transfer screenshot (stays on this device)",
    splitProofCloudOptIn:
      "Allow Cloud Gemini fallback if on-device AI is unavailable to read this screenshot.",
    splitProofCloudOnlyOptIn:
      "On-device AI is unavailable; allow Cloud Gemini to read this screenshot.",
    splitVerifyProofBtn: "Verify proof",
    splitSubmitProofBtn: "Submit payment proof",
    splitProofEmptyError: "Enter transfer details or attach a screenshot first.",
    splitProofAiFallbackHint:
      "AI screenshot reading is unavailable. Enter transfer details above to verify locally.",
    gpayDemoHeading: "Google Pay",
    gpaySandboxBadge: "Sandbox Demo",
    gpaySandboxDisclaimer:
      "Client-side Google Pay TEST sheet preview (no real charge). Live P2P settlement verification requires a merchant PSP backend.",
    gpayPayDemoBtn: "Pay with Google Pay (Sandbox Demo)",
    gpayCanceledNote: "Google Pay test sheet was canceled.",
    gpayUnavailableNote:
      "Live Google Pay test sheet is unavailable in this browser/offline context. You can simulate a test token below.",
    gpaySimulateTokenBtn: "Simulate Google Pay test token",
    splitConfirmReceivedBtn: "Confirm payment received",
    splitRequestRetryBtn: "Request retry",
    splitSignInRequiredTitle: "Sign in to view this split bill",
    splitNotFound: "Split bill not found or access denied.",
    splitDemoInteractiveChip: "Demo preview · stored locally",
    askPaperworkHeading: "Ask your paperwork",
    askPaperworkSubtitle:
      "Answers stay grounded in your local Library with clickable document citations.",
    askBadgeLocal: "Local search · On device",
    askInputLabel: "Ask a question about your documents",
    askInputPlaceholder: "e.g., How much did I spend on receipts? or When does membership renew?",
    askSubmitBtn: "Ask",
    askSearching: "Searching…",
    askSamplePromptSpending: "How much did I spend on receipts?",
    askSamplePromptRenewal: "When does household membership renew?",
    askSamplePromptDinner: "What was on the Warung Taburai order?",
    askModeLocal: "Local search · no AI",
    askCloudConsentLabel:
      "Allow Cloud Gemini to synthesize an answer from the top matching local snippets.",
    askAnswerRegion: "Paperwork answer",
    askAnswerHeading: "Answer",
    askCitationsHeading: "Cited documents",
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
    allDocuments: "Semua Dokumen",
    categoryPickerLabel: "Telusuri berdasarkan kategori",
    clearSearch: "Hapus pencarian",
    urgencyOverdue: "Terlambat",
    urgencyDueToday: "Jatuh Tempo Hari Ini",
    urgencyDueSoon: "Segera Jatuh Tempo",
    urgencyUpcoming: "Mendatang",
    urgencyNoDueDate: "Tanpa Tenggat",
    urgencyCompleted: "Selesai",
    noDueDateLabel: "Tanpa tanggal tenggat",
    todaysFocusHeading: "Fokus Hari Ini",
    todaysFocusReadyLabel: "Langkah berikutnya yang disarankan",
    todaysFocusGroupContext: ({ group }) => `Di ${group}`,
    todaysFocusWhyOverdue:
      "Langkah yang siap ini sudah melewati tanggal tenggat dan tidak memiliki prasyarat yang belum selesai.",
    todaysFocusWhyDueToday:
      "Langkah yang siap ini jatuh tempo hari ini dan dapat diselesaikan sekarang.",
    todaysFocusWhyDueSoon: ({ days }) =>
      days === 1
        ? "Langkah yang siap ini jatuh tempo besok."
        : `Langkah yang siap ini jatuh tempo dalam ${days} hari.`,
    todaysFocusWhyUpcoming:
      "Ini tindak lanjut siap paling awal yang memiliki tenggat terkonfirmasi.",
    todaysFocusWhyNoDate:
      "Tindak lanjut yang siap ini menunggu perhatian Anda dan belum memiliki tanggal tenggat.",
    todaysFocusOpenAction: "Buka tindakan",
    todaysFocusOpenDocument: "Buka dokumen sumber",
    todaysFocusWaitingTitle:
      "Semua langkah terbuka sedang menunggu langkah sebelumnya",
    todaysFocusWaitingBody: ({ count, group }) =>
      group
        ? `${count} tindak lanjut terbuka di “${group}” menunggu prasyarat yang belum selesai. Tinjau langkah di Tindakan.`
        : `${count} tindak lanjut terbuka menunggu prasyarat yang belum selesai. Tinjau langkah di Tindakan.`,
    todaysFocusGoActions: "Tinjau di Tindakan",
    todaysFocusAllDoneTitle: "Semua di daftar Anda sudah selesai",
    todaysFocusAllDoneBody: ({ count }) =>
      `${count} tindak lanjut selesai tersimpan di Tindakan.`,
    todaysFocusEmptyTitle:
      "Belum ada tindak lanjut yang perlu perhatian saat ini",
    todaysFocusEmptyBody:
      "Saat dokumen memerlukan langkah lanjutan, konfirmasikan tindak lanjut di halaman detailnya agar muncul di sini.",
    actionsFilterLabel: "Filter tindakan",
    filterAll: "Semua",
    filterOpen: "Terbuka",
    filterNoDueDate: "Tanpa Tenggat",
    filterCompleted: "Selesai",
    noActionsInFilter: "Tidak ada tindakan yang cocok dengan filter ini.",
    showAllActions: "Tampilkan semua tindakan",
    newGroup: "Grup baru",
    groupNameLabel: "Nama grup",
    groupNamePlaceholder: "mis., Perpanjangan keanggotaan rumah tangga",
    createGroup: "Buat grup",
    renameGroup: "Ubah nama",
    saveGroupName: "Simpan nama",
    deleteGroup: "Hapus grup",
    deleteGroupConfirm:
      "Hapus grup ini? Tindakan di dalamnya tetap tersimpan sebagai tindakan mandiri dan tautan langkahnya akan dihapus.",
    confirmRemoveGroup: "Konfirmasi penghapusan",
    collapseGroup: "Ciutkan grup",
    expandGroup: "Bentangkan grup",
    groupProgress: ({ completed, total }) =>
      `${completed} dari ${total} langkah selesai`,
    groupProgressBarLabel: ({ title, completed, total }) =>
      `${title}: ${completed} dari ${total} langkah selesai`,
    emptyGroupNote:
      "Belum ada langkah di grup ini. Gunakan “Tambahkan ke grup” pada tindakan di bawah untuk memasukkannya ke sini.",
    standaloneActionsHeading: "Tindakan mandiri",
    stateReady: "Siap",
    stateWaiting: "Menunggu",
    waitingSummary: ({ count }) => `Menunggu ${count} langkah`,
    showDetails: "Detail",
    hideDetails: "Sembunyikan detail",
    overridePromptTitle:
      "Langkah ini masih menunggu prasyarat yang belum selesai:",
    completeAnyway: "Tetap selesaikan",
    evidenceHeading: "Ringkasan bukti",
    evidenceSourceDoc: "Dokumen sumber",
    evidenceSourceQuote: "Kutipan dari dokumen asli",
    evidenceNoQuote:
      "Tidak ada kutipan sumber yang tercatat untuk tindakan ini. Buka dokumen asli untuk memeriksa catatan lengkapnya.",
    evidenceDueAndStatus: "Tenggat terkonfirmasi & status",
    evidenceUserEnteredNote:
      "Tanggal tenggat dan langkah dapat Anda sesuaikan; file asli tidak pernah berubah.",
    openOriginalDocument: "Buka dokumen asli",
    editDueDateHeading: "Tanggal tenggat",
    saveDueDate: "Simpan tanggal",
    removeDueDate: "Hapus tanggal",
    groupAssignmentLabel: "Grup",
    noGroupOption: "Tanpa grup (mandiri)",
    addToGroupLabel: "Tambahkan ke grup",
    groupChangeClearsLinksHint:
      "Memindahkan tindakan ke grup lain akan menghapus tautan langkahnya.",
    manageStepsHeading: "Keterkaitan langkah",
    dependsOnHeading: "Bergantung pada",
    unlocksHeading: "Membuka langkah",
    noPrerequisites:
      "Tidak ada prasyarat — langkah ini siap dikerjakan kapan saja.",
    addPrerequisiteLabel: "Tambah prasyarat",
    choosePrerequisiteOption: "Pilih langkah di grup ini…",
    linkStepButton: "Tautkan langkah",
    removeLink: "Hapus tautan",
    jumpToStep: "Buka langkah",
    groupNeededToLink:
      "Masukkan tindakan ini ke grup di atas sebelum menautkan prasyarat.",
    noOtherStepsInGroup:
      "Tambahkan tindakan lain ke grup ini untuk menautkan prasyarat.",
    viewConnections: "Lihat keterkaitan",
    hideConnections: "Tutup keterkaitan",
    connectionsGraphTitle: ({ title }) => `Keterkaitan · ${title}`,
    connectionsGraphHint:
      "Panah mengarah dari langkah prasyarat ke langkah berikutnya yang dibuka. Pilih langkah untuk memeriksa keterkaitannya.",
    zoomOut: "Perkecil",
    zoomIn: "Perbesar",
    zoomReset: "Atur ulang zoom",
    zoomResetShort: "Reset",
    graphAriaLabel: ({ title }) => `Diagram keterkaitan untuk ${title}`,
    graphNodeAria: ({ title, status }) => `${title}, ${status}`,
    graphSelectedStep: "Langkah dipilih",
    graphNoConnectionsYet:
      "Belum ada keterkaitan di grup ini. Buka detail langkah di bawah lalu gunakan “Tambah prasyarat” untuk menghubungkan langkah.",
    graphTextListHeading: "Daftar keterkaitan teks",
    graphOpenStepInList: "Fokuskan langkah di daftar",
    graphArrowLabel: "membuka",
    graphStandaloneStep: "Langkah independen (belum memiliki tautan prasyarat)",
    deleteDocument: "Hapus dokumen",
    deleteDocumentConfirmHeading: ({ title }) => `Hapus “${title}”?`,
    deleteDocumentConfirmBody:
      "Ini akan menghapus permanen dokumen asli yang tersimpan beserta tindak lanjut yang tertaut dari ruang kerja ini.",
    deleteDocumentConfirmWithActions: ({ count }) =>
      `Ini akan menghapus permanen dokumen asli yang tersimpan dan ${count} tindak lanjut yang tertaut dari ruang kerja ini.`,
    confirmDeleteDocument: "Hapus permanen",
    deletingDocument: "Menghapus…",
    navAccount: "Akun",
    pageAccount: "Akun",
    accountKicker: "Akun & sinkronisasi",
    accountTitle: "Akun",
    accountDescription:
      "Masuk untuk menyinkronkan status pengarsipan dan progres tindakan lintas perangkat sambil menjaga dokumen asli tetap di perangkat ini.",
    accountRailSignInHint: "Masuk atau kelola sinkronisasi",
    accountRailSignedInSub: "Ruang kerja akun · perangkat ini",
    accountDemoTitle: "Akun dinonaktifkan di ruang kerja sampel",
    accountDemoBody:
      "Mode sampel menyimpan data sintetis terpisah di profil browser ini tanpa penulisan cloud. Keluar dari demo untuk masuk atau membuka ruang kerja pribadi Anda.",
    accountUnavailableTitle: "Masuk cloud belum dikonfigurasi di sini",
    accountUnavailableBody:
      "Build ini tidak memiliki konfigurasi Firebase Authentication. Anda tetap dapat menangkap, merapikan, dan melacak tindakan secara offline di perangkat ini.",
    continueOnThisDevice: "Lanjutkan di perangkat ini",
    continueWithGoogle: "Lanjutkan dengan Google",
    googleHint:
      "Membuat akun saat pertama kali masuk dan langsung masuk pada kunjungan berikutnya.",
    authTabSignIn: "Masuk",
    authTabCreate: "Buat akun",
    authTabReset: "Lupa kata sandi",
    authEmailLabel: "Alamat email",
    authPasswordLabel: "Kata sandi",
    authPasswordHint: "Minimal 6 karakter",
    authSubmitSignIn: "Masuk",
    authSubmitCreate: "Buat akun",
    authSubmitReset: "Kirim email pengaturan ulang",
    authErrorPopupClosed:
      "Masuk dengan Google dibatalkan sebelum selesai. Coba lagi saat Anda siap.",
    authErrorPopupBlocked:
      "Browser Anda memblokir jendela popup masuk. Izinkan popup untuk situs ini atau masuk menggunakan email dan kata sandi.",
    authErrorDifferentCredential:
      "Akun dengan email ini sudah terdaftar menggunakan metode masuk lain (seperti email dan kata sandi). Masuk dengan metode tersebut terlebih dahulu.",
    authErrorEmailInUse:
      "Akun dengan email ini sudah ada. Silakan masuk atau atur ulang kata sandi Anda.",
    authErrorInvalidCredentials:
      "Email atau kata sandi tidak cocok dengan akun mana pun.",
    authErrorWeakPassword: "Pilih kata sandi minimal 6 karakter.",
    authErrorInvalidEmail: "Masukkan alamat email yang valid.",
    authErrorTooManyRequests:
      "Terlalu banyak percobaan saat ini. Tunggu sebentar lalu coba lagi.",
    authErrorNetwork:
      "Kesalahan jaringan saat menghubungi Firebase Auth. Periksa koneksi Anda lalu coba lagi.",
    authErrorUnauthorizedDomain:
      "Domain ini belum diotorisasi untuk masuk dengan Google di Firebase Console. Tambahkan host ini ke Authorized Domains.",
    authErrorRecentLogin:
      "Demi keamanan, keluar lalu masuk kembali sebelum mengulangi tindakan ini.",
    authErrorGeneric: "Proses masuk tidak dapat diselesaikan. Coba lagi.",
    signedInAsHeading: "Masuk sebagai",
    providerGoogle: "Google",
    providerEmail: "Email & kata sandi",
    uidIsolatedChip: "Ruang kerja terisolasi UID",
    emailVerifiedChip: "Terverifikasi",
    emailPendingChip: "Menunggu verifikasi",
    emailVerifyHint:
      "Verifikasi alamat email Anda agar pengaturan ulang kata sandi dan pemulihan akun tetap berjalan baik.",
    resendVerification: "Kirim ulang email verifikasi",
    refreshVerification: "Saya sudah verifikasi",
    signOut: "Keluar",
    syncSectionTitle: "Sinkronisasi progres opsional",
    syncWhatSyncsLabel: "Disinkronkan ke akun Anda",
    syncWhatSyncsBody:
      "Judul dokumen, kategori, tag, status pengarsipan, tenggat tindakan, status selesai, grup, dan tautan prasyarat.",
    syncWhatStaysLocalLabel: "Disimpan hanya di perangkat ini",
    syncWhatStaysLocalBody:
      "File PDF dan foto asli, teks dokumen yang diekstrak, serta kutipan bukti tetap di penyimpanan browser dan tidak pernah diunggah.",
    syncBillingNote:
      "Sinkronisasi file asli lintas perangkat merupakan fitur terpisah yang memerlukan keputusan penagihan Firebase.",
    syncRemoteDetectedNote:
      "Sinkronisasi progres sudah aktif di perangkat lain untuk akun ini. Aktifkan sinkronisasi di perangkat ini untuk melihat dan memperbarui progres bersama.",
    syncStatusOff: "Sinkronisasi nonaktif",
    syncStatusPending: "Tertunda",
    syncStatusSynced: "Tersinkron",
    syncStatusFailed: "Gagal",
    syncPendingCount: ({ n }) =>
      `${n} perubahan menunggu sinkronisasi`,
    syncLastSyncedAt: ({ time }) => `Terakhir disinkronkan ${time}`,
    enableSync: "Aktifkan sinkronisasi",
    disableSync: "Nonaktifkan sinkronisasi",
    syncNow: "Sinkronkan sekarang",
    retrySync: "Coba sinkronkan lagi",
    importPromptHeading: "Impor catatan dari perangkat ini?",
    importPromptBody: ({ docs, actions }) =>
      `Browser ini memiliki ${docs} dokumen lokal dan ${actions} tindak lanjut yang dibuat saat belum masuk. Salinan lokal Anda tetap tersimpan aman di perangkat ini.`,
    importAndEnableSync: "Impor catatan lokal & aktifkan sinkronisasi",
    enableWithoutImport: "Aktifkan sinkronisasi tanpa mengimpor",
    importLocalRecords: ({ docs, actions }) =>
      `Impor catatan lokal (${docs} dokumen · ${actions} tindakan)`,
    remoteOnlyChip: "Disinkronkan dari perangkat lain",
    originalUnavailableOnDevice:
      "File asli, teks yang diekstrak, dan kutipan bukti tetap berada di perangkat tempat dokumen ini ditangkap. Sinkronisasi file asli tidak termasuk dalam paket ini.",
    authEntryKicker: "Ruang kerja dokumen",
    authEntryTitle: "Masuk ke Tuntas",
    authHighlightLocal:
      "Dokumen asli, teks yang diekstrak, dan kutipan bukti tetap tersimpan di browser Anda.",
    authHighlightHybrid:
      "AI Hibrida mengutamakan model di perangkat Chrome dan selalu meminta izin sebelum memakai cloud Gemini.",
    authHighlightSync:
      "Sinkronisasi akun opsional menjaga judul, status pengarsipan, dan progres tindakan tetap selaras lintas perangkat.",
    authDemoHint:
      "Jelajahi ruang kerja sintetis siap pakai sebagai demo@example.com tanpa penulisan cloud.",
    enterDemo: "Masuk demo",
    demoIdentityBadge: "Akun demo",
    privacyBadgeLocalRules: "Aturan lokal · Di perangkat",
    privacyBadgeOnDevice: "AI di perangkat · Tanpa unggah cloud",
    privacyBadgeHybridPreferDevice: "AI Hibrida · Utamakan perangkat",
    privacyBadgeCloudOptIn: "Cloud Gemini · Izin eksplisit",
    privacyDetailRulesConnected:
      "Menjalankan pencocokan teks lokal secara deterministik; tidak ada data yang keluar dari perangkat ini.",
    privacyDetailRulesDisconnected:
      "Menjalankan pencocokan teks lokal tanpa panggilan AI jaringan.",
    privacyDetailOnDevice:
      "Menggunakan model Gemini bawaan Chrome di perangkat; dokumen tetap offline.",
    privacyDetailHybridConsented:
      "Mencoba AI di perangkat terlebih dahulu; cadangan cloud diizinkan hanya untuk dokumen ini.",
    privacyDetailHybridNeedsConsent:
      "Mencoba AI di perangkat terlebih dahulu; konfirmasi izin di bawah hanya jika cadangan cloud diperlukan.",
    privacyDetailCloudConsented:
      "AI di perangkat tidak tersedia di sini; Anda mengizinkan cloud Gemini untuk dokumen ini.",
    privacyDetailCloudNeedsConsent:
      "AI di perangkat tidak tersedia di sini; konfirmasi izin di bawah sebelum mengirim dokumen ini.",
    privacyDocOnDevice: "Diproses di perangkat · Chrome Gemini",
    privacyDocCloud: "Diproses dengan Cloud Gemini · Atas izin",
    privacyDocLocalRules: "Diproses lokal · Aturan saja",
    privacyDocManual: "Diarsipkan manual · Di perangkat",
    privacyDocRetry: "Pemrosesan AI belum selesai · Di perangkat",
    privacyDocSynced: "Metadata progres tersinkron",
    workflowTemplateHeading: "Saran templat alur kerja",
    workflowTemplateStepCount: ({ count }) => `${count} langkah terhubung`,
    workflowTemplateAppliedChip: "Alur dibuat",
    createWorkflowButton: ({ count }) => `Buat alur ${count} langkah`,
    creatingWorkflow: "Membuat alur…",
    calendarExportLabel: "Ekspor kalender",
    downloadIcs: "Unduh .ics",
    addToGoogleCalendar: "Google Calendar",
    calendarExportNeedsDue:
      "Simpan tanggal tenggat di atas untuk mengekspor pengingat kalender.",
    splitThisBill: "Patungan",
    splitBillKicker: "Patungan tagihan",
    splitBillTitle: "Buat patungan tagihan",
    splitBillSubtitle:
      "Bagi tagihan sama rata atau per item, lacak di Tindakan, dan undang teman lewat email.",
    splitCurrencyLabel: "Mata uang",
    splitTotalLabel: "Total tagihan",
    splitTaxTipLabel: "Pajak & biaya layanan",
    splitModeLabel: "Metode pembagian",
    splitModeEqual: "Bagi rata",
    splitModeItemized: "Per item",
    splitItemsHeading: "Daftar item struk",
    splitItemNameLabel: "Nama item",
    splitItemNamePlaceholder: "mis., Menu makan malam",
    splitItemPriceLabel: "Harga",
    splitAddItem: "Tambah item",
    splitParticipantsHeading: "Peserta",
    splitAddPerson: "Tambah orang",
    splitPersonNameLabel: "Nama peserta",
    splitYourNamePlaceholder: "Nama Anda",
    splitPersonNamePlaceholder: "Nama teman",
    splitPersonEmailLabel: "Email Google (opsional untuk undangan akun)",
    splitPersonEmailPlaceholder: "teman@gmail.com",
    remove: "Hapus",
    splitPreviewHeading: ({ total }) => `Rincian patungan · Total ${total}`,
    splitPaymentInstructionsLabel: "Instruksi pembayaran (QRIS / Bank / E-wallet / PayNow / Venmo)",
    splitPaymentInstructionsPlaceholder:
      "mis., BCA 1234567890 a.n. Budi, catatan QRIS, atau e-wallet",
    splitEmailInviteNote:
      "Peserta dengan email akan langsung melihat patungan ini saat masuk ke Tuntas.",
    createSplitButton: "Buat patungan",
    creatingSplit: "Membuat patungan…",
    splitCreatedHeading: "Patungan siap",
    splitPublishedCloudChip: "Dibagikan di Tuntas",
    splitSavedLocalChip: "Tersimpan di Tindakan",
    splitSparkEmailNote:
      "Pengiriman email otomatis via Cloud Functions direncanakan untuk produksi; pada demo Spark ini, bagikan tautan undangan atau email siap kirim di bawah.",
    splitLocalOnlyNote:
      "Tindakan dibuat di ruang kerja ini. Bagikan rincian di bawah lewat email atau pesan.",
    openSplitDetail: "Buka patungan bersama",
    copyInviteLink: "Salin tautan undangan",
    copyShareSummary: "Salin rincian",
    sendSplitEmail: "Kirim email",
    copiedLabel: "Tersalin",
    close: "Tutup",
    sharedSplitsHeading: "Patungan bersama",
    splitIncomingSummary: ({ amount, organizer }) =>
      `Bagian Anda: ${amount} · Dari ${organizer}`,
    splitOutgoingSummary: ({ total, confirmed, count }) =>
      `Total ${total} · ${confirmed} dari ${count} terkonfirmasi`,
    splitOrganizerLabel: "Penyelenggara",
    splitStatusPending: "Menunggu",
    splitStatusAccepted: "Diterima",
    splitStatusDeclined: "Ditolak",
    splitStatusProofSubmitted: "Bukti dikirim",
    splitStatusConfirmed: "Terkonfirmasi",
    splitStatusOpen: "Terbuka",
    splitDetailMeta: ({ total, organizer }) => `Total ${total} · Dibuat oleh ${organizer}`,
    splitYourShareLabel: "Bagian Anda",
    splitAcceptShare: "Terima bagian",
    splitDeclineShare: "Tolak",
    splitTransferProofHeading: "Bukti QRIS / Bank / E-wallet",
    splitTransferProofHint:
      "Bayar sesuai instruksi di atas, lalu verifikasi catatan atau tangkapan layar transfer sebelum mengirim.",
    splitProofTextLabel: "Referensi transfer atau teks struk",
    splitProofTextPlaceholder: "mis., Transfer Rp 92.000 · Ref TRX-8841",
    splitProofScreenshotLabel: "Tangkapan layar transfer (tetap di perangkat ini)",
    splitProofCloudOptIn:
      "Izinkan cadangan Cloud Gemini jika AI di perangkat tidak tersedia untuk membaca gambar ini.",
    splitProofCloudOnlyOptIn:
      "AI di perangkat tidak tersedia; izinkan Cloud Gemini membaca tangkapan layar ini.",
    splitVerifyProofBtn: "Verifikasi bukti",
    splitSubmitProofBtn: "Kirim bukti bayar",
    splitProofEmptyError: "Masukkan detail transfer atau pilih tangkapan layar terlebih dahulu.",
    splitProofAiFallbackHint:
      "Pembacaan AI tidak tersedia. Masukkan detail transfer di atas untuk verifikasi lokal.",
    gpayDemoHeading: "Google Pay",
    gpaySandboxBadge: "Demo Sandbox",
    gpaySandboxDisclaimer:
      "Pratinjau Google Pay TEST di sisi klien (tanpa tagihan nyata). Verifikasi penyelesaian P2P langsung memerlukan backend PSP merchant.",
    gpayPayDemoBtn: "Bayar dengan Google Pay (Demo Sandbox)",
    gpayCanceledNote: "Lembar uji Google Pay dibatalkan.",
    gpayUnavailableNote:
      "Lembar uji Google Pay tidak tersedia di browser/kondisi offline ini. Anda dapat mensimulasikan token uji di bawah.",
    gpaySimulateTokenBtn: "Simulasikan token uji Google Pay",
    splitConfirmReceivedBtn: "Konfirmasi pembayaran diterima",
    splitRequestRetryBtn: "Minta kirim ulang",
    splitSignInRequiredTitle: "Masuk untuk melihat patungan ini",
    splitNotFound: "Patungan tidak ditemukan atau akses ditolak.",
    splitDemoInteractiveChip: "Pratinjau demo · tersimpan lokal",
    askPaperworkHeading: "Tanya dokumen Anda",
    askPaperworkSubtitle:
      "Jawaban bersumber dari Pustaka lokal Anda dengan kutipan dokumen yang dapat diklik.",
    askBadgeLocal: "Pencarian lokal · Di perangkat",
    askInputLabel: "Ajukan pertanyaan tentang dokumen Anda",
    askInputPlaceholder: "mis., Berapa total pengeluaran struk saya? atau Kapan keanggotaan diperpanjang?",
    askSubmitBtn: "Tanya",
    askSearching: "Mencari…",
    askSamplePromptSpending: "Berapa total pengeluaran struk saya?",
    askSamplePromptRenewal: "Kapan keanggotaan rumah tangga diperpanjang?",
    askSamplePromptDinner: "Apa saja pesanan di struk Warung Taburai?",
    askModeLocal: "Pencarian lokal · tanpa AI",
    askCloudConsentLabel:
      "Izinkan Cloud Gemini merangkum jawaban dari cuplikan lokal paling relevan.",
    askAnswerRegion: "Jawaban dokumen",
    askAnswerHeading: "Jawaban",
    askCitationsHeading: "Dokumen rujukan",
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

export function getCapturePrivacyStatus({
  mode = "rules",
  configured = false,
  deviceSupported = false,
  consent = false,
} = {}) {
  if (mode === "device") {
    return {
      tone: "green",
      iconKey: "cpu",
      badgeKey: "privacyBadgeOnDevice",
      detailKey: "privacyDetailOnDevice",
    };
  }
  if (mode === "hybrid") {
    if (deviceSupported) {
      return {
        tone: "blue",
        iconKey: "sparkles",
        badgeKey: "privacyBadgeHybridPreferDevice",
        detailKey: consent
          ? "privacyDetailHybridConsented"
          : "privacyDetailHybridNeedsConsent",
      };
    }
    return {
      tone: "amber",
      iconKey: "cloud",
      badgeKey: "privacyBadgeCloudOptIn",
      detailKey: consent
        ? "privacyDetailCloudConsented"
        : "privacyDetailCloudNeedsConsent",
    };
  }
  return {
    tone: "green",
    iconKey: "shield",
    badgeKey: "privacyBadgeLocalRules",
    detailKey: configured
      ? "privacyDetailRulesConnected"
      : "privacyDetailRulesDisconnected",
  };
}

export function getDocumentPrivacyMeta(docMode = "") {
  if (docMode === "Firebase · on device") {
    return {
      tone: "green",
      iconKey: "cpu",
      labelKey: "privacyDocOnDevice",
      fallbackLabel: docMode,
    };
  }
  if (docMode === "Firebase · cloud") {
    return {
      tone: "blue",
      iconKey: "cloud",
      labelKey: "privacyDocCloud",
      fallbackLabel: docMode,
    };
  }
  if (docMode === "Local rules") {
    return {
      tone: "green",
      iconKey: "shield",
      labelKey: "privacyDocLocalRules",
      fallbackLabel: docMode,
    };
  }
  if (docMode === "Manual filing") {
    return {
      tone: "neutral",
      iconKey: "shield",
      labelKey: "privacyDocManual",
      fallbackLabel: docMode,
    };
  }
  if (docMode === "Firebase · unsuccessful") {
    return {
      tone: "amber",
      iconKey: "alert",
      labelKey: "privacyDocRetry",
      fallbackLabel: docMode,
    };
  }
  if (docMode === "Synced progress") {
    return {
      tone: "blue",
      iconKey: "cloud",
      labelKey: "privacyDocSynced",
      fallbackLabel: docMode,
    };
  }
  return {
    tone: "neutral",
    iconKey: "monitor",
    labelKey: "",
    fallbackLabel: docMode,
  };
}

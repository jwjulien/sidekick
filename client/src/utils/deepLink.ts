export interface ParsedDeepLink {
  rawUrl: string;
  scheme: string;
  action: string; // e.g. 'location', 'part', 'scan', 'resolve'
  id?: string;
  targetRoute: string;
}

/**
 * Parses a custom URI deep link (e.g. fuse://location/{id}) into an internal app route.
 */
export function parseDeepLink(rawUrl: string): ParsedDeepLink | null {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("fuse://")) {
    return null;
  }

  // Remove fuse:// scheme
  const pathWithoutScheme = trimmed.replace(/^fuse:\/\//i, "");
  
  // Handle empty or trailing slashes
  if (!pathWithoutScheme) {
    return {
      rawUrl,
      scheme: "fuse",
      action: "home",
      targetRoute: "/",
    };
  }

  // Split path parts (e.g. "location/12345" -> ["location", "12345"])
  const parts = pathWithoutScheme.split("?")[0].split("/").filter(Boolean);
  const queryString = pathWithoutScheme.includes("?") 
    ? pathWithoutScheme.substring(pathWithoutScheme.indexOf("?")) 
    : "";

  const primaryAction = parts[0]?.toLowerCase() || "";
  let secondaryId = parts[1] || "";

  if (!secondaryId && queryString) {
    try {
      const params = new URLSearchParams(queryString);
      secondaryId = params.get("id") || params.get("location") || params.get("part") || params.get("resolve") || "";
    } catch (_) {}
  }

  switch (primaryAction) {
    case "location":
      return {
        rawUrl,
        scheme: "fuse",
        action: "location",
        id: secondaryId,
        targetRoute: secondaryId ? `/storage?location=${encodeURIComponent(secondaryId)}` : "/storage",
      };

    case "part":
    case "parts":
      return {
        rawUrl,
        scheme: "fuse",
        action: "part",
        id: secondaryId,
        targetRoute: secondaryId ? `/parts/${encodeURIComponent(secondaryId)}` : "/parts",
      };

    case "scan":
      return {
        rawUrl,
        scheme: "fuse",
        action: "scan",
        targetRoute: `/scan${queryString}`,
      };

    case "resolve":
      return {
        rawUrl,
        scheme: "fuse",
        action: "resolve",
        id: secondaryId,
        targetRoute: secondaryId ? `/scan?resolve=${encodeURIComponent(secondaryId)}` : "/scan",
      };

    default:
      return {
        rawUrl,
        scheme: "fuse",
        action: primaryAction,
        id: secondaryId,
        targetRoute: `/${pathWithoutScheme}`,
      };
  }
}

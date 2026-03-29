/**
 * Tool: check-website
 * Fetches a dental practice's website and analyzes its quality.
 * Returns a status that informs the lead score.
 *
 * Statuses (worst → best):
 *   none     — no website at all
 *   error    — website is unreachable or returns an error
 *   poor     — page is tiny (<5KB), uses Flash, or clearly broken
 *   outdated — copyright year before 2018, no modern framework
 *   basic    — no SSL or not mobile-responsive
 *   active   — modern, mobile-friendly, has online booking
 */

export interface WebsiteCheckResult {
  status: "none" | "error" | "poor" | "outdated" | "basic" | "active";
  details: string;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function checkWebsite(url?: string): Promise<WebsiteCheckResult> {
  if (!url) {
    return { status: "none", details: "No website listed" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadScout/1.0)",
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { status: "error", details: `HTTP ${response.status}` };
    }

    const html = await response.text();
    return analyzeHtml(html, url);
  } catch (err) {
    const message = (err as Error).name === "AbortError"
      ? "Timeout after 10s"
      : (err as Error).message;
    return { status: "error", details: message };
  }
}

function analyzeHtml(html: string, url: string): WebsiteCheckResult {
  const lower = html.toLowerCase();

  // Poor signals
  const isTinyPage = html.length < 5_000;
  const hasFlash = lower.includes(".swf") || lower.includes("shockwave");

  if (isTinyPage || hasFlash) {
    return { status: "poor", details: isTinyPage ? "Page under 5KB — very thin site" : "Uses Flash" };
  }

  // Outdated signals
  const oldCopyrightMatch = html.match(/©\s*(199\d|200\d|201[0-7])/);
  const hasModernFramework =
    lower.includes("react") ||
    lower.includes("vue") ||
    lower.includes("angular") ||
    lower.includes("next") ||
    lower.includes("wordpress") && lower.includes("2023") ||
    lower.includes("wordpress") && lower.includes("2024");

  if (oldCopyrightMatch && !hasModernFramework) {
    return {
      status: "outdated",
      details: `Copyright ${oldCopyrightMatch[1]} — site likely not updated`,
    };
  }

  // Basic signals (no SSL or not mobile-friendly)
  const hasSSL = url.startsWith("https://");
  const hasMobileViewport =
    lower.includes('name="viewport"') || lower.includes("name='viewport'");

  if (!hasSSL || !hasMobileViewport) {
    return {
      status: "basic",
      details: !hasSSL ? "No SSL (HTTP only)" : "Not mobile-responsive",
    };
  }

  // Active signals
  const hasOnlineBooking =
    lower.includes("book an appointment") ||
    lower.includes("book online") ||
    lower.includes("request appointment") ||
    lower.includes("schedule online") ||
    lower.includes("zocdoc") ||
    lower.includes("healthgrades");

  if (hasOnlineBooking) {
    return { status: "active", details: "Modern site with online booking" };
  }

  return { status: "basic", details: "Mobile-friendly but no online booking" };
}

/**
 * Task: process-dental-lead
 * Receives a single dental practice, checks its website quality,
 * scores the lead, and saves it to Google Sheets if score >= 50.
 *
 * Lead scoring:
 *   No website         +60
 *   Outdated/poor site +40
 *   Basic site         +25
 *   >50 reviews        +20
 *   >100 reviews       +10
 *   Rating >= 4.0      +10
 *   Min to save: 50
 */

import { task } from "@trigger.dev/sdk";
import { checkWebsite, type WebsiteCheckResult } from "../tools/check-website.js";
import { saveLead } from "../tools/save-to-sheet.js";
import { saveToClickUp } from "../tools/save-to-clickup.js";

export interface DentalPractice {
  title: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  placeId?: string;
}

const MIN_SCORE = 50;

export const processDentalLead = task({
  id: "process-dental-lead",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
  },

  run: async (payload: { practice: DentalPractice; location: string }) => {
    const { practice, location } = payload;

    const websiteCheck = await checkWebsite(practice.website);
    const score = scoreLead(practice, websiteCheck);

    console.log(`[process-dental-lead] ${practice.title} — score: ${score} — website: ${websiteCheck.status}`);

    if (score >= MIN_SCORE) {
      const leadRecord = {
        businessName: practice.title,
        address: practice.address,
        phone: practice.phone ?? "",
        website: practice.website ?? "No website",
        websiteStatus: websiteCheck.status,
        rating: practice.rating ?? 0,
        reviewCount: practice.ratingCount ?? 0,
        score,
        location,
        foundDate: new Date().toISOString().slice(0, 10),
      };

      // Save to both Google Sheets and ClickUp in parallel
      await Promise.all([
        saveLead(leadRecord),
        saveToClickUp(leadRecord),
      ]);

      console.log(`[process-dental-lead] Saved: ${practice.title}`);
    }

    return {
      business: practice.title,
      score,
      websiteStatus: websiteCheck.status,
      saved: score >= MIN_SCORE,
    };
  },
});

function scoreLead(practice: DentalPractice, websiteCheck: WebsiteCheckResult): number {
  let score = 0;

  // Website quality — the main signal
  if (websiteCheck.status === "none") {
    score += 60;
  } else if (websiteCheck.status === "poor" || websiteCheck.status === "error") {
    score += 40;
  } else if (websiteCheck.status === "outdated") {
    score += 35;
  } else if (websiteCheck.status === "basic") {
    score += 25;
  }
  // "active" = 0 points (they already have a good site — skip)

  // Review count — signals an established practice more likely to invest
  const reviews = practice.ratingCount ?? 0;
  if (reviews > 100) score += 30;
  else if (reviews > 50) score += 20;
  else if (reviews > 10) score += 10;

  // Rating — higher-rated practices are more investable
  if ((practice.rating ?? 0) >= 4.0) score += 10;

  return score;
}

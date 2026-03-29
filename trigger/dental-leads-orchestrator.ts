/**
 * Task: dental-leads-orchestrator
 * Runs every Monday at 6:00 AM UTC.
 *
 * For each configured location, searches for dental practices via the
 * Serper Maps API, then dispatches a process-dental-lead task for each
 * result. Idempotency keys prevent the same practice from being
 * processed more than once per week.
 *
 * Configure locations via SEARCH_LOCATIONS env var:
 *   "Austin, Texas;Dallas, Texas;Houston, Texas"
 */

import { schedules } from "@trigger.dev/sdk";
import { processDentalLead } from "./process-dental-lead.js";
import { searchDentalPractices } from "../tools/search-dental-practices.js";

const DEFAULT_LOCATIONS = [
  "Austin, Texas",
  "Dallas, Texas",
  "Houston, Texas",
  "Phoenix, Arizona",
  "Denver, Colorado",
];

function getLocations(): string[] {
  const env = process.env.SEARCH_LOCATIONS;
  if (!env) return DEFAULT_LOCATIONS;
  return env.split(";").map((l) => l.trim()).filter(Boolean);
}

export const dentalLeadsOrchestrator = schedules.task({
  id: "dental-leads-orchestrator",
  cron: "0 6 * * 1", // Every Monday at 6:00 AM UTC

  run: async () => {
    const locations = getLocations();
    const weekStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let totalDispatched = 0;

    console.log(`[dental-leads-orchestrator] Starting — ${weekStamp}`);
    console.log(`[dental-leads-orchestrator] Searching ${locations.length} location(s): ${locations.join(", ")}`);

    for (const location of locations) {
      console.log(`[dental-leads-orchestrator] Searching: ${location}`);

      const practices = await searchDentalPractices(location);
      console.log(`[dental-leads-orchestrator] Found ${practices.length} practices in ${location}`);

      for (const practice of practices) {
        // Idempotency key: same practice won't be processed twice in the same week
        const idempotencyKey = `dental-lead-${practice.placeId ?? practice.title}-${weekStamp}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 128);

        await processDentalLead.trigger(
          { practice, location },
          { idempotencyKey }
        );

        totalDispatched++;
      }
    }

    console.log(`[dental-leads-orchestrator] Done — dispatched ${totalDispatched} leads`);
    return { weekStamp, locationsSearched: locations.length, totalDispatched };
  },
});

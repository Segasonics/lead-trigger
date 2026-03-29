/**
 * Tool: save-to-clickup
 * Creates a task in the "Dental Leads" ClickUp list for each qualified lead.
 *
 * Task format:
 *   Title:    Business name
 *   Desc:     Full lead details (address, phone, website, score, status)
 *   Priority: urgent (score≥80) | high (score≥65) | normal (score≥50)
 *   Tags:     website status + location
 *
 * Required env vars:
 *   CLICKUP_API_KEY   — personal API token
 *   CLICKUP_LIST_ID   — ID of the "Dental Leads" list (901614232770)
 */

import type { LeadRecord } from "./save-to-sheet.js";

const CLICKUP_API = "https://api.clickup.com/api/v2";

// 1=urgent, 2=high, 3=normal, 4=low
function getPriority(score: number): number {
  if (score >= 80) return 1; // urgent
  if (score >= 65) return 2; // high
  return 3;                  // normal
}

function buildDescription(lead: LeadRecord): string {
  return [
    `**Address:** ${lead.address}`,
    `**Phone:** ${lead.phone || "—"}`,
    `**Website:** ${lead.website}`,
    `**Website Status:** ${lead.websiteStatus}`,
    `**Rating:** ${lead.rating} ⭐ (${lead.reviewCount} reviews)`,
    `**Lead Score:** ${lead.score}/100`,
    `**Location Searched:** ${lead.location}`,
    `**Date Found:** ${lead.foundDate}`,
  ].join("\n");
}

interface ClickUpTask {
  id: string;
  name: string;
  url: string;
}

interface ClickUpTasksResponse {
  tasks: ClickUpTask[];
}

async function findExistingTask(
  businessName: string,
  apiKey: string,
  listId: string
): Promise<boolean> {
  const search = encodeURIComponent(businessName);
  const response = await fetch(
    `${CLICKUP_API}/list/${listId}/task?search=${search}&include_closed=true`,
    { headers: { Authorization: apiKey } }
  );

  if (!response.ok) return false;

  const data = (await response.json()) as ClickUpTasksResponse;
  return data.tasks.some(
    (t) => t.name.toLowerCase() === businessName.toLowerCase()
  );
}

export async function saveToClickUp(lead: LeadRecord): Promise<void> {
  const apiKey = process.env.CLICKUP_API_KEY;
  const listId = process.env.CLICKUP_LIST_ID;
  if (!apiKey) throw new Error("CLICKUP_API_KEY is not set");
  if (!listId) throw new Error("CLICKUP_LIST_ID is not set");

  // Skip if this business already exists in the list
  const exists = await findExistingTask(lead.businessName, apiKey, listId);
  if (exists) {
    console.log(`[save-to-clickup] Skipped (already exists): ${lead.businessName}`);
    return;
  }

  const body = {
    name: lead.businessName,
    description: buildDescription(lead),
    status: "to do",
    priority: getPriority(lead.score),
    tags: [lead.websiteStatus, lead.location.split(",")[0].trim().toLowerCase()],
  };

  const response = await fetch(`${CLICKUP_API}/list/${listId}/task`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ClickUp API error ${response.status}: ${err}`);
  }

  const task = await response.json() as ClickUpTask;
  console.log(`[save-to-clickup] Created task: ${task.url}`);
}

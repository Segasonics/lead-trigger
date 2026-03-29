/**
 * Tool: save-to-sheet
 * Appends a qualified dental lead to the "Leads" tab of a Google Sheet.
 * Uses a service account for auth (no user OAuth required).
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID              — spreadsheet ID from the URL
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full service account JSON as a string
 */

import { google } from "googleapis";

export interface LeadRecord {
  businessName: string;
  address: string;
  phone: string;
  website: string;
  websiteStatus: string;
  rating: number;
  reviewCount: number;
  score: number;
  location: string;
  foundDate: string;
}

const SHEET_TAB = "Leads";
const HEADERS = [
  "Business Name",
  "Address",
  "Phone",
  "Website",
  "Website Status",
  "Rating",
  "Review Count",
  "Lead Score",
  "Location",
  "Date Found",
];

function getSheets() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function saveLead(lead: LeadRecord): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  const sheets = getSheets();

  await ensureHeaders(sheets, spreadsheetId);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB}!A:J`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        lead.businessName,
        lead.address,
        lead.phone,
        lead.website,
        lead.websiteStatus,
        lead.rating,
        lead.reviewCount,
        lead.score,
        lead.location,
        lead.foundDate,
      ]],
    },
  });
}

async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A1:J1`,
  });

  if (!res.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_TAB}!A1:J1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS] },
    });
  }
}

# Dental Lead Scraper — SOP

## Objective

Every Monday at 6am UTC, automatically find dental practices that are likely to need a website or website upgrade. Save qualified leads to a Google Sheet for outreach.

## What Makes a Good Lead

A dental practice is worth contacting if:

- They have **no website** — biggest opportunity (score +60)
- Their website is **outdated** — old copyright, no modern framework (score +35)
- Their website is **poor** — tiny page, broken, or unreachable (score +40)
- Their website is **basic** — no SSL or not mobile-responsive (score +25)
- They have **reviews** — signals an established practice willing to invest

**Minimum score to save: 50**

Practices with a modern, mobile-friendly site with online booking are skipped (already well-served).

---

## Architecture

This automation follows the WAT Orchestrator + Processor pattern:

```
[Cron: Monday 6am]
       │
       ▼
dental-leads-orchestrator.ts
  → For each location:
      → searchDentalPractices()   ← Serper Maps API
      → For each practice found:
          → processDentalLead.trigger()
                │
                ▼
          process-dental-lead.ts
            → checkWebsite()      ← Fetch + HTML analysis
            → scoreLead()         ← Scoring logic
            → saveLead()          ← Google Sheets append
```

---

## Required Inputs

| Variable                      | Where to Get It                                     |
| ----------------------------- | --------------------------------------------------- |
| `TRIGGER_SECRET_KEY`          | trigger.dev → Project → Settings                    |
| `TRIGGER_PROJECT_ID`          | trigger.dev → Project → Settings                    |
| `SERPER_API_KEY`              | serper.dev (free tier: 2,500 searches/month)        |
| `GOOGLE_SHEET_ID`             | Spreadsheet URL → the long ID string                |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud Console → IAM → Service Accounts       |
| `SEARCH_LOCATIONS`            | Semicolon-separated cities (optional, has defaults) |

---

## Lead Scoring Table

| Condition                           | Points |
| ----------------------------------- | ------ |
| No website                          | +60    |
| Poor/unreachable website            | +40    |
| Outdated website (old copyright)    | +35    |
| Basic website (no SSL / not mobile) | +25    |
| >100 reviews                        | +30    |
| >50 reviews                         | +20    |
| >10 reviews                         | +10    |
| Rating ≥ 4.0                        | +10    |

**Save threshold: 50 points**

---

## Output — Google Sheet ("Leads" tab)

| Column         | Description                                     |
| -------------- | ----------------------------------------------- |
| Business Name  | Practice name                                   |
| Address        | Full street address                             |
| Phone          | Phone number                                    |
| Website        | URL or "No website"                             |
| Website Status | none / poor / outdated / basic / active / error |
| Rating         | Google rating (0–5)                             |
| Review Count   | Number of Google reviews                        |
| Lead Score     | 0–100                                           |
| Location       | City searched                                   |
| Date Found     | YYYY-MM-DD                                      |

---

## Setup Instructions

1. Copy `.env.example` to `.env` and fill in all values
2. Create a Google Sheet and add a tab named **Leads**
3. Share the sheet with your service account email (Editor access)
4. Run `npm install`
5. Run `npx @trigger.dev/cli@latest login`
6. Run `npm run dev` to test locally (triggers can be manually fired from the dashboard)
7. Run `npm run deploy` to deploy to Trigger.dev cloud
8. The task will run automatically every Monday at 6am UTC

---

## Known Constraints

- Serper Maps returns up to 10 results per query; 4 queries × N locations = up to 40×N raw practices per week
- Website checks time out at 10 seconds — unreachable sites are scored as "error" (still qualifies)
- The idempotency key (`practice-placeId-YYYY-MM-DD`) prevents the same practice from being saved twice in one week
- Google Sheets API quota: 60 requests/minute — serial processing stays well within limits
- The `processDentalLead` task retries up to 3 times with exponential backoff if Sheets writes fail

## Edge Cases

- **Serper API error for a location** → skipped and logged, other locations continue
- **Website fetch timeout** → status set to "error", still saved if score ≥ 50
- **Sheet missing "Leads" tab** → tool auto-writes headers on first run (tab must exist)
- **Duplicate practices across search queries** → deduplicated by Serper `placeId` before dispatching

## Improvement Ideas

- Add email/Slack notification when X leads are found
- Filter by `ratingCount` minimum (e.g., only practices with ≥ 5 reviews)
- Expand to other business types (plumbers, HVAC, auto shops)
- Add a "contacted" column + workflow to track outreach status
- Score based on competitor website quality in the same area

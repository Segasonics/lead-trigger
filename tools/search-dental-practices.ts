/**
 * Tool: search-dental-practices
 * Uses the Serper Maps API to find dental practices in a given location.
 * Runs 4 query variations per location and deduplicates by place ID.
 */

export interface DentalPractice {
  title: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  placeId?: string;
}

interface SerperMapsPlace {
  title: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  placeId?: string;
  category?: string;
}

interface SerperMapsResponse {
  places?: SerperMapsPlace[];
}

// Run multiple query variations to maximize coverage
const SEARCH_QUERIES = [
  "dental office",
  "dentist",
  "dental clinic",
  "family dentistry",
];

export async function searchDentalPractices(location: string): Promise<DentalPractice[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY is not set");

  const seen = new Map<string, DentalPractice>();

  for (const query of SEARCH_QUERIES) {
    const results = await fetchMapsResults(query, location, apiKey);
    for (const place of results) {
      const key = place.placeId ?? place.title;
      if (!seen.has(key)) {
        seen.set(key, place);
      }
    }
  }

  return Array.from(seen.values());
}

async function fetchMapsResults(
  query: string,
  location: string,
  apiKey: string
): Promise<DentalPractice[]> {
  try {
    const response = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, location, gl: "us", hl: "en" }),
    });

    if (!response.ok) {
      console.error(`[search-dental-practices] Serper error for "${query}" in ${location}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as SerperMapsResponse;
    return (data.places ?? []).map((p) => ({
      title: p.title,
      address: p.address,
      phone: p.phone,
      website: p.website,
      rating: p.rating,
      ratingCount: p.ratingCount,
      placeId: p.placeId,
    }));
  } catch (err) {
    console.error(`[search-dental-practices] Failed for "${query}" in ${location}:`, err);
    return [];
  }
}

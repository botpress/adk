import flightCacheTable from "../tables/flightCacheTable";
import type { Flight } from "./types";

type CacheResult = {
  success: boolean;
  flight?: Flight;
  error?: string;
};

export async function searchCache(flightId: string): Promise<CacheResult> {
  try {
    const result = await flightCacheTable.findRows({
      filter: { flightId },
      orderBy: "cachedAt",
      orderDirection: "desc",
      limit: 1,
    });

    if (result.rows.length === 0) {
      return { success: false, error: `No cached data found for ${flightId}` };
    }

    const cached = result.rows[0];
    return {
      success: true,
      flight: {
        id: cached.flightId,
        flightNumber: cached.flightNumber,
        origin: cached.origin,
        destination: cached.destination,
        departureTime: cached.departureTime,
        arrivalTime: cached.arrivalTime,
        price: cached.price,
        cabinClass: cached.cabinClass,
        airline: cached.airline,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Cache table search failed",
    };
  }
}

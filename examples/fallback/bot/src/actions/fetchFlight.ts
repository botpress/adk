import type { Flight } from "./types";
import { context } from "@botpress/runtime";

type FlightResult = {
  success: boolean;
  flight?: Flight;
  error?: string;
};

export async function fetchFlight(
  flightId: string,
  source: "main" | "backup",
): Promise<FlightResult> {
  const { API_BASE_URL } = context.get("configuration");
  try {
    const response = await fetch(
      `${API_BASE_URL}/flight/${source}/${flightId}`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: `Failed to get Flight ${flightId}`,
        };
      }
      throw new Error(`${source} API returned ${response.status}`);
    }

    const flight = await response.json();
    return { success: true, flight };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : `${source} API request failed`,
    };
  }
}

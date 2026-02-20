import type { Flight } from "./types";
import { configuration } from "@botpress/runtime";

const API_BASE_URL = configuration.API_BASE_URL;

type SerpResult = {
	success: boolean;
	flights?: Flight[];
	error?: string;
};

export async function serpFlightSearch(
	departureAirport: string,
	arrivalAirport: string,
): Promise<SerpResult> {
	if (!departureAirport || !arrivalAirport) {
		return {
			success: false,
			error: `Both departure_airport and arrival_airport are required. Got departure_airport="${departureAirport || ""}", arrival_airport="${arrivalAirport || ""}". Ask the user for the missing airport IATA code(s) before calling this tool.`,
		};
	}

	try {
		const response = await fetch(
			`${API_BASE_URL}/serp/flight_search?departure_id=${encodeURIComponent(departureAirport)}&arrival_id=${encodeURIComponent(arrivalAirport)}`,
			{ method: "GET", headers: { "Content-Type": "application/json" } },
		);

		if (!response.ok) {
			throw new Error(`Serp API returned ${response.status}`);
		}

		const responseData = await response.json();
		const data = responseData.data;

		const allFlights: Flight[] = [];

		const transformFlight = (flight: any, optionIndex: number): Flight => ({
			id: flight.id || `${departureAirport}-${arrivalAirport}-${optionIndex}`,
			flightNumber: flight.flight_number || "Unknown",
			origin: flight.departure_airport?.id || departureAirport,
			destination: flight.arrival_airport?.id || arrivalAirport,
			departureTime: flight.departure_airport?.time || new Date().toISOString(),
			arrivalTime: flight.arrival_airport?.time || new Date().toISOString(),
			price: flight.price || 0,
			cabinClass: flight.travel_class || "Economy",
			airline: flight.airline || "Unknown",
		});

		const extractFlights = (options: any[], idOffset: number) => {
			if (!Array.isArray(options)) return;
			options.forEach((option: any, idx: number) => {
				if (option.flights && Array.isArray(option.flights)) {
					option.flights.forEach((flight: any, flightIdx: number) => {
						allFlights.push(transformFlight(flight, (idx + idOffset) * 100 + flightIdx));
					});
				}
			});
		};

		extractFlights(data?.best_flights, 0);
		extractFlights(data?.other_flights, 1000);

		if (allFlights.length === 0) {
			return { success: false, error: "No flights found for this route" };
		}

		return { success: true, flights: allFlights };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Serp search failed",
		};
	}
}

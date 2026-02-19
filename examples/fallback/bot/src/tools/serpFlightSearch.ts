import { Autonomous, z } from "@botpress/runtime";
import { serpFlightSearch } from "../actions/serpFlightSearch";

export default new Autonomous.Tool({
	name: "serpFlightSearch",
	description:
		"Search flights by departure AND arrival airport IATA codes. BOTH departure_airport and arrival_airport are REQUIRED — do NOT call this tool unless you have both values. Ask the user for any missing airport code before calling. Example: departure_airport='CDG' and arrival_airport='AUS' searches flights from Paris Charles de Gaulle to Austin.",
	input: z.object({
		departure_airport: z
			.string()
			.describe(
				"3-letter IATA code of the departure airport (e.g., 'CDG' for Paris Charles de Gaulle, 'YUL' for Montreal, 'YYZ' for Toronto Pearson)",
			),
		arrival_airport: z
			.string()
			.describe(
				"3-letter IATA code of the arrival airport (e.g., 'AUS' for Austin, 'LAX' for Los Angeles, 'JFK' for New York)",
			),
	}),
	output: z.object({
		success: z.boolean(),
		flights: z
			.array(
				z.object({
					id: z.string(),
					flightNumber: z.string(),
					origin: z.string(),
					destination: z.string(),
					departureTime: z.string(),
					arrivalTime: z.string(),
					price: z.number(),
					cabinClass: z.string(),
					airline: z.string(),
				}),
			)
			.optional(),
		error: z.string().optional(),
	}),
	handler: ({ departure_airport, arrival_airport }) =>
		serpFlightSearch(departure_airport, arrival_airport),
});

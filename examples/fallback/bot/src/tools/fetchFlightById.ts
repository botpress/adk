import { Autonomous, z } from "@botpress/runtime";
import { fetchFlight } from "../actions/fetchFlight";

export default new Autonomous.Tool({
	name: "fetchFlightById",
	description: "Fetch flight information from the primary API by flight ID (e.g., FL001)",
	input: z.object({
		flightId: z.string().describe("The flight ID (e.g., FL001)"),
	}),
	output: z.object({
		success: z.boolean(),
		flight: z.object({
			id: z.string(),
			flightNumber: z.string(),
			origin: z.string(),
			destination: z.string(),
			departureTime: z.string(),
			arrivalTime: z.string(),
			price: z.number(),
			cabinClass: z.string(),
			airline: z.string(),
		}).optional(),
		error: z.string().optional(),
	}),
	handler: ({ flightId }) => fetchFlight(flightId, "main"),
});

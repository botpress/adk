import { z } from "@botpress/runtime";
import { FallbackTool } from "../utils/FallbackTool";
import { fetchFlight } from "../actions/fetchFlight";
import { searchCache } from "../actions/searchCache";

const flightOutputSchema = z.object({
	success: z.boolean(),
	flight: z
		.object({
			id: z.string(),
			flightNumber: z.string(),
			origin: z.string(),
			destination: z.string(),
			departureTime: z.string(),
			arrivalTime: z.string(),
			price: z.number(),
			cabinClass: z.string(),
			airline: z.string(),
		})
		.optional(),
	error: z.string().optional(),
	source: z.string().optional(),
	attemptedSources: z.array(z.string()).optional(),
});

export default new FallbackTool({
	name: "getFlightData",
	description:
		"Look up flight data by flight ID (e.g., FL001). Automatically tries multiple sources.",
	input: z.object({
		flightId: z.string().describe("The flight ID (e.g., FL001)"),
	}),
	output: flightOutputSchema,
})
	.addFallback("main", ({ flightId }) => fetchFlight(flightId, "main"))
	.addFallback("backup", ({ flightId }) => fetchFlight(flightId, "backup"))
	.addFallback("cache", ({ flightId }) => searchCache(flightId))
	.build();

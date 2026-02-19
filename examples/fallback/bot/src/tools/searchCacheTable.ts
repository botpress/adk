import { Autonomous, z } from "@botpress/runtime";
import { searchCache } from "../actions/searchCache";

export default new Autonomous.Tool({
	name: "searchCacheTable",
	description: "Search for flight information in the local cache table by flight ID",
	input: z.object({
		flightId: z.string().describe("The flight ID to search for in cache (e.g., FL001)"),
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
	handler: ({ flightId }) => searchCache(flightId),
});

import { Table, z } from "@botpress/runtime";

export default new Table({
	name: "flightCacheTable",
	columns: {
		flightId: z.string().describe("Flight ID (e.g., FL001)"),
		flightNumber: z.string().describe("Flight number"),
		origin: z.string().describe("Origin airport code"),
		destination: z.string().describe("Destination airport code"),
		departureTime: z.string().describe("Departure timestamp"),
		arrivalTime: z.string().describe("Arrival timestamp"),
		price: z.number().describe("Ticket price"),
		cabinClass: z.string().describe("Cabin class"),
		airline: z.string().describe("Airline name"),
		cachedAt: z.string().describe("When this was cached"),
		source: z.string().describe("Which API/source provided this data")
	}
});

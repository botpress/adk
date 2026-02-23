import { Conversation } from "@botpress/runtime";
import getFlightData from "../tools/getFlightData";
import serpFlightSearch from "../tools/serpFlightSearch";

export const Webchat = new Conversation({
	channel: "webchat.channel",
	handler: async ({ execute }) => {
		await execute({
			instructions: `You are a flight pricing agent. Help users find flight information.

Use getFlightData to look up flights by ID (e.g., FL001).
If it reports all sources failed, ask the user for departure and arrival airport IATA codes, then use serpFlightSearch.
If serpFlightSearch also fails, tell the user to visit www.google.com/travel/flights.

Always tell the user which data source the result came from. The tool response includes a "source" field (e.g. "main", "backup", "cache") — mention it in your reply so the user knows where the data originated.

Format responses using plain markdown (bold, bullets, etc.). Never wrap your response in code fences or code blocks.`,
			tools: [getFlightData, serpFlightSearch],
		});
	},
});

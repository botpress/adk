import { Conversation, z } from "@botpress/runtime";
import { fallbackStrategies } from "../config/fallbackStrategies";
import { generateInstructions } from "../utils/runFallbackStrategies";
import fetchFlightById from "../tools/fetchFlightById";
import fetchBackupFlight from "../tools/fetchBackupFlight";
import searchCacheTable from "../tools/searchCacheTable";
import serpFlightSearch from "../tools/serpFlightSearch";

// All fallback strategy tools
const strategyTools = [
	fetchFlightById,
	fetchBackupFlight,
	searchCacheTable,
	serpFlightSearch,
];

// Conversation state schema
const conversationState = z.object({
	flightId: z.string().optional(),
	currentStrategyIndex: z.number().default(0),
	departureCity: z.string().optional(),
	arrivalCity: z.string().optional(),
	awaitingCities: z.boolean().default(false),
	lastResult: z.any().optional(),
});

async function flightHandler({ conversation, execute, message, state }: any) {
	const text = message?.payload?.text || "";
	const flightIdMatch = text.match(/\bFL\d{3}\b/i);
	const flightId = flightIdMatch ? flightIdMatch[0].toUpperCase() : null;
	const cityMatch = text.match(/\b([A-Z]{3})\s*(?:to|-|→)\s*([A-Z]{3})\b/i);

	if (flightId && (!state.flightId || state.flightId !== flightId)) {
		state.flightId = flightId;
		state.currentStrategyIndex = 0;
		state.awaitingCities = false;
		state.departureCity = null;
		state.arrivalCity = null;
	}

	if (state.awaitingCities && cityMatch) {
		state.departureCity = cityMatch[1].toUpperCase();
		state.arrivalCity = cityMatch[2].toUpperCase();
		state.awaitingCities = false;
	}

	if (!state.flightId && !flightId) {
		await conversation.send({
			type: "text",
			payload: {
				text: "Hi, I am you flight pricing agent, please provide a flight ID (e.g., FL001) to get realtime prices"
			}
		});
		return;
	}

	const currentFlightId = state.flightId || flightId;

	const instructions = generateInstructions(
		currentFlightId,
		state.currentStrategyIndex || 0,
	);

	const context =
		"\n\n**Current context:**\n" +
		`- Flight ID: ${currentFlightId}\n` +
		`- Departure City: ${state.departureCity || "Not provided yet"}\n` +
		`- Arrival City: ${state.arrivalCity || "Not provided yet"}\n`;

	const result = await execute({
		instructions: instructions + context,
		tools: strategyTools,
	});

	const currentStrategy = fallbackStrategies.strategies[state.currentStrategyIndex || 0];
	if (currentStrategy?.requiresUserInput && !state.departureCity && !state.awaitingCities) {
		state.awaitingCities = true;
	}
}

export const Webchat = new Conversation({
	channel: "webchat.channel",
	state: conversationState,
	handler: flightHandler,
});


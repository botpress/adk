import { z } from "@botpress/runtime";

export const StrategySchema = z.object({
  name: z.string(),
  toolName: z.string(),
  description: z.string(),
  instruction: z.string(),
  onFailure: z.enum(["next", "stop"]).default("next"),
  requiresUserInput: z.boolean().default(false),
  requiredFields: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

export type Strategy = z.infer<typeof StrategySchema>;

export const fallbackStrategies = {
  systemPrompt: "You are a flight lookup assistant. Follow the strategy chain below in order. On success, return the result immediately and stop. On failure, move to the next strategy.",
  finalMessage: "I can't help you with this flight information right now. Please visit www.google.com/travel/flights for more Infomation.",
  strategies: [
    {
      name: "mainAPI",
      toolName: "fetchFlightById",
      description: "Main flight API - Search by flight ID (e.g., FL001)",
      instruction: "Call fetchFlightById with the user's flightId. If it returns an error or no data, proceed to the next strategy.",
      onFailure: "next" as const,
      requiresUserInput: false,
      enabled: true,
    },
    {
      name: "backupAPI",
      toolName: "fetchBackupFlight",
      description: "Backup flight API - Search by flight ID (e.g., FL001)",
      instruction: "Call fetchBackupFlight with the user's flightId. If it returns an error or no data, proceed to the next strategy.",
      onFailure: "next" as const,
      requiresUserInput: false,
      enabled: true,
    },
    {
      name: "cacheTable",
      toolName: "searchCacheTable",
      description: "Cache table - stores previously fetched flight data with timestamps",
      instruction: "Call searchCacheTable to look up cached flight data for this flightId. If no cached data is found, proceed to the next strategy.",
      onFailure: "next" as const,
      requiresUserInput: false,
      enabled: true,
    },
    {
      name: "citySearch",
      toolName: "serpFlightSearch",
      description: "Search flights by departure and arrival airport IATA codes (like 'CDG', 'AUS', 'JFK'). Requires departure_airport and arrival_airport parameters.",
      instruction: "You MUST have BOTH departure_airport AND arrival_airport IATA codes before calling serpFlightSearch. If either is missing, ask the user to provide it. Do NOT call the tool with only one code.",
      onFailure: "stop" as const,
      requiresUserInput: true,
      requiredFields: ["departure_airport", "arrival_airport"],
      enabled: true,
    },
  ] as Strategy[],
};

import { fallbackStrategies, type Strategy } from "../config/fallbackStrategies";

export function generateInstructions(flightId: string, currentStrategyIndex: number = 0): string {
	const { systemPrompt, finalMessage, strategies } = fallbackStrategies;
	const enabled = strategies.filter((s) => s.enabled);

	let instructions = `${systemPrompt}\n\nThe user is looking for flight **${flightId}**.\n\n`;
	instructions += "**Strategy chain:**\n\n";

	enabled.forEach((strategy, index) => {
		const status =
			index < currentStrategyIndex ? "TRIED" :
			index === currentStrategyIndex ? "CURRENT" : "PENDING";

		instructions += `${index + 1}. [${status}] **${strategy.name}** → tool: \`${strategy.toolName}\`\n`;
		instructions += `   ${strategy.description}\n`;
		instructions += `   Instruction: ${strategy.instruction}\n`;

		if (index < enabled.length - 1 && strategy.onFailure === "next") {
			instructions += `   On failure → go to strategy ${index + 2} (${enabled[index + 1].name})\n`;
		} else {
			instructions += `   On failure → tell the user: "${finalMessage}"\n`;
		}
		instructions += "\n";
	});

	instructions += "\n**Formatting rule:** Always respond with plain markdown (bold, bullets, etc.). Never wrap your response in a code block or markdown fences (``` or ~~~).";

	return instructions;
}

export function getNextStrategy(currentIndex: number): Strategy | null {
	const strategies = fallbackStrategies.strategies.filter((s) => s.enabled);
	if (currentIndex < strategies.length) {
		return strategies[currentIndex];
	}
	return null;
}

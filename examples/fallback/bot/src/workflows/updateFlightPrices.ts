import { Workflow } from "@botpress/runtime";
import flightCacheTable from "../tables/flightCacheTable";
import { fetchFlightById } from "../actions/fetchFlightById";

const API_BASE_URL = "https://fallback-demo-api.vercel.app/api";

function generateFlightId(index: number): string {
	return `FL${String(index).padStart(3, '0')}`;
}

export default new Workflow({
	name: "updateFlightPrices",
	schedule: "*/1 * * * *", // Every 1 minute
	handler: async (ctx) => {
		const { step, logger } = ctx;
		logger.info("[PriceUpdater] Starting price update workflow - fetching FL001 to FL010");
		const result = await step("fetch-and-update", async () => {
			let updated = 0;
			let errors = 0;
			let notFound = 0;

			for (let i = 1; i <= 10; i++) {
				const flightId = generateFlightId(i);
				try {
					const result = await fetchFlightById.handler({ input: { flightId } });

					if (result.error) {
						logger.error(`Error got in fetchFlightById ${result.error}`);
					}
					if (!result.flight) {
						notFound++;
						continue;
					}
					const flight = result.flight;

					const existing = await flightCacheTable.findRows({
						filter: { flightId: flightId },
						limit: 1
					});
					if (existing.rows && existing.rows.length > 0) {
						const row = existing.rows[0];
						await flightCacheTable.updateRows({
							rows: [{
								id: row.id,
								price: flight.price,
								cachedAt: new Date().toISOString(),
								source: "price-updater"
							}]
						});
					} else {
						await flightCacheTable.createRows({
							rows: [{
								flightId: flightId,
								flightNumber: flight.flightNumber,
								origin: flight.origin,
								destination: flight.destination,
								departureTime: flight.departureTime,
								arrivalTime: flight.arrivalTime,
								price: flight.price,
								cabinClass: flight.cabinClass,
								airline: flight.airline,
								cachedAt: new Date().toISOString(),
								source: "price-updater"
							}]
						});
					}
					updated++;
					if (i < 10) {
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				} catch (error) {
					logger.error(`[PriceUpdater] Failed to update ${flightId}: ${error}`);
					errors++;
				}
			}
			return { updated, notFound, errors, total: 10 };
		});

		return result;
	}
});

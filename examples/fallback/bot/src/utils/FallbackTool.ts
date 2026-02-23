import { Autonomous, z } from "@botpress/runtime";

type FallbackHandler<TInput, TOutput> = {
	name: string;
	handler: (input: TInput) => Promise<TOutput>;
};

type FallbackToolConfig<TInput extends z.ZodType, TOutput extends z.ZodType> = {
	name: string;
	description: string;
	input: TInput;
	output: TOutput;
};

export class FallbackTool<
	TInput extends z.ZodType,
	TOutput extends z.ZodType,
> {
	private config: FallbackToolConfig<TInput, TOutput>;
	private fallbacks: FallbackHandler<z.infer<TInput>, z.infer<TOutput>>[] = [];

	constructor(config: FallbackToolConfig<TInput, TOutput>) {
		this.config = config;
	}

	addFallback(
		name: string,
		handler: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>,
	): this {
		this.fallbacks.push({ name, handler });
		return this;
	}

	build() {
		const fallbacks = this.fallbacks;

		return new Autonomous.Tool({
			name: this.config.name,
			description: this.config.description,
			input: this.config.input,
			output: this.config.output,
			handler: async (input) => {
				for (const fb of fallbacks) {
					try {
						const result = await fb.handler(input);
						if (result && (result as any).success) {
							return { ...result, source: fb.name };
						}
					} catch {
						continue;
					}
				}

				return {
					success: false,
					error: "All sources failed",
					attemptedSources: fallbacks.map((f) => f.name),
				};
			},
		});
	}
}

import { z } from "@botpress/runtime";
import { parseTrigger } from "../utils/event-guards";
import { PartialHandler } from "./types";

type ActionDefinition<
  TName extends string,
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
> = {
  type: TName;
  input: TInput;
  output: TOutput;
};

type AInput<T> =
  T extends ActionDefinition<string, infer TI, z.ZodTypeAny> ? TI : never;

type AOutput<T> =
  T extends ActionDefinition<string, z.ZodTypeAny, infer TO> ? TO : never;

function createAction<
  TName extends string,
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
>(props: {
  name: TName;
  input: TInput;
  output: TOutput;
}): ActionDefinition<TName, TInput, TOutput> {
  return {
    type: props.name,
    input: props.input,
    output: props.output,
  };
}

const IncrementAction = createAction({
  name: "action:increment",
  input: z.object({
    count: z.number().default(1),
  }),
  output: z.object({
    newCount: z.number(),
  }),
});

export const frontendActions: PartialHandler = async (props) => {
  const parsed = parseTrigger(props.event, Actions);
  if (!parsed) {
    return { handled: false };
  }

  console.log("Frontend action event received:", parsed);

  return { handled: true, continue: false };
};

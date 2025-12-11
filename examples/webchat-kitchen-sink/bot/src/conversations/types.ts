import { Conversation, Primitives } from "@botpress/runtime";
import { type Webchat } from "./index";

type ExtractTypes =
  typeof Webchat extends Conversation<infer C, infer S, infer E>
    ? { channel: C; state: S; events: E }
    : never;

export type ConversationHandlerProps = Primitives.Conversation.HandlerProps<
  ExtractTypes["channel"],
  ExtractTypes["state"],
  ExtractTypes["events"]
>;

export type ConversationHandlerResult =
  | {
      handled: true;
      continue: boolean;
    }
  | {
      handled: false;
    };

export type PartialHandler = (
  props: ConversationHandlerProps
) => Promise<ConversationHandlerResult>;

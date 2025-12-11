import { DemoHeader } from "@/components/layout/DemoHeader";
import { WebchatProvider } from "@/providers/WebchatProvider";

function BotRequestsContent() {
  return (
    <>
      <DemoHeader
        title="Bot Requests"
        description="Handle requests from the bot that require user action"
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Demo content will go here */}
      </div>
    </>
  );
}

export function BotRequestsDemo() {
  return (
    <WebchatProvider demoId="bot-requests">
      <BotRequestsContent />
    </WebchatProvider>
  );
}

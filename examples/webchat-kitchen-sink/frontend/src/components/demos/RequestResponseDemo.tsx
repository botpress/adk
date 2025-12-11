import { DemoHeader } from "@/components/layout/DemoHeader";
import { WebchatProvider } from "@/providers/WebchatProvider";

function RequestResponseContent() {
  return (
    <>
      <DemoHeader
        title="Request/Response"
        description="Send messages and wait for the bot's response before continuing"
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Demo content will go here */}
      </div>
    </>
  );
}

export function RequestResponseDemo() {
  return (
    <WebchatProvider demoId="request-response">
      <RequestResponseContent />
    </WebchatProvider>
  );
}

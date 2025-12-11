import { DemoHeader } from "@/components/layout/DemoHeader";
import { WebchatProvider } from "@/providers/WebchatProvider";

function FireAndForgetContent() {
  return (
    <>
      <DemoHeader
        title="Fire & Forget"
        description="Send messages to the bot without waiting for a response"
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Demo content will go here */}
      </div>
    </>
  );
}

export function FireAndForgetDemo() {
  return (
    <WebchatProvider demoId="fire-and-forget">
      <FireAndForgetContent />
    </WebchatProvider>
  );
}

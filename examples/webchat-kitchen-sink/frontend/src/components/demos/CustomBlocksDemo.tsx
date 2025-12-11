import { DemoHeader } from "@/components/layout/DemoHeader";
import { WebchatProvider } from "@/providers/WebchatProvider";

function CustomBlocksContent() {
  return (
    <>
      <DemoHeader
        title="Custom Blocks"
        description="Render custom UI components based on bot messages"
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Demo content will go here */}
      </div>
    </>
  );
}

export function CustomBlocksDemo() {
  return (
    <WebchatProvider demoId="custom-blocks">
      <CustomBlocksContent />
    </WebchatProvider>
  );
}

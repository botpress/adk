import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useWebchatDemo } from "@/providers/WebchatProvider";

interface DemoHeaderProps {
  title: string;
  description: string;
}

export function DemoHeader({ title, description }: DemoHeaderProps) {
  const { clientState, messages, newConversation } = useWebchatDemo();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger size="lg" />
      <div className="flex flex-1 flex-col">
        <h1 className="text-sm font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div
          className={`size-2 rounded-full ${
            clientState === "connected"
              ? "bg-green-500"
              : clientState === "error"
                ? "bg-red-500"
                : "bg-yellow-500"
          }`}
          title={clientState}
        />
        {/* Message count badge */}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {messages.length}
        </span>
        {/* New conversation button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => newConversation()}
          title="New Conversation"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </header>
  );
}

import type { IntegrationMessage } from "@botpress/webchat";
import {
  Composer,
  Container,
  MessageList,
  StylesheetProvider,
  useWebchat,
} from "@botpress/webchat";
import * as React from "react";
import "./App.css";
import adkLogo from "./assets/ADK.svg";
import CustomTextRenderer from "./components/CustomTextRenderer";
import TextRenderer from "./components/TextRenderer";
import { BOT_CONFIG, CLIENT_ID } from "./config/constants";
import { BrandProvider } from "./context/BrandContext";
import { BrandDataProvider } from "./context/BrandDataContext";
import { useEnrichedMessages } from "./hooks/useEnrichedMessages";
import { useBrandPolling } from "./hooks/useBrandPolling";

function AppContent() {
  const {
    client,
    messages,
    isTyping,
    user,
    clientState,
    newConversation,
    conversationId,
  } = useWebchat({
    clientId: CLIENT_ID,
  });

  // Track connection and message state
  const isLoading = clientState === "connecting" || clientState === "disconnected";
  const hasMessages = messages.length > 0;

  // Set up polling for in-progress brand extraction messages
  useBrandPolling({
    messages,
    conversationId,
    clientId: CLIENT_ID,
    userId: user?.userToken,
  });

  const enrichedMessages = useEnrichedMessages(messages, user?.userId);

  // Auto-focus input on first render
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const composerInput = document.querySelector(
        'textarea[placeholder*="Ask"]'
      ) as HTMLTextAreaElement;
      if (composerInput) {
        composerInput.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Focus input on "/" key
  React.useEffect(() => {
    const handleSlashKey = (e: KeyboardEvent) => {
      // Only trigger if not already focused on an input
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        // Find and focus the composer input
        const composerInput = document.querySelector(
          'textarea[placeholder*="Ask"]'
        ) as HTMLTextAreaElement;
        if (composerInput) {
          composerInput.focus();
        }
      }
    };

    document.addEventListener("keydown", handleSlashKey);
    return () => document.removeEventListener("keydown", handleSlashKey);
  }, []);

  const sendMessage = async (payload: IntegrationMessage["payload"]) => {
    if (!client) return;

    try {
      await client.sendMessage(payload);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className={`chat-wrapper ${isLoading ? "is-loading" : hasMessages ? "has-messages" : "empty-state"}`}
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          minWidth: 0,
        }}
      >
        <Container
          connected={clientState !== "disconnected"}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
          }}
        >
          {/* Restart conversation button */}
          <button
            onClick={() => {
              newConversation();
              setTimeout(() => {
                const composerInput = document.querySelector(
                  'textarea[placeholder*="Ask"]'
                ) as HTMLTextAreaElement;
                if (composerInput) {
                  composerInput.focus();
                }
              }, 100);
            }}
            className="restart-button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            New
          </button>
          {/* Loading spinner */}
          {isLoading && (
            <div className="loading-spinner">
              <div className="spinner" />
            </div>
          )}
          {/* Empty state title */}
          <div className="empty-state-title">
            <a href="https://botpress.com/docs/for-developers/adk/overview" target="_blank" rel="noopener noreferrer">
              <img src={adkLogo} alt="ADK" className="adk-logo" />
            </a>
            <h1>Extract brand colors</h1>
          </div>
          {/* Suggestion buttons */}
          <div className="suggestion-buttons">
            {[
              "Extract branding from linear.app",
              "Get brand colors for Notion",
              "Extract colors from vercel.com",
            ].map((suggestion) => (
              <button
                key={suggestion}
                className="suggestion-button"
                onClick={() => sendMessage({ type: "text", text: suggestion })}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <MessageList
            botName={BOT_CONFIG.name}
            botDescription={BOT_CONFIG.description}
            isTyping={isTyping}
            showMessageStatus={true}
            showMarquee={true}
            messages={enrichedMessages}
            sendMessage={sendMessage}
            renderers={{
              bubble: TextRenderer,
              custom: CustomTextRenderer,
            }}
          />
          <Composer
            disableComposer={false}
            isReadOnly={false}
            allowFileUpload={true}
            uploadFile={client?.uploadFile}
            connected={clientState !== "disconnected"}
            sendMessage={sendMessage}
            composerPlaceholder="Enter a company name or website URL..."
          />
        </Container>
        <div className="composer-footer-text">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span>
            This is a demo agent built on the Botpress ADK.{" "}
            <a
              href="https://github.com/botpress/adk/tree/main/examples/brand-extractor"
              target="_blank"
              rel="noopener noreferrer"
            >
              View source
            </a>
          </span>
        </div>
        <StylesheetProvider
          radius={1.5}
          fontFamily="Inter"
          variant="solid"
          color="#0090FF"
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrandDataProvider>
      <BrandProvider>
        <AppContent />
      </BrandProvider>
    </BrandDataProvider>
  );
}

export default App;

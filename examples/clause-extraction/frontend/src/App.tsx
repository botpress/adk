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
import CustomMessageRenderer from "./components/CustomMessageRenderer";
import ClauseDetailPanel from "./components/ClauseDetailPanel";
import ClauseDetailModal from "./components/ClauseDetailModal";
import { BOT_CONFIG, CLIENT_ID } from "./config/constants";
import {
  ExtractionProvider,
  useExtraction,
} from "./context/ExtractionContext";
import { ExtractionDataProvider } from "./context/ExtractionDataContext";
import { useExtractionPolling } from "./hooks/useExtractionPolling";

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

  // Set up polling for in-progress extraction messages
  useExtractionPolling({
    messages,
    conversationId,
    clientId: CLIENT_ID,
    userId: user?.userToken,
  });

  const { extractionData, isPanelOpen, isModalOpen, selectedClause, closePanel, closeModal } =
    useExtraction();

  // Auto-focus input on first render
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const composerInput = document.querySelector(
        'textarea[placeholder*="Upload"]'
      ) as HTMLTextAreaElement;
      if (composerInput) {
        composerInput.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
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
          transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          marginRight: isPanelOpen ? "340px" : "0",
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
                  'textarea[placeholder*="Upload"]'
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
            <h1>Contract Clause Extraction</h1>
          </div>
          <MessageList
            botName={BOT_CONFIG.name}
            botDescription={BOT_CONFIG.description}
            isTyping={isTyping}
            showMessageStatus={true}
            showMarquee={true}
            messages={messages}
            sendMessage={sendMessage}
            renderers={{
              custom: CustomMessageRenderer,
            }}
          />
          <Composer
            disableComposer={false}
            isReadOnly={false}
            allowFileUpload={true}
            uploadFile={client?.uploadFile}
            connected={clientState !== "disconnected"}
            sendMessage={sendMessage}
            composerPlaceholder="Upload a contract document..."
          />
        </Container>
        <StylesheetProvider
          radius={1.5}
          fontFamily="Inter"
          variant="solid"
          color="#0090FF"
        />
      </div>

      {/* Side Panel for extraction details */}
      {extractionData && (
        <ClauseDetailPanel
          data={extractionData}
          isOpen={isPanelOpen}
          onClose={closePanel}
        />
      )}

      {/* Modal for clause details */}
      {selectedClause && (
        <ClauseDetailModal
          clause={selectedClause}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ExtractionDataProvider>
      <ExtractionProvider>
        <AppContent />
      </ExtractionProvider>
    </ExtractionDataProvider>
  );
}

export default App;

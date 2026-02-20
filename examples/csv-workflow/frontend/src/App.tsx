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
import CsvEditorModal from "./components/CsvEditorModal";
import CustomTextRenderer from "./components/CustomTextRenderer";
import ImportPanel from "./components/ImportPanel";
import ImportSummaryModal from "./components/ImportSummaryModal";
import SchemaSelector from "./components/SchemaSelector";
import TextRenderer from "./components/TextRenderer";
import { BOT_CONFIG, CLIENT_ID } from "./config/constants";
import {
  ImportProvider,
  useImportContext,
} from "./context/ImportContext";
import { ImportDataProvider } from "./context/ImportDataContext";
import { useEnrichedMessages } from "./hooks/useEnrichedMessages";
import { useIsMobile } from "./hooks/useIsMobile";
import { useImportPolling } from "./hooks/useImportPolling";
import { SendMessageProvider } from "./context/SendMessageContext";
import { SCHEMAS } from "./types/schemas";
import type { ImportSchema } from "./types/schemas";

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

  const isLoading = clientState === "connecting" || clientState === "disconnected";
  const hasMessages = messages.length > 0;

  useImportPolling({
    messages,
    conversationId,
    clientId: CLIENT_ID,
    userId: user?.userToken,
  });

  const enrichedMessages = useEnrichedMessages(messages, user?.userId);
  const { importData, isOpen, isSummaryOpen, closePanel, closeSummary } =
    useImportContext();
  const isMobile = useIsMobile(1024);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [editorSchema, setEditorSchema] = React.useState<ImportSchema | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const composerInput = document.querySelector(
        'textarea[placeholder*="message"]'
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    try {
      const uploaded = await client.uploadFile(file);
      await client.sendMessage({
        type: "file",
        fileUrl: uploaded.fileUrl,
        title: file.name,
      } as any);
    } catch (error) {
      console.error("Failed to upload file:", error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSchemaSelect = (schemaKey: string) => {
    const schema = SCHEMAS[schemaKey];
    if (schema) {
      setEditorSchema(schema);
      setEditorOpen(true);
    }
  };

  const handleEditorImport = async (csvContent: string, fileName: string) => {
    if (!client) return;

    setEditorOpen(false);
    setEditorSchema(null);

    try {
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = new File([blob], fileName, { type: "text/csv" });
      const uploaded = await client.uploadFile(file);

      await client.sendMessage({
        type: "file",
        fileUrl: uploaded.fileUrl,
        title: fileName,
      } as any);
    } catch (error) {
      console.error("Failed to upload CSV from editor:", error);
    }
  };

  return (
    <SendMessageProvider sendMessage={sendMessage}>
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100dvh",
        position: "relative",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className={`chat-wrapper ${isLoading ? "is-loading" : hasMessages ? "has-messages" : "empty-state"}`}
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          marginRight: isOpen && !isMobile ? "340px" : "0",
          minWidth: 0,
        }}
      >
        <Container
          connected={clientState !== "disconnected"}
          allowFileUpload={true}
          uploadFile={client?.uploadFile}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
          }}
        >
          <button
            onClick={() => {
              closePanel();
              closeSummary();
              newConversation();
              setTimeout(() => {
                const composerInput = document.querySelector(
                  'textarea[placeholder*="message"]'
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
          {isLoading && (
            <div className="loading-spinner">
              <div className="spinner" />
            </div>
          )}
          <div className="empty-state-title">
            <a href="https://github.com/botpress/adk/tree/main/examples" target="_blank" rel="noopener noreferrer">
              <img src={adkLogo} alt="ADK" className="adk-logo" />
            </a>
            <h1>CSV Import Pipeline</h1>
            <p className="empty-state-subtitle">
              A multi-step workflow that parses, validates, and imports CSV data into <a href="https://botpress.com/docs/adk/concepts/tables" target="_blank" rel="noopener noreferrer">Botpress Tables</a>.
            </p>
          </div>
          <div className="upload-cta-area">
            <SchemaSelector
              selectedSchema={null}
              onSelect={handleSchemaSelect}
            />
            <div className="upload-divider">
              <span className="upload-divider-line" />
              <span className="upload-divider-text">or</span>
              <span className="upload-divider-line" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <button
              className="upload-cta-button upload-cta-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload your own CSV
            </button>
            <p className="upload-hint">Your CSV must match one of the schemas above.</p>
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
            uploadFile={client?.uploadFile}
            connected={clientState !== "disconnected"}
            sendMessage={sendMessage}
            composerPlaceholder="Type a message…"
          />
        </Container>
        <div className="composer-footer-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span>
            This is a demo agent built on the Botpress ADK.{" "}
            <a href="https://github.com/botpress/adk/tree/main/examples" target="_blank" rel="noopener noreferrer">
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

      {!isMobile && importData && (
        <ImportPanel
          data={importData}
          isOpen={isOpen}
          onClose={closePanel}
        />
      )}

      {importData && (
        <ImportSummaryModal
          data={importData}
          isOpen={isSummaryOpen}
          onClose={closeSummary}
        />
      )}

      {editorSchema && (
        <CsvEditorModal
          schema={editorSchema}
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditorSchema(null);
          }}
          onImport={handleEditorImport}
        />
      )}
    </div>
    </SendMessageProvider>
  );
}

function App() {
  return (
    <ImportDataProvider>
      <ImportProvider>
        <AppContent />
      </ImportProvider>
    </ImportDataProvider>
  );
}

export default App;

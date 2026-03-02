import { useState, useCallback, useRef, useEffect } from "react";
import { useWebchat } from "@botpress/webchat";
import type { Analyzer } from "@/types";
import { parseBackendMessage } from "@/lib/parse-message";
import { useAnalyzerCards } from "@/hooks/use-analyzer-cards";
import { AnalyzerSidebar } from "@/components/analyzer-sidebar";
import { FileDropZone } from "@/components/file-drop-zone";
import { AnalyzerModal } from "@/components/analyzer-modal";
import { ChecksModal } from "@/components/checks-modal";

const clientId = import.meta.env.VITE_CLIENT_ID;

function App() {
  const [analyzers, setAnalyzers] = useState<Analyzer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const conversationCreated = useRef(false);

  const { client, clientState, newConversation, on } = useWebchat({ clientId });
  const {
    cards,
    handleWorkflowRequest,
    markAnalyzing,
    handleSuccess,
    handleFailure,
  } = useAnalyzerCards();

  const [checksModalOpen, setChecksModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedCard = selectedCardId ? cards.get(selectedCardId) : undefined;

  useEffect(() => {
    if (clientState === "connected" && !conversationCreated.current) {
      conversationCreated.current = true;
      newConversation();
    }
  }, [clientState, newConversation]);

  useEffect(() => {
    const unsubscribe = on("message", (event) => {
      console.log("runs", event.block);
      if (event.block.type !== "bubble") return;
      if (event.block.block.type !== "text") return;

      console.log(event.block.block.text);
      const parsed = parseBackendMessage(event.block.block.text);
      console.log(parsed);
      if (!parsed) return;

      switch (parsed.type) {
        case "workflow_request": {
          const analyzer = analyzers.find((a) => a.id === parsed.id);
          handleWorkflowRequest(
            parsed.id,
            analyzer?.title ?? "Analysis",
            parsed.checks,
          );
          break;
        }
        case "workflow_success":
          handleSuccess(parsed.id, parsed.title, parsed.results);
          break;
        case "workflow_failure":
          handleFailure(parsed.id);
          break;
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [on, analyzers, handleFailure, handleSuccess, handleWorkflowRequest]);

  const handleRunAnalysis = useCallback(async () => {
    if (!file || !client) return;
    setIsAnalyzing(true);
    try {
      const uploaded = await client.uploadFile(file);
      if (uploaded.type === "image") {
        await client.sendMessage({ type: "image", imageUrl: uploaded.fileUrl });
      } else {
        await client.sendMessage({
          type: "file",
          fileUrl: uploaded.fileUrl,
          title: uploaded.name,
        });
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, client]);

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setNewTitle("");
    setNewInstructions("");
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((analyzer: Analyzer) => {
    setEditingId(analyzer.id);
    setNewTitle(analyzer.title);
    setNewInstructions(analyzer.instructions);
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!newTitle.trim()) return;
    const title = newTitle.trim();
    const instructions = newInstructions.trim();
    let id: string;
    if (editingId) {
      id = editingId;
      setAnalyzers((prev) =>
        prev.map((a) =>
          a.id === editingId ? { ...a, title, instructions } : a,
        ),
      );
    } else {
      id = crypto.randomUUID();
      setAnalyzers((prev) => [...prev, { id, title, instructions }]);
    }
    client?.sendEvent({
      type: "upsertAnalyzer",
      id,
      name: title,
      instructions,
    });
    setNewTitle("");
    setNewInstructions("");
    setEditingId(null);
    setModalOpen(false);
  }, [newTitle, newInstructions, editingId, client]);

  const handleDelete = useCallback((id: string) => {
    setAnalyzers((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleCardClick = useCallback((analyzerId: string) => {
    setSelectedCardId(analyzerId);
    setChecksModalOpen(true);
  }, []);

  const handleConfirmChecks = useCallback(
    (analyzerId: string, checks: string[]) => {
      client?.sendEvent({ type: "confirmAnalysis", id: analyzerId, checks });
      markAnalyzing(analyzerId);
    },
    [client, markAnalyzing],
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-[15vh] shrink-0 flex items-center justify-center border-b border-border bg-card/50">
        <h1 className="text-4xl font-light tracking-[0.25em] uppercase text-foreground">Document Analyzer</h1>
      </header>

      <FileDropZone
        file={file}
        onFileChange={setFile}
        onRunAnalysis={handleRunAnalysis}
        isAnalyzing={isAnalyzing}
        isConnected={clientState === "connected"}
        hasActiveCards={Array.from(cards.values()).some(
          (c) => c.status === "pending_checks" || c.status === "analyzing",
        )}
      />

      <AnalyzerSidebar
        analyzers={analyzers}
        cards={cards}
        onAddAnalyzer={openCreateModal}
        onEditAnalyzer={openEditModal}
        onDeleteAnalyzer={handleDelete}
        onCardClick={handleCardClick}
      />

      <AnalyzerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
        title={newTitle}
        instructions={newInstructions}
        onTitleChange={setNewTitle}
        onInstructionsChange={setNewInstructions}
        onSave={handleSave}
      />

      <ChecksModal
        key={selectedCardId}
        open={checksModalOpen}
        onOpenChange={setChecksModalOpen}
        card={selectedCard}
        onConfirm={handleConfirmChecks}
      />
    </div>
  );
}

export default App;

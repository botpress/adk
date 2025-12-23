import {
  createContext,
  useContext,
  useState,
  useCallback,
  type FC,
  type ReactNode,
} from "react";
import type { ExtractionData, Clause } from "../types/extraction";

type ExtractionContextType = {
  extractionData: ExtractionData | null;
  isPanelOpen: boolean;
  isModalOpen: boolean;
  currentMessageId: string | null;
  selectedClause: Clause | null;
  openPanel: (data: ExtractionData, messageId: string) => void;
  closePanel: () => void;
  openModal: (clause: Clause) => void;
  closeModal: () => void;
  selectClause: (clause: Clause | null) => void;
};

const ExtractionContext = createContext<ExtractionContextType | undefined>(
  undefined
);

export const useExtraction = () => {
  const context = useContext(ExtractionContext);
  if (!context) {
    throw new Error("useExtraction must be used within ExtractionProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const ExtractionProvider: FC<Props> = ({ children }) => {
  const [extractionData, setExtractionData] = useState<ExtractionData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);

  const openPanel = useCallback((data: ExtractionData, messageId: string) => {
    setExtractionData(data);
    setCurrentMessageId(messageId);
    setIsPanelOpen(true);
    setIsModalOpen(false);
    setSelectedClause(null);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setTimeout(() => {
      if (!isModalOpen) {
        setExtractionData(null);
        setCurrentMessageId(null);
        setSelectedClause(null);
      }
    }, 300);
  }, [isModalOpen]);

  const openModal = useCallback((clause: Clause) => {
    setSelectedClause(clause);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedClause(null);
  }, []);

  const selectClause = useCallback((clause: Clause | null) => {
    setSelectedClause(clause);
  }, []);

  return (
    <ExtractionContext.Provider
      value={{
        extractionData,
        isPanelOpen,
        isModalOpen,
        currentMessageId,
        selectedClause,
        openPanel,
        closePanel,
        openModal,
        closeModal,
        selectClause,
      }}
    >
      {children}
    </ExtractionContext.Provider>
  );
};

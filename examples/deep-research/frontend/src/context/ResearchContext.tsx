/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type FC,
  type ReactNode,
} from "react";
import type { ResearchData } from "../types/research";

type ResearchContextType = {
  researchData: ResearchData | null;
  isOpen: boolean;
  isModalOpen: boolean;
  currentMessageId: string | null;
  openResearch: (data: ResearchData, messageId: string) => void;
  openReportModal: (data: ResearchData, messageId: string) => void;
  closeResearch: () => void;
  closeModal: () => void;
};

const ResearchContext = createContext<ResearchContextType | undefined>(
  undefined
);

export const useResearchContext = () => {
  const context = useContext(ResearchContext);
  if (!context) {
    throw new Error("useResearchContext must be used within ResearchProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const ResearchProvider: FC<Props> = ({ children }) => {
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  // Open side panel (for in-progress research)
  const openResearch = useCallback((data: ResearchData, messageId: string) => {
    setResearchData(data);
    setCurrentMessageId(messageId);
    setIsOpen(true);
    setIsModalOpen(false);
  }, []);

  // Open modal (for completed reports)
  const openReportModal = useCallback(
    (data: ResearchData, messageId: string) => {
      setResearchData(data);
      setCurrentMessageId(messageId);
      setIsModalOpen(true);
      setIsOpen(false);
    },
    []
  );

  // Close side panel
  const closeResearch = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      if (!isModalOpen) {
        setResearchData(null);
        setCurrentMessageId(null);
      }
    }, 300);
  }, [isModalOpen]);

  // Close modal
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => {
      if (!isOpen) {
        setResearchData(null);
        setCurrentMessageId(null);
      }
    }, 300);
  }, [isOpen]);

  return (
    <ResearchContext.Provider
      value={{
        researchData,
        isOpen,
        isModalOpen,
        currentMessageId,
        openResearch,
        openReportModal,
        closeResearch,
        closeModal,
      }}
    >
      {children}
    </ResearchContext.Provider>
  );
};

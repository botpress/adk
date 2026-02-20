/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type FC,
  type ReactNode,
} from "react";
import type { ImportData } from "../types/import";

type ImportContextType = {
  importData: ImportData | null;
  isOpen: boolean;
  isSummaryOpen: boolean;
  currentMessageId: string | null;
  openImportPanel: (data: ImportData, messageId: string) => void;
  openImportSummary: (data: ImportData, messageId: string) => void;
  closePanel: () => void;
  closeSummary: () => void;
};

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export const useImportContext = () => {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error("useImportContext must be used within ImportProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const ImportProvider: FC<Props> = ({ children }) => {
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const openImportPanel = useCallback((data: ImportData, messageId: string) => {
    setImportData(data);
    setCurrentMessageId(messageId);
    setIsOpen(true);
    setIsSummaryOpen(false);
  }, []);

  const openImportSummary = useCallback(
    (data: ImportData, messageId: string) => {
      setImportData(data);
      setCurrentMessageId(messageId);
      setIsSummaryOpen(true);
      setIsOpen(false);
    },
    []
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      if (!isSummaryOpen) {
        setImportData(null);
        setCurrentMessageId(null);
      }
    }, 300);
  }, [isSummaryOpen]);

  const closeSummary = useCallback(() => {
    setIsSummaryOpen(false);
    setTimeout(() => {
      if (!isOpen) {
        setImportData(null);
        setCurrentMessageId(null);
      }
    }, 300);
  }, [isOpen]);

  return (
    <ImportContext.Provider
      value={{
        importData,
        isOpen,
        isSummaryOpen,
        currentMessageId,
        openImportPanel,
        openImportSummary,
        closePanel,
        closeSummary,
      }}
    >
      {children}
    </ImportContext.Provider>
  );
};

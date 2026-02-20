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

type ImportDataContextType = {
  importMessages: Map<string, ImportData>;
  updateImportMessage: (messageId: string, data: ImportData) => void;
  getImportMessage: (messageId: string) => ImportData | undefined;
};

const ImportDataContext = createContext<ImportDataContextType | undefined>(
  undefined
);

export const useImportData = () => {
  const context = useContext(ImportDataContext);
  if (!context) {
    throw new Error("useImportData must be used within ImportDataProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const ImportDataProvider: FC<Props> = ({ children }) => {
  const [importMessages, setImportMessages] = useState<
    Map<string, ImportData>
  >(new Map());

  const updateImportMessage = useCallback(
    (messageId: string, data: ImportData) => {
      setImportMessages((prev) => {
        const next = new Map(prev);
        next.set(messageId, data);
        return next;
      });
    },
    []
  );

  const getImportMessage = useCallback(
    (messageId: string) => {
      return importMessages.get(messageId);
    },
    [importMessages]
  );

  return (
    <ImportDataContext.Provider
      value={{ importMessages, updateImportMessage, getImportMessage }}
    >
      {children}
    </ImportDataContext.Provider>
  );
};

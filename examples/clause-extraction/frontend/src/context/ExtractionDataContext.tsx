import {
  createContext,
  useContext,
  useState,
  useCallback,
  type FC,
  type ReactNode,
} from "react";
import type { ExtractionData } from "../types/extraction";

type ExtractionDataContextType = {
  extractionMessages: Map<string, ExtractionData>;
  updateExtractionData: (messageId: string, data: ExtractionData) => void;
  getExtractionData: (messageId: string) => ExtractionData | undefined;
};

const ExtractionDataContext = createContext<ExtractionDataContextType | undefined>(
  undefined
);

export const useExtractionData = () => {
  const context = useContext(ExtractionDataContext);
  if (!context) {
    throw new Error("useExtractionData must be used within ExtractionDataProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const ExtractionDataProvider: FC<Props> = ({ children }) => {
  const [extractionMessages, setExtractionMessages] = useState<
    Map<string, ExtractionData>
  >(new Map());

  const updateExtractionData = useCallback(
    (messageId: string, data: ExtractionData) => {
      setExtractionMessages((prev) => {
        const next = new Map(prev);
        next.set(messageId, data);
        return next;
      });
    },
    []
  );

  const getExtractionData = useCallback(
    (messageId: string) => {
      return extractionMessages.get(messageId);
    },
    [extractionMessages]
  );

  return (
    <ExtractionDataContext.Provider
      value={{ extractionMessages, updateExtractionData, getExtractionData }}
    >
      {children}
    </ExtractionDataContext.Provider>
  );
};

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

type ResearchDataContextType = {
  researchMessages: Map<string, ResearchData>;
  updateResearchMessage: (messageId: string, data: ResearchData) => void;
  getResearchMessage: (messageId: string) => ResearchData | undefined;
};

const ResearchDataContext = createContext<ResearchDataContextType | undefined>(
  undefined
);

export const useResearchData = () => {
  const context = useContext(ResearchDataContext);
  if (!context) {
    throw new Error("useResearchData must be used within ResearchDataProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const ResearchDataProvider: FC<Props> = ({ children }) => {
  const [researchMessages, setResearchMessages] = useState<
    Map<string, ResearchData>
  >(new Map());

  const updateResearchMessage = useCallback(
    (messageId: string, data: ResearchData) => {
      setResearchMessages((prev) => {
        const next = new Map(prev);
        next.set(messageId, data);
        return next;
      });
    },
    []
  );

  const getResearchMessage = useCallback(
    (messageId: string) => {
      return researchMessages.get(messageId);
    },
    [researchMessages]
  );

  return (
    <ResearchDataContext.Provider
      value={{ researchMessages, updateResearchMessage, getResearchMessage }}
    >
      {children}
    </ResearchDataContext.Provider>
  );
};

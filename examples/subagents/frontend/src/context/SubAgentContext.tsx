import { createContext, useContext, type ReactNode } from "react";
import type { SubAgentStep } from "../hooks/useSubAgentGroups";

type SubAgentContextValue = {
  groups: Map<string, SubAgentStep[]>;
};

const SubAgentContext = createContext<SubAgentContextValue>({
  groups: new Map(),
});

export const SubAgentProvider = ({
  groups,
  children,
}: {
  groups: Map<string, SubAgentStep[]>;
  children: ReactNode;
}) => {
  return (
    <SubAgentContext.Provider value={{ groups }}>
      {children}
    </SubAgentContext.Provider>
  );
};

export const useSubAgentContext = () => useContext(SubAgentContext);

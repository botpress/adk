/**
 * Data Cache Context - stores extraction data by messageId
 *
 * Uses useSyncExternalStore (React 18+) pattern for efficient subscriptions:
 * - Store keeps data in a stable ref, avoiding unnecessary re-renders
 * - Components subscribe to specific messageIds and only re-render when that data changes
 * - Polling updates don't cause cascade re-renders across all consumers
 *
 * This solves the scroll position reset issue where frequent polling updates
 * were causing the entire component tree to re-render.
 */
import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useSyncExternalStore,
  type FC,
  type ReactNode,
} from "react";
import type { ExtractionData } from "../types/extraction";

// Store type for external state management
type ExtractionStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Map<string, ExtractionData>;
  getData: (messageId: string) => ExtractionData | undefined;
  setData: (messageId: string, data: ExtractionData) => void;
};

// Create a store instance
function createExtractionStore(): ExtractionStore {
  const data = new Map<string, ExtractionData>();
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return data;
    },
    getData(messageId: string) {
      return data.get(messageId);
    },
    setData(messageId: string, newData: ExtractionData) {
      const existing = data.get(messageId);
      // Only notify if data actually changed (compare by progress/status to avoid unnecessary updates)
      if (
        !existing ||
        existing.progress !== newData.progress ||
        existing.status !== newData.status ||
        existing.clausesFound !== newData.clausesFound ||
        existing.summary !== newData.summary
      ) {
        data.set(messageId, newData);
        listeners.forEach((listener) => listener());
      }
    },
  };
}

type ExtractionDataContextType = {
  store: ExtractionStore;
};

const ExtractionDataContext = createContext<ExtractionDataContextType | undefined>(
  undefined
);

/**
 * Hook to get extraction data for a specific messageId.
 * Only re-renders when that specific message's data changes.
 */
export const useExtractionMessage = (messageId: string | null): ExtractionData | undefined => {
  const context = useContext(ExtractionDataContext);
  if (!context) {
    throw new Error("useExtractionMessage must be used within ExtractionDataProvider");
  }

  const { store } = context;

  // Subscribe to store changes, but only return data for this messageId
  const data = useSyncExternalStore(
    store.subscribe,
    useCallback(() => (messageId ? store.getData(messageId) : undefined), [store, messageId])
  );

  return data;
};

/**
 * Hook to get the update function. This is stable and won't cause re-renders.
 */
export const useUpdateExtractionData = () => {
  const context = useContext(ExtractionDataContext);
  if (!context) {
    throw new Error("useUpdateExtractionData must be used within ExtractionDataProvider");
  }

  return context.store.setData;
};

type Props = {
  children: ReactNode;
};

export const ExtractionDataProvider: FC<Props> = ({ children }) => {
  // Store is created once and never changes
  const storeRef = useRef<ExtractionStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createExtractionStore();
  }

  return (
    <ExtractionDataContext.Provider value={{ store: storeRef.current }}>
      {children}
    </ExtractionDataContext.Provider>
  );
};

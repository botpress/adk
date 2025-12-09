/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type FC,
  type ReactNode,
} from "react";
import type { BrandProgressData } from "../types/brand";

type BrandContextType = {
  brandData: BrandProgressData | null;
  currentMessageId: string | null;
  setBrandData: (data: BrandProgressData | null, messageId: string | null) => void;
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const useBrandContext = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrandContext must be used within BrandProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const BrandProvider: FC<Props> = ({ children }) => {
  const [brandData, setBrandDataState] = useState<BrandProgressData | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const setBrandData = useCallback(
    (data: BrandProgressData | null, messageId: string | null) => {
      setBrandDataState(data);
      setCurrentMessageId(messageId);
    },
    []
  );

  return (
    <BrandContext.Provider
      value={{
        brandData,
        currentMessageId,
        setBrandData,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
};

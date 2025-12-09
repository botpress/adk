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

type BrandDataContextType = {
  brandMessages: Map<string, BrandProgressData>;
  updateBrandMessage: (messageId: string, data: BrandProgressData) => void;
  getBrandMessage: (messageId: string) => BrandProgressData | undefined;
};

const BrandDataContext = createContext<BrandDataContextType | undefined>(
  undefined
);

export const useBrandData = () => {
  const context = useContext(BrandDataContext);
  if (!context) {
    throw new Error("useBrandData must be used within BrandDataProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

export const BrandDataProvider: FC<Props> = ({ children }) => {
  const [brandMessages, setBrandMessages] = useState<
    Map<string, BrandProgressData>
  >(new Map());

  const updateBrandMessage = useCallback(
    (messageId: string, data: BrandProgressData) => {
      setBrandMessages((prev) => {
        const next = new Map(prev);
        next.set(messageId, data);
        return next;
      });
    },
    []
  );

  const getBrandMessage = useCallback(
    (messageId: string) => {
      return brandMessages.get(messageId);
    },
    [brandMessages]
  );

  return (
    <BrandDataContext.Provider
      value={{ brandMessages, updateBrandMessage, getBrandMessage }}
    >
      {children}
    </BrandDataContext.Provider>
  );
};

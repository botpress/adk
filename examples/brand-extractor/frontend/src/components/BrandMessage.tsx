import { type FC, useEffect, useState } from "react";
import type { BrandProgressData } from "../types/brand";
import { useBrandData } from "../context/BrandDataContext";
import BrandCard from "./BrandCard";

type Props = {
  data: BrandProgressData;
  messageId: string;
};

const BrandMessage: FC<Props> = ({ data: initialData, messageId }) => {
  const { brandMessages, updateBrandMessage } = useBrandData();
  const [data, setData] = useState<BrandProgressData>(initialData);

  // Update local state when context changes
  useEffect(() => {
    const contextData = brandMessages.get(messageId);
    if (contextData) {
      setData(contextData);
    }
  }, [brandMessages, messageId]);

  // Initialize context with initial data
  useEffect(() => {
    updateBrandMessage(messageId, initialData);
  }, [messageId, initialData, updateBrandMessage]);

  return <BrandCard data={data} />;
};

export default BrandMessage;

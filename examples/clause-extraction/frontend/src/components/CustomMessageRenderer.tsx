import { type FC, useEffect, useRef } from "react";
import type { BlockObjects } from "@botpress/webchat";
import ClauseExtractionCard from "./ClauseExtractionCard";
import { useExtraction } from "../context/ExtractionContext";
import { useUpdateExtractionData, useExtractionMessage } from "../context/ExtractionDataContext";
import type { ExtractionData } from "../types/extraction";

type CustomBlockProps = BlockObjects["custom"];

/**
 * Extended custom block props with extraction-specific fields
 * Webchat passes these via the custom block payload
 */
interface CustomBlockWithExtraction extends CustomBlockProps {
  messageId?: string;
  data?: ExtractionData;
}

const CustomMessageRenderer: FC<CustomBlockProps> = (props) => {
  const { openPanel, isPanelOpen } = useExtraction();
  const updateExtractionData = useUpdateExtractionData();
  const hasAutoOpened = useRef<Set<string>>(new Set());

  // Cast to extended type - webchat passes these fields via custom block payload
  const customProps = props as CustomBlockWithExtraction;
  const url = customProps.url || "";
  const data = customProps.data;
  const messageId = customProps.messageId;

  // Subscribe to this specific message's data (selective re-render)
  const cachedData = useExtractionMessage(messageId ?? null);

  // Update store when props data changes (including on initial load/refresh)
  useEffect(() => {
    if (messageId && data) {
      updateExtractionData(messageId, data);
    }
  }, [messageId, data, updateExtractionData]);

  // Auto-open panel on first update for in_progress extractions
  useEffect(() => {
    if (
      messageId &&
      data &&
      data.status === "in_progress" &&
      !isPanelOpen &&
      !hasAutoOpened.current.has(messageId)
    ) {
      hasAutoOpened.current.add(messageId);
      openPanel(data, messageId);
    }
  }, [messageId, data, isPanelOpen, openPanel]);

  // Support both extraction_progress (backend) and clause_extraction (legacy) URLs
  if (url === "custom://extraction_progress" || url === "custom://clause_extraction") {
    // Use cached data from store (for polling updates) or fall back to props data
    const currentData = cachedData || data;

    // Guard against missing data
    if (!currentData) {
      return (
        <div className="p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600">Loading extraction data...</p>
        </div>
      );
    }

    const handleExpand = () => {
      if (messageId && currentData) {
        openPanel(currentData, messageId);
      }
    };

    return <ClauseExtractionCard data={currentData} onExpand={handleExpand} />;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p className="text-sm text-gray-600">Unknown custom block: {url}</p>
    </div>
  );
};

export default CustomMessageRenderer;

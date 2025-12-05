import { type FC, useEffect, useState } from "react";
import type { ResearchData } from "../types/research";
import ResearchCard from "./ResearchCard";
import { useResearchContext } from "../context/ResearchContext";
import { useResearchData } from "../context/ResearchDataContext";

type Props = {
  data: ResearchData;
  messageId?: string;
};

const ResearchMessage: FC<Props> = ({ data: initialData, messageId }) => {
  const { openResearch, openReportModal } = useResearchContext();
  const { researchMessages, updateResearchMessage } = useResearchData();
  const [data, setData] = useState(initialData);

  // Update context with initial data
  useEffect(() => {
    if (messageId) {
      updateResearchMessage(messageId, initialData);
    }
  }, [messageId, initialData, updateResearchMessage]);

  // Subscribe to updates from context
  useEffect(() => {
    if (messageId) {
      const latestData = researchMessages.get(messageId);
      if (latestData) {
        console.log("ResearchCard updating with latest data:", latestData);
        setData(latestData);
      }
    }
  }, [messageId, researchMessages]);

  const handleExpand = () => {
    const id = messageId || "unknown";

    // If completed and has a report, open the modal
    // Otherwise, open the side panel
    if (data.status === "done" && data.result) {
      openReportModal(data, id);
    } else {
      openResearch(data, id);
    }
  };

  return <ResearchCard data={data} onExpand={handleExpand} />;
};

export default ResearchMessage;

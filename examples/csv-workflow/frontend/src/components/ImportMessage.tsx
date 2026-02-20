import { type FC, useEffect, useRef, useState } from "react";
import type { ImportData } from "../types/import";
import ImportCard from "./ImportCard";
import { useImportContext } from "../context/ImportContext";
import { useImportData } from "../context/ImportDataContext";

type Props = {
  data: ImportData;
  messageId?: string;
};

const TERMINAL_STATES = ["done", "errored", "cancelled"];

const ImportMessage: FC<Props> = ({ data: initialData, messageId }) => {
  const { openImportPanel, openImportSummary } = useImportContext();
  const { importMessages, updateImportMessage } = useImportData();
  const [data, setData] = useState(initialData);
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    if (messageId) {
      updateImportMessage(messageId, initialData);
    }
  }, [messageId, initialData, updateImportMessage]);

  useEffect(() => {
    if (messageId) {
      const latestData = importMessages.get(messageId);
      if (latestData) {
        setData(latestData);
      }
    }
  }, [messageId, importMessages]);

  useEffect(() => {
    if (!hasAutoOpened.current && messageId && !TERMINAL_STATES.includes(data.status)) {
      hasAutoOpened.current = true;
      openImportPanel(data, messageId);
    }
  }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevStatusRef = useRef(data.status);
  useEffect(() => {
    if (prevStatusRef.current !== "done" && data.status === "done" && messageId) {
      openImportSummary(data, messageId);
    }
    prevStatusRef.current = data.status;
  }, [data.status, data, messageId, openImportSummary]);

  const handleExpand = () => {
    const id = messageId || "unknown";

    if (data.status === "done" && data.summary) {
      openImportSummary(data, id);
    } else {
      openImportPanel(data, id);
    }
  };

  return <ImportCard data={data} onExpand={handleExpand} />;
};

export default ImportMessage;

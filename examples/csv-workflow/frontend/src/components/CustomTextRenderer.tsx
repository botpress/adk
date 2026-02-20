import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import ImportMessage from "./ImportMessage";
import ActionButtons from "./ActionButtons";
import SampleCsvDownloads from "./SampleCsvDownloads";
import type { SampleSchema } from "./SampleCsvDownloads";
import type { ImportData } from "../types/import";

const CustomTextRenderer: FC<BlockObjects["custom"]> = (props) => {
  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data as Record<string, unknown> | undefined;

  const messageId = (props as { messageId?: string }).messageId;

  if (url === "custom://csv_import_progress" && data) {
    return <ImportMessage data={data as unknown as ImportData} messageId={messageId} />;
  }

  if (url === "custom://action_buttons" && data?.options) {
    return <ActionButtons options={data.options as { label: string; value: string }[]} messageId={messageId} />;
  }

  if (url === "custom://sample_csv_downloads" && data?.schemas) {
    return <SampleCsvDownloads schemas={data.schemas as SampleSchema[]} />;
  }

  return null;
};

export default CustomTextRenderer;

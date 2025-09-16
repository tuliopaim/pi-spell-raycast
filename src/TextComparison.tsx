import { Detail, ActionPanel, Action } from "@raycast/api";

interface TextComparisonProps {
  originalText: string;
  correctedText: string;
  onEditApiKey: () => void;
}

export function TextComparison({ originalText, correctedText, onEditApiKey }: TextComparisonProps) {
  return (
    <Detail
      markdown={`## Original Text\n\n${originalText}\n\n## Corrected Text\n\n${correctedText}`}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Corrected Text"
            content={correctedText}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action title="Edit Api Key" onAction={onEditApiKey} shortcut={{ modifiers: ["cmd"], key: "e" }} />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Original Length" text={originalText.length.toString()} />
          <Detail.Metadata.Label title="Corrected Length" text={correctedText.length.toString()} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Time" text={new Date().toLocaleTimeString()} />
        </Detail.Metadata>
      }
    />
  );
}

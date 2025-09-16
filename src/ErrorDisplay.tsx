import { Detail, ActionPanel, Action } from "@raycast/api";

interface ErrorDisplayProps {
  isLoading: boolean;
  onEditApiKey: () => void;
  errorMessage: string | null;
}

export function ErrorDisplay({ isLoading, errorMessage, onEditApiKey }: ErrorDisplayProps) {
  return (
    <Detail
      markdown={`
## Gemini Spell Checker.

- ⚠️ ${errorMessage} 
`}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Edit Api Key" onAction={onEditApiKey} />
        </ActionPanel>
      }
    />
  );
}

import { Detail, ActionPanel, Action, openCommandPreferences } from "@raycast/api";

interface ErrorDisplayProps {
  isLoading: boolean;
  errorMessage: string | null;
}

export function ErrorDisplay({ isLoading, errorMessage }: ErrorDisplayProps) {
  return (
    <Detail
      markdown={`
## Gemini Spell Checker

- ⚠️ ${errorMessage}
`}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Open Command Preferences" onAction={openCommandPreferences} />
        </ActionPanel>
      }
    />
  );
}

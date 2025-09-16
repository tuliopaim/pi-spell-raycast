import { Detail, ActionPanel, Action } from "@raycast/api";

interface WelcomePageProps {
  isLoading: boolean;
  onEditApiKey: () => void;
  onEnterPress?: () => void;
}

export function WelcomePage({ isLoading, onEditApiKey, onEnterPress }: WelcomePageProps) {
  return (
    <Detail
      markdown={`
## Gemini Spell Checker

Select some text in any application and press Enter to check spelling and grammar.
`}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          {onEnterPress && (
            <Action title="Process Text" onAction={onEnterPress} shortcut={{ modifiers: [], key: "return" }} />
          )}
          <Action title="Edit Api Key" onAction={onEditApiKey} />
        </ActionPanel>
      }
    />
  );
}

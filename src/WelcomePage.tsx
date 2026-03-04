import { Detail, ActionPanel, Action, openCommandPreferences } from "@raycast/api";

interface WelcomePageProps {
  isLoading: boolean;
  message?: string;
}

export function WelcomePage({ isLoading, message }: WelcomePageProps) {
  return (
    <Detail
      markdown={`
## Gemini Spell Checker

${message ?? "Select text in any application and run this command to fix and rewrite it."}
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

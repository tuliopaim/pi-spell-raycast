import { Detail, ActionPanel, Action, openCommandPreferences } from "@raycast/api";

interface WelcomePageProps {
  isLoading: boolean;
  message?: string;
}

export function WelcomePage({ isLoading, message }: WelcomePageProps) {
  const loadingMarkdown = `
# Pi Spell

## Working on it...

${message ?? "Generating suggestions from your clipboard text."}

This can take a few seconds while Pi runs locally.
`;

  const homeMarkdown = `
# Pi Spell

## Let's polish something

${message ?? "Copy any text and run this command to get cleaner, clearer writing."}

### Great for

- Pull request comments
- Slack or email drafts
- Docs and README snippets
- Code comments and commit messages

### What you get

- **Minimal Fix**: spelling and grammar only
- **Neutral Polish**: fluent US English (recommended)
- **Concise Professional**: shorter and sharper wording

### Quick flow

1. Copy text from any app
2. Open **Pi Spell**
3. Choose a suggestion and press **Enter** to copy
`;

  return (
    <Detail
      markdown={isLoading ? loadingMarkdown : homeMarkdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Open Command Preferences" onAction={openCommandPreferences} />
        </ActionPanel>
      }
    />
  );
}

import { Action, ActionPanel, Icon, List, openCommandPreferences } from "@raycast/api";

export type StatusViewProps =
  | { kind: "empty"; onRetry: () => void }
  | { kind: "loading"; originalText: string }
  | { kind: "error"; message: string; onRetry: () => void };

function previewText(text: string, maxLength = 160): string {
  const flattened = text.replace(/\s+/g, " ").trim();
  return flattened.length <= maxLength ? flattened : `${flattened.slice(0, maxLength - 1)}…`;
}

export function StatusView(props: StatusViewProps) {
  const preferencesAction = (
    <Action
      title="Open Command Preferences"
      icon={Icon.Cog}
      onAction={openCommandPreferences}
      shortcut={{ modifiers: ["cmd"], key: "e" }}
    />
  );

  if (props.kind === "loading") {
    return (
      <List
        isLoading
        navigationTitle="Pi Spell"
        searchBarPlaceholder="Rewriting your clipboard text…"
        filtering={false}
      >
        <List.EmptyView
          icon={Icon.Wand}
          title="Rewriting your text…"
          description={previewText(props.originalText) || "Pi is running locally. This takes a few seconds."}
          actions={<ActionPanel>{preferencesAction}</ActionPanel>}
        />
      </List>
    );
  }

  if (props.kind === "error") {
    return (
      <List navigationTitle="Pi Spell" searchBarPlaceholder="Something went wrong" filtering={false}>
        <List.EmptyView
          icon={Icon.Warning}
          title="Couldn't rewrite your text"
          description={props.message}
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={props.onRetry} />
              {preferencesAction}
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List navigationTitle="Pi Spell" searchBarPlaceholder="Waiting for clipboard text" filtering={false}>
      <List.EmptyView
        icon={Icon.Pencil}
        title="Copy some text first"
        description="Pi Spell rewrites whatever is on your clipboard. Copy a message, comment, or draft, then press Enter to try again."
        actions={
          <ActionPanel>
            <Action title="Read Clipboard Again" icon={Icon.ArrowClockwise} onAction={props.onRetry} />
            {preferencesAction}
          </ActionPanel>
        }
      />
    </List>
  );
}

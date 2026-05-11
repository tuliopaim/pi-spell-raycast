import { Action, ActionPanel, List, closeMainWindow, openCommandPreferences } from "@raycast/api";
import type { ProcessingMetrics, SuggestionVariant } from "./pi-spell";

interface TextComparisonProps {
  originalText: string;
  suggestions: SuggestionVariant[];
  metrics: ProcessingMetrics;
}

function getSuggestionPreview(text: string, maxLines = 3): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
  const preview = lines.join(" ");

  if (preview.length <= 220) {
    return preview;
  }

  return `${preview.slice(0, 217)}...`;
}

function getSuggestionLabel(title: string): string {
  return title.replace(" (Recommended)", "");
}

export function TextComparison({ originalText, suggestions, metrics }: TextComparisonProps) {
  const recommendedSuggestionId = (
    suggestions.find((suggestion) => suggestion.recommended) ??
    suggestions[1] ??
    suggestions[0]
  )?.id;
  const orderedSuggestions = [...suggestions].sort(
    (left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended)),
  );

  return (
    <List isShowingDetail filtering={false} selectedItemId={recommendedSuggestionId}>
      {orderedSuggestions.map((suggestion) => (
        <List.Item
          key={suggestion.id}
          id={suggestion.id}
          title={getSuggestionPreview(suggestion.text)}
          accessories={[
            ...(suggestion.recommended ? [{ tag: "Recommended" as const }] : []),
            { text: getSuggestionLabel(suggestion.title) },
          ]}
          detail={
            <List.Item.Detail
              markdown={`## ${suggestion.title}\n\n${suggestion.text}\n\n---\n\n## Original Text\n\n${originalText}`}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Original Length" text={originalText.length.toString()} />
                  <List.Item.Detail.Metadata.Label title="Pi Model" text={metrics.modelResolved} />
                  <List.Item.Detail.Metadata.Label title="Thinking" text={metrics.thinking} />
                  <List.Item.Detail.Metadata.Label title="Latency" text={`${metrics.latencyMs} ms`} />
                  <List.Item.Detail.Metadata.Label title="Attempts" text={metrics.attempts.toString()} />
                  <List.Item.Detail.Metadata.Label title="Status" text={metrics.status} />
                  <List.Item.Detail.Metadata.Label title="Parse Mode" text={metrics.parseMode} />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label
                    title="Processed At"
                    text={new Date(metrics.timestamp).toLocaleString()}
                  />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy and Close"
                content={suggestion.text}
                onCopy={async () => {
                  await closeMainWindow({ clearRootSearch: true });
                }}
              />
              <Action.CopyToClipboard
                title="Copy Without Closing"
                content={suggestion.text}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
              <Action
                title="Open Command Preferences"
                onAction={openCommandPreferences}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

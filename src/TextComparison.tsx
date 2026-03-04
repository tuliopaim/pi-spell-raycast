import { Detail, ActionPanel, Action, openCommandPreferences } from "@raycast/api";
import type { ProcessingMetrics, SuggestionVariant } from "./gemini-spell";

interface TextComparisonProps {
  originalText: string;
  suggestions: SuggestionVariant[];
  metrics: ProcessingMetrics;
}

function suggestionMarkdown(suggestions: SuggestionVariant[]) {
  return suggestions.map((suggestion) => `## ${suggestion.title}\n\n${suggestion.text}`).join("\n\n");
}

export function TextComparison({ originalText, suggestions, metrics }: TextComparisonProps) {
  const recommendedSuggestion =
    suggestions.find((suggestion) => suggestion.recommended) ?? suggestions[1] ?? suggestions[0];

  return (
    <Detail
      markdown={`## Original Text\n\n${originalText}\n\n---\n\n${suggestionMarkdown(suggestions)}`}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Recommended Suggestion"
            content={recommendedSuggestion.text}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          {suggestions.map((suggestion, index) => (
            <Action.CopyToClipboard
              key={suggestion.id}
              title={`Copy ${suggestion.title}`}
              content={suggestion.text}
              shortcut={{ modifiers: ["cmd", "shift"], key: String(index + 1) as "1" | "2" | "3" }}
            />
          ))}
          <Action
            title="Open Command Preferences"
            onAction={openCommandPreferences}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
          />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Original Length" text={originalText.length.toString()} />
          <Detail.Metadata.Label title="Requested Model" text={metrics.modelRequested} />
          <Detail.Metadata.Label title="Resolved Model" text={metrics.modelResolved} />
          <Detail.Metadata.Label title="Latency" text={`${metrics.latencyMs} ms`} />
          <Detail.Metadata.Label title="Attempts" text={metrics.attempts.toString()} />
          <Detail.Metadata.Label title="Status" text={metrics.status} />
          <Detail.Metadata.Label title="Parse Mode" text={metrics.parseMode} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Processed At" text={new Date(metrics.timestamp).toLocaleString()} />
        </Detail.Metadata>
      }
    />
  );
}

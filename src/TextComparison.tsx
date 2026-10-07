import { Action, ActionPanel, Color, Icon, List, closeMainWindow, openCommandPreferences } from "@raycast/api";
import type { ProcessingMetrics, SuggestionVariant } from "./pi-spell";

interface TextComparisonProps {
  originalText: string;
  suggestions: SuggestionVariant[];
  metrics: ProcessingMetrics;
  onRetry: () => void;
}

const VARIANT_STYLE: Record<SuggestionVariant["id"], { icon: Icon; color: Color; label: string; blurb: string }> = {
  neutral_polish: { icon: Icon.Stars, color: Color.Purple, label: "Polished", blurb: "Fluent, natural US English" },
  minimal_fix: { icon: Icon.CheckCircle, color: Color.Green, label: "Minimal", blurb: "Spelling and grammar only" },
  concise_professional: { icon: Icon.Bolt, color: Color.Blue, label: "Concise", blurb: "Shorter and professional" },
};

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatChange(before: number, after: number): { value: string; color?: Color } {
  const delta = after - before;
  if (delta === 0) {
    return { value: `${after} (no change)` };
  }

  return {
    value: `${before} → ${after} (${delta > 0 ? "+" : ""}${delta})`,
    color: delta < 0 ? Color.Green : Color.Orange,
  };
}

function formatLatency(latencyMs: number): string {
  return latencyMs < 1000 ? `${latencyMs} ms` : `${(latencyMs / 1000).toFixed(1)} s`;
}

export function TextComparison({ originalText, suggestions, metrics, onRetry }: TextComparisonProps) {
  const isFallback = metrics.parseMode === "fallback";
  // Fallback parsing repeats the same raw output for every variant, so show it once.
  const visibleSuggestions = isFallback
    ? suggestions.slice(0, 1)
    : [...suggestions].sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended)));
  const originalWords = countWords(originalText);

  const sharedActions = (
    <>
      <Action
        title="Try Again"
        icon={Icon.ArrowClockwise}
        onAction={onRetry}
        shortcut={{ modifiers: ["cmd"], key: "r" }}
      />
      <Action
        title="Open Command Preferences"
        icon={Icon.Cog}
        onAction={openCommandPreferences}
        shortcut={{ modifiers: ["cmd"], key: "e" }}
      />
    </>
  );

  return (
    <List
      isShowingDetail
      filtering={false}
      navigationTitle="Pi Spell"
      searchBarPlaceholder="Pick a version and press Enter to copy"
      selectedItemId={visibleSuggestions[0]?.id}
    >
      <List.Section title={isFallback ? "Pi Output" : "Suggestions"}>
        {visibleSuggestions.map((suggestion) => {
          const style = VARIANT_STYLE[suggestion.id];
          const title = isFallback ? "Raw Output" : style.label;
          const words = formatChange(originalWords, countWords(suggestion.text));
          const characters = formatChange(originalText.length, suggestion.text.length);

          return (
            <List.Item
              key={suggestion.id}
              id={suggestion.id}
              icon={{
                source: isFallback ? Icon.Warning : style.icon,
                tintColor: isFallback ? Color.Orange : style.color,
              }}
              title={title}
              accessories={
                suggestion.recommended && !isFallback ? [{ tag: { value: "Best", color: style.color } }] : []
              }
              detail={
                <List.Item.Detail
                  markdown={`${suggestion.text}\n\n---\n\n**Original**\n\n${originalText}`}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.TagList title="Style">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={isFallback ? "Unparsed" : style.label}
                          color={isFallback ? Color.Orange : style.color}
                        />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label
                        title="About"
                        text={isFallback ? "Pi did not return JSON; showing its raw reply" : style.blurb}
                      />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label title="Words" text={words} />
                      <List.Item.Detail.Metadata.Label title="Characters" text={characters} />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label title="Model" text={metrics.modelResolved} />
                      <List.Item.Detail.Metadata.Label title="Thinking" text={metrics.thinking} />
                      <List.Item.Detail.Metadata.Label title="Took" text={formatLatency(metrics.latencyMs)} />
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
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
                  </ActionPanel.Section>
                  <ActionPanel.Section>{sharedActions}</ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

import { getPreferenceValues, getSelectedText, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { ErrorDisplay } from "./ErrorDisplay";
import { TextComparison } from "./TextComparison";
import { WelcomePage } from "./WelcomePage";

const SYSTEM_INSTRUCTION = `You are a writing assistant for a Brazilian software engineer working with a US team.
Return only valid JSON.
Use US English.
Do not add explanations, markdown, or extra keys.`;

const MODEL_FALLBACK_CHAIN = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

type SuggestionVariantId = "minimal_fix" | "neutral_polish" | "concise_professional";
type ParseMode = "json" | "fallback";

type ProcessingStatus = "success" | "success_with_fallback_parse";

export interface CommandPreferences {
  googleApiKey: string;
  defaultModel: string;
  requestTimeoutMs: string;
  maxRetries: string;
  debugLogs: boolean;
}

export interface SuggestionVariant {
  id: SuggestionVariantId;
  title: string;
  text: string;
  recommended?: boolean;
}

export interface ProcessingMetrics {
  modelRequested: string;
  modelResolved: string;
  latencyMs: number;
  attempts: number;
  status: ProcessingStatus;
  parseMode: ParseMode;
  timestamp: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

class GeminiRequestError extends Error {
  statusCode?: number;
  retryable: boolean;
  modelUnavailable: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      retryable?: boolean;
      modelUnavailable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "GeminiRequestError";
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.modelUnavailable = options.modelUnavailable ?? false;
  }
}

interface ProcessResult {
  suggestions: SuggestionVariant[];
  metrics: ProcessingMetrics;
}

function logEvent(debugLogs: boolean, event: string, payload: Record<string, unknown>) {
  if (!debugLogs) {
    return;
  }

  console.log(`[gemini-spell] ${event} ${JSON.stringify(payload)}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(raw: string, defaultValue: number, minValue: number, maxValue: number): number {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    return defaultValue;
  }

  return Math.max(minValue, Math.min(maxValue, value));
}

function looksLikeRuntimeStackTrace(text: string): boolean {
  const hasStackFrame = /\bat\s.+\(.+:\d+:\d+\)/.test(text);
  const hasRuntimeMarkers =
    /React\.jsx: type is invalid|Error Component Stack|node_modules\/@raycast\/api|raycast\/extensions\/gemini-spell/i.test(
      text,
    );

  return hasStackFrame && hasRuntimeMarkers;
}

function stripCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  const directFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (directFenceMatch?.[1]) {
    return directFenceMatch[1].trim();
  }

  const firstFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (firstFenceMatch?.[1]) {
    return firstFenceMatch[1].trim();
  }

  return trimmed;
}

function buildSuggestions(minimalFix: string, neutralPolish: string, conciseProfessional: string): SuggestionVariant[] {
  return [
    {
      id: "minimal_fix",
      title: "Minimal Fix",
      text: minimalFix,
    },
    {
      id: "neutral_polish",
      title: "Neutral Polish (Recommended)",
      text: neutralPolish,
      recommended: true,
    },
    {
      id: "concise_professional",
      title: "Concise Professional",
      text: conciseProfessional,
    },
  ];
}

function parseSuggestions(rawText: string): { suggestions: SuggestionVariant[]; parseMode: ParseMode } {
  const cleanedResponse = stripCodeFences(rawText);

  try {
    const parsed = JSON.parse(cleanedResponse) as {
      minimal_fix?: unknown;
      neutral_polish?: unknown;
      concise_professional?: unknown;
      suggestions?: {
        minimal_fix?: unknown;
        neutral_polish?: unknown;
        concise_professional?: unknown;
      };
    };

    const candidate = parsed.suggestions ?? parsed;
    const minimalFix = typeof candidate.minimal_fix === "string" ? candidate.minimal_fix.trim() : "";
    const neutralPolish = typeof candidate.neutral_polish === "string" ? candidate.neutral_polish.trim() : "";
    const conciseProfessional =
      typeof candidate.concise_professional === "string" ? candidate.concise_professional.trim() : "";

    if (minimalFix && neutralPolish && conciseProfessional) {
      return {
        suggestions: buildSuggestions(minimalFix, neutralPolish, conciseProfessional),
        parseMode: "json",
      };
    }
  } catch {
    // fallback path handled below
  }

  const fallbackText = cleanedResponse || rawText.trim() || "No suggestion available.";

  return {
    suggestions: buildSuggestions(fallbackText, fallbackText, fallbackText),
    parseMode: "fallback",
  };
}

function getOrderedModels(defaultModel: string): string[] {
  const models = [defaultModel.trim(), ...MODEL_FALLBACK_CHAIN].filter(Boolean);
  return [...new Set(models)];
}

function classifyStatusError(statusCode: number, message: string): GeminiRequestError {
  const retryable = statusCode === 429 || (statusCode >= 500 && statusCode <= 599);
  const modelUnavailable =
    statusCode === 404 ||
    (statusCode === 400 && /(model|not found|unsupported|unavailable|does not exist)/i.test(message));

  return new GeminiRequestError(message, {
    statusCode,
    retryable,
    modelUnavailable,
  });
}

function normalizeError(error: unknown): GeminiRequestError {
  if (error instanceof GeminiRequestError) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new GeminiRequestError("Request timed out", {
        retryable: true,
      });
    }

    const retryable = /(timed out|network|socket|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed)/i.test(error.message);
    return new GeminiRequestError(error.message || "Unexpected request error", {
      retryable,
    });
  }

  return new GeminiRequestError("Unexpected unknown error");
}

function createRequestBody(selectedText: string) {
  return {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        parts: [
          {
            text: `Rewrite the text between <input></input> and return only valid JSON with exactly these keys: minimal_fix, neutral_polish, concise_professional.
- minimal_fix: Correct spelling and grammar only. Keep original tone and structure.
- neutral_polish: Fluent, natural US English.
- concise_professional: Shorter and professional while preserving meaning.
Do not include markdown or extra keys.
<input>${selectedText}</input>`,
          },
        ],
      },
    ],
    generation_config: {
      temperature: 0.2,
      response_mime_type: "application/json",
    },
  };
}

async function generateForModel(args: {
  apiKey: string;
  model: string;
  selectedText: string;
  timeoutMs: number;
}): Promise<{ suggestions: SuggestionVariant[]; parseMode: ParseMode }> {
  const { apiKey, model, selectedText, timeoutMs } = args;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createRequestBody(selectedText)),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      let errorMessage = "Unknown API error";
      try {
        const errorData = (await response.json()) as { error?: { message?: string } };
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        const rawErrorText = await response.text();
        if (rawErrorText) {
          errorMessage = rawErrorText;
        }
      }

      throw classifyStatusError(response.status, errorMessage);
    }

    const data = (await response.json()) as GeminiResponse;
    const responseText =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (!responseText) {
      throw new GeminiRequestError("Gemini returned an empty response.");
    }

    return parseSuggestions(responseText);
  } catch (error) {
    throw normalizeError(error);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function processSelectedText(args: {
  selectedText: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
  debugLogs: boolean;
}): Promise<ProcessResult> {
  const { selectedText, apiKey, defaultModel, timeoutMs, maxRetries, debugLogs } = args;
  const startedAt = Date.now();
  const models = getOrderedModels(defaultModel);

  let attempts = 0;
  let lastError: GeminiRequestError | null = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const hasNextModel = index < models.length - 1;
    let retriesForModel = 0;

    for (;;) {
      attempts += 1;
      logEvent(debugLogs, "request_start", {
        attempt: attempts,
        model,
      });

      try {
        const result = await generateForModel({
          apiKey,
          model,
          selectedText,
          timeoutMs,
        });

        const latencyMs = Date.now() - startedAt;
        const status: ProcessingStatus = result.parseMode === "json" ? "success" : "success_with_fallback_parse";

        logEvent(debugLogs, "request_success", {
          attempt: attempts,
          model,
          latencyMs,
          parseMode: result.parseMode,
          status,
        });

        return {
          suggestions: result.suggestions,
          metrics: {
            modelRequested: defaultModel,
            modelResolved: model,
            latencyMs,
            attempts,
            status,
            parseMode: result.parseMode,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        const requestError = normalizeError(error);
        lastError = requestError;

        logEvent(debugLogs, "request_error", {
          attempt: attempts,
          model,
          statusCode: requestError.statusCode,
          retryable: requestError.retryable,
          modelUnavailable: requestError.modelUnavailable,
          message: requestError.message,
        });

        if (requestError.retryable && retriesForModel < maxRetries) {
          const retryDelayMs = 250 * 2 ** retriesForModel;
          retriesForModel += 1;

          logEvent(debugLogs, "request_retry", {
            attempt: attempts,
            model,
            retryNumber: retriesForModel,
            waitMs: retryDelayMs,
          });

          await sleep(retryDelayMs);
          continue;
        }

        if (hasNextModel && (requestError.modelUnavailable || requestError.retryable)) {
          logEvent(debugLogs, "request_fallback_model", {
            fromModel: model,
            toModel: models[index + 1],
            reason: requestError.message,
          });
          break;
        }

        throw requestError;
      }
    }
  }

  throw lastError ?? new GeminiRequestError("Unable to process text with available models.");
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string>("");
  const [suggestions, setSuggestions] = useState<SuggestionVariant[]>([]);
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setIsLoading(true);
      setError(null);

      try {
        const preferences = getPreferenceValues<CommandPreferences>();
        const apiKey = preferences.googleApiKey?.trim();
        const defaultModel = preferences.defaultModel?.trim() || "gemini-flash-lite-latest";
        const timeoutMs = parsePositiveInt(preferences.requestTimeoutMs, 12000, 1000, 60000);
        const maxRetries = parsePositiveInt(preferences.maxRetries, 2, 0, 5);
        const debugLogs = Boolean(preferences.debugLogs);

        if (!apiKey) {
          throw new GeminiRequestError("Google API key is missing. Open extension preferences and set the key.");
        }

        let selectedText: string;
        try {
          selectedText = await getSelectedText();
        } catch {
          throw new GeminiRequestError("No text selected. Select text in any app and run the command again.");
        }

        if (!selectedText.trim()) {
          throw new GeminiRequestError("No text selected. Select text in any app and run the command again.");
        }

        if (looksLikeRuntimeStackTrace(selectedText)) {
          throw new GeminiRequestError(
            "Selected text looks like a runtime stack trace. Deselect logs and select the text you want to rewrite.",
          );
        }

        if (!mounted) {
          return;
        }

        setOriginalText(selectedText);

        const result = await processSelectedText({
          selectedText,
          apiKey,
          defaultModel,
          timeoutMs,
          maxRetries,
          debugLogs,
        });

        if (!mounted) {
          return;
        }

        setSuggestions(result.suggestions);
        setMetrics(result.metrics);

        if (result.metrics.status === "success_with_fallback_parse") {
          await showToast({
            style: Toast.Style.Animated,
            title: "Used fallback parsing",
            message: "Model returned non-JSON output; showing best-effort suggestions.",
          });
        }
      } catch (error) {
        const requestError = normalizeError(error);

        if (!mounted) {
          return;
        }

        setError(requestError.message);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to process text",
          message: requestError.message,
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <ErrorDisplay isLoading={isLoading} errorMessage={error} />;
  }

  if (!metrics || suggestions.length === 0) {
    return <WelcomePage isLoading={isLoading} />;
  }

  return <TextComparison originalText={originalText} suggestions={suggestions} metrics={metrics} />;
}

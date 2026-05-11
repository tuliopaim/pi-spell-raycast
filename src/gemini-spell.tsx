import { getPreferenceValues, getSelectedText, showToast, Toast } from "@raycast/api";
import { spawn } from "child_process";
import { existsSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { useEffect, useState } from "react";
import { ErrorDisplay } from "./ErrorDisplay";
import { TextComparison } from "./TextComparison";
import { WelcomePage } from "./WelcomePage";

const SYSTEM_INSTRUCTION = `You are a writing assistant for a Brazilian software engineer working with a US team.
Return only valid JSON.
Use US English.
Do not add explanations, markdown, or extra keys.`;

const DEFAULT_PI_MODEL = "opencode-go/deepseek-v4-flash";
const DEFAULT_PI_THINKING = "off";
const DEFAULT_TIMEOUT_MS = 120000;
const PI_PATHS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  join(homedir(), ".nix-profile/bin"),
  "/run/current-system/sw/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

type SuggestionVariantId = "minimal_fix" | "neutral_polish" | "concise_professional";
type ParseMode = "json" | "fallback";

type ProcessingStatus = "success" | "success_with_fallback_parse";

export interface CommandPreferences {
  piBin?: string;
  piModel: string;
  piThinking: string;
  requestTimeoutMs: string;
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
  thinking: string;
}

class PiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiRequestError";
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

  console.log(`[pi-spell] ${event} ${JSON.stringify(payload)}`);
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

function normalizeError(error: unknown): PiRequestError {
  if (error instanceof PiRequestError) {
    return error;
  }

  if (error instanceof Error) {
    return new PiRequestError(error.message || "Unexpected Pi error");
  }

  return new PiRequestError("Unexpected unknown error");
}

function createPiPrompt(selectedText: string): string {
  return `${SYSTEM_INSTRUCTION}

Rewrite the text between <input></input> and return only valid JSON with exactly these keys: minimal_fix, neutral_polish, concise_professional.
- minimal_fix: Correct spelling and grammar only. Keep original tone and structure.
- neutral_polish: Fluent, natural US English.
- concise_professional: Shorter and professional while preserving meaning.
Do not include markdown or extra keys.
<input>${selectedText}</input>`;
}

function isExecutableFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function buildPiEnv(): NodeJS.ProcessEnv {
  const pathParts = [...PI_PATHS, process.env.PATH].filter(Boolean);
  return {
    ...process.env,
    HOME: process.env.HOME || homedir(),
    PATH: pathParts.join(":"),
  };
}

function resolvePiBin(preference?: string): string {
  const candidates = [
    preference?.trim(),
    process.env.PI_SPELL_PI_BIN,
    process.env.GEMINI_SPELL_PI_BIN,
    process.env.PI_BIN,
    ...PI_PATHS.map((dir) => join(dir, "pi")),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate.includes("/") && isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return "pi";
}

function isProcessRunning(child: ReturnType<typeof spawn>): boolean {
  return child.exitCode === null && child.signalCode === null;
}

function terminateProcess(child: ReturnType<typeof spawn>) {
  if (isProcessRunning(child)) {
    child.kill("SIGTERM");
  }

  setTimeout(() => {
    if (isProcessRunning(child)) {
      child.kill("SIGKILL");
    }
  }, 1000).unref();
}

async function runPi(args: {
  piBin: string;
  model: string;
  thinking: string;
  prompt: string;
  timeoutMs: number;
  debugLogs: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const { piBin, model, thinking, prompt, timeoutMs, debugLogs, signal } = args;
  const piArgs = [
    "--model",
    model,
    "--thinking",
    thinking,
    "-nt",
    "--no-session",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "-nc",
    "--print",
  ];

  logEvent(debugLogs, "pi_start", { piBin, args: piArgs, timeoutMs });

  return await new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const child = spawn(piBin, piArgs, {
      env: buildPiEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const finish = (error?: Error, output?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", abortHandler);
      if (isProcessRunning(child)) {
        child.kill("SIGTERM");
      }
      if (error) {
        reject(error);
      } else {
        resolve(output ?? "");
      }
    };

    const abortHandler = () => {
      terminateProcess(child);
      finish(new PiRequestError("Pi process was canceled."));
    };

    const timeoutHandle = setTimeout(() => {
      terminateProcess(child);
      finish(new PiRequestError(`Pi timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    signal?.addEventListener("abort", abortHandler);

    child.on("error", (error) => {
      const message = error.message.includes("ENOENT")
        ? "Pi CLI was not found. Install `pi` or set Pi Binary Path in command preferences."
        : `Failed to start Pi CLI: ${error.message}`;
      finish(new PiRequestError(message));
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code, signalName) => {
      if (settled) {
        return;
      }

      const trimmedStdout = stdout.trim();
      if (code !== 0) {
        const stderrSummary = stderr.trim().slice(0, 500);
        finish(
          new PiRequestError(
            `Pi exited with code ${code ?? signalName ?? "unknown"}.${stderrSummary ? ` ${stderrSummary}` : ""}`,
          ),
        );
        return;
      }

      if (!trimmedStdout) {
        finish(new PiRequestError("Pi returned an empty response."));
        return;
      }

      logEvent(debugLogs, "pi_success", { stdoutBytes: stdout.length, stderrBytes: stderr.length });
      finish(undefined, trimmedStdout);
    });

    child.stdin.on("error", () => {
      // The child may close stdin early; process close/error handlers decide the final result.
    });
    child.stdin.end(prompt);
  });
}

async function generateWithPi(args: {
  piBin: string;
  model: string;
  thinking: string;
  selectedText: string;
  timeoutMs: number;
  debugLogs: boolean;
  signal?: AbortSignal;
}): Promise<{ suggestions: SuggestionVariant[]; parseMode: ParseMode }> {
  const responseText = await runPi({
    piBin: args.piBin,
    model: args.model,
    thinking: args.thinking,
    prompt: createPiPrompt(args.selectedText),
    timeoutMs: args.timeoutMs,
    debugLogs: args.debugLogs,
    signal: args.signal,
  });

  return parseSuggestions(responseText);
}

async function processSelectedText(args: {
  selectedText: string;
  piBin: string;
  piModel: string;
  piThinking: string;
  timeoutMs: number;
  debugLogs: boolean;
  onAttempt?: (attempt: number, model: string) => void;
  signal?: AbortSignal;
}): Promise<ProcessResult> {
  const { selectedText, piBin, piModel, piThinking, timeoutMs, debugLogs, onAttempt, signal } = args;
  const startedAt = Date.now();
  const attempts = 1;

  onAttempt?.(attempts, piModel);
  logEvent(debugLogs, "request_start", { attempt: attempts, model: piModel, thinking: piThinking });

  const result = await generateWithPi({
    piBin,
    model: piModel,
    thinking: piThinking,
    selectedText,
    timeoutMs,
    debugLogs,
    signal,
  });

  const latencyMs = Date.now() - startedAt;
  const status: ProcessingStatus = result.parseMode === "json" ? "success" : "success_with_fallback_parse";

  logEvent(debugLogs, "request_success", {
    attempt: attempts,
    model: piModel,
    latencyMs,
    parseMode: result.parseMode,
    status,
  });

  return {
    suggestions: result.suggestions,
    metrics: {
      modelRequested: piModel,
      modelResolved: piModel,
      latencyMs,
      attempts,
      status,
      parseMode: result.parseMode,
      timestamp: new Date().toISOString(),
      thinking: piThinking,
    },
  };
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string>("");
  const [suggestions, setSuggestions] = useState<SuggestionVariant[]>([]);
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);
  const [homeMessage, setHomeMessage] = useState<string | undefined>(undefined);
  const [loadingMessage, setLoadingMessage] = useState("Processing selected text with Pi...");

  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    async function init() {
      setIsLoading(false);
      setError(null);
      setOriginalText("");
      setSuggestions([]);
      setMetrics(null);
      setHomeMessage(undefined);
      setLoadingMessage("Processing selected text with Pi...");

      try {
        let selectedText = "";
        try {
          selectedText = await getSelectedText();
        } catch {
          // ignore: no selection is treated as a normal home state
        }

        if (!mounted) {
          return;
        }

        const normalizedSelectedText = selectedText.trim();
        if (!normalizedSelectedText) {
          setHomeMessage("Let's improve something. Select text in any app and run Pi Spell.");
          return;
        }

        setIsLoading(true);
        setLoadingMessage("Processing selected text with Pi...");

        const preferences = getPreferenceValues<CommandPreferences>();
        const piBin = resolvePiBin(preferences.piBin);
        const piModel = preferences.piModel?.trim() || DEFAULT_PI_MODEL;
        const piThinking = preferences.piThinking?.trim() || DEFAULT_PI_THINKING;
        const timeoutMs = parsePositiveInt(preferences.requestTimeoutMs, DEFAULT_TIMEOUT_MS, 1000, 300000);
        const debugLogs = Boolean(preferences.debugLogs);

        if (looksLikeRuntimeStackTrace(normalizedSelectedText)) {
          throw new PiRequestError(
            "Selected text looks like a runtime stack trace. Deselect logs and select the text you want to rewrite.",
          );
        }

        if (!mounted) {
          return;
        }

        setOriginalText(normalizedSelectedText);

        const result = await processSelectedText({
          selectedText: normalizedSelectedText,
          piBin,
          piModel,
          piThinking,
          timeoutMs,
          debugLogs,
          signal: abortController.signal,
          onAttempt: (attempt, model) => {
            if (!mounted) {
              return;
            }

            setLoadingMessage(`Processing selected text with Pi (attempt ${attempt}, model: ${model})...`);
          },
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
            message: "Pi returned non-JSON output; showing best-effort suggestions.",
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
      abortController.abort();
    };
  }, []);

  if (error) {
    return <ErrorDisplay isLoading={isLoading} errorMessage={error} />;
  }

  if (isLoading) {
    return <WelcomePage isLoading={isLoading} message={loadingMessage} />;
  }

  if (!metrics || suggestions.length === 0) {
    return <WelcomePage isLoading={isLoading} message={homeMessage} />;
  }

  return <TextComparison originalText={originalText} suggestions={suggestions} metrics={metrics} />;
}

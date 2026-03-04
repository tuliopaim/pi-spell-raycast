# Gemini Spell

A Raycast extension that uses Google's Gemini API to fix spelling and generate three rewrite suggestions from selected text.

## Setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Run `npm run dev` to install the extension
3. Open the command preferences and configure:
   - `Google API Key` (secure password field)
   - `Default Model` (defaults to `gemini-flash-lite-latest`)
   - `Request Timeout (ms)` (defaults to `12000`)
   - `Max Retries` (defaults to `2`)
   - `Debug Logs` (defaults to off)

## Usage

1. Select text anywhere.
2. Run the `Gemini Spell` command.
3. The command automatically processes the selected text and shows:
   - `Minimal Fix` (grammar/spelling only)
   - `Neutral Polish` (recommended)
   - `Concise Professional`

## Reliability and Fallbacks

- The command requests the configured default model first.
- Built-in fallback chain for Google models:
  1. `gemini-flash-lite-latest`
  2. `gemini-2.5-flash-lite`
  3. `gemini-2.5-flash`
- Retries transient failures (`429`, `5xx`, timeout/network) with exponential backoff.
- Shows local observability metadata (model, latency, attempts, parse mode).

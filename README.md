# Pi Spell

A Raycast-compatible Vicinae extension that uses the local `pi` CLI to fix spelling and generate three rewrite suggestions from clipboard text.

## Setup

1. Install and authenticate the Pi CLI so `pi` works from a terminal.
2. Run `npm install` to fetch dependencies.
3. Run `npm run build:vicinae` to install the extension in Vicinae.
4. Open the command preferences and configure:
   - `Pi Binary Path` (optional; set this if Raycast cannot find `pi`)
   - `Pi Model` (defaults to `openai-codex/gpt-6-luna`)
   - `Pi Thinking` (defaults to `off`)
   - `Request Timeout (ms)` (defaults to `120000`)
   - `Debug Logs` (defaults to off)

No Google API key is required. Pi authentication is inherited from your local Pi environment.

For development, run `npm run dev` and keep it running while you edit the extension. Raycast development remains available through `npm run dev:raycast`.

## Usage

1. Copy text from any app.
2. Run the `Pi Spell` command.
3. The command automatically processes the clipboard text and shows:
   - `Polished` (fluent US English; recommended, listed first)
   - `Minimal` (spelling and grammar only)
   - `Concise` (shorter and professional)
4. Choose one suggestion and copy it:
   - Keyboard: use arrow keys to select, then press `Enter` to copy and close.
   - Mouse: double-click a suggestion to copy and close.
   - `Cmd+C` copies without closing, `Cmd+R` runs Pi again, and `Cmd+E` opens preferences.

## Reliability

- The command depends on a Pi CLI that supports these flags: `--print`, `--model`, `--thinking`, `-nt`, `--no-session`, `--no-extensions`, `--no-skills`, `--no-prompt-templates`, `--no-themes`, and `-nc`.
- The clipboard text is sent to Pi over stdin; no live model call is made by the `npm run check:pi-cli-contract` validation script.
- Raycast GUI PATHs are limited, so the extension searches common Homebrew, Nix, and system paths. Set `Pi Binary Path` if needed.
- Pi runs are canceled when the command closes and are timed out according to `Request Timeout (ms)`.
- The detail panel shows word and character changes, plus the model, thinking level, and run time.

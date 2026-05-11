# Pi Spell Changelog

## [Initial Version] - {PR_MERGE_DATE}

## [Unreleased]

- Migrated processing from the direct Google Gemini API to the local Pi CLI.
- Removed Google API key, Gemini model fallback, retry, and node-fetch dependencies.
- Added Pi binary path, model, thinking, timeout, and debug log preferences.
- Added automatic processing when selected text is available.
- Added three style-based suggestions: minimal fix, neutral polish, concise professional.
- Added result metadata for model, thinking, latency, attempts, parse mode, and timestamp.
- Added optional structured debug logging to Raycast console.
- Replaced the result `Detail` view with selectable `List` suggestions so users can copy with `Enter` or mouse double-click.
- Added one-shot "Copy and Close" as the default action for each suggestion.

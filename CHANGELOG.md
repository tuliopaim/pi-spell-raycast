# Gemini Spell Changelog

## [Initial Version] - {PR_MERGE_DATE}

## [Unreleased]

- Added command preferences with secure Google API key storage.
- Added default model selection with `gemini-flash-lite-latest` as default.
- Added timeout and retry configuration.
- Removed custom LocalStorage preferences UI and "press Enter to process" flow.
- Added automatic processing when selected text is available.
- Added three style-based suggestions: minimal fix, neutral polish, concise professional.
- Added model fallback chain and retry/backoff resilience.
- Added result metadata for model, latency, attempts, parse mode, and timestamp.
- Added optional structured debug logging to Raycast console.

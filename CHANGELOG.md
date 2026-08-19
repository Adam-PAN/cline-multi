# Changelog

## [3.86.11]

### Added

- Friendly Chinese error cards for common API errors: ModelNotFound, ContentFiltered, ServerError, Timeout, Network — each with clear descriptions and actionable suggestions
- Real-time Token/Cost display bar in chat footer showing input tokens, output tokens, cache reads, and total cost
- Per-profile price configuration: each API profile independently stores and restores its model pricing (inputPrice/outputPrice)
- Price input fields added for DeepSeek provider (previously only available for OpenAI Compatible)

### Fixed

- Fix [#1](https://github.com/Adam-PAN/cline-multi/issues/1): model input/output prices were shared across all profiles — switching profiles now correctly restores per-profile pricing
- Fix "400 Invalid assistant message: content or tool_calls must be set" error for DeepSeek V4 by ensuring assistant messages always have content
- Fix reasoning-only models (DeepSeek V4, Mimo) returning empty responses by falling back to reasoning content
- Fix `tool_choice` from `"required"` to `"auto"` for DeepSeek/OpenAI Compatible/Qwen reasoning models to prevent forced tool calls causing errors
- Fix API Key being cleared when switching between model profiles
- Fix DeepSeek/Mimo "DSML" tag errors and `search_files` missing regex parameter with graceful retry logic

### Changed

- Rewrite error messages to be more user-friendly with Chinese descriptions and actionable suggestions
- Increase base URL input width to match other fields
- Add eye toggle button to API Key field for show/hide password

## [3.86.10]

### Fixed

- Fix "400 Invalid assistant message: content or tool_calls must be set" error for DeepSeek V4 and other models by ensuring assistant messages always have content set (even when empty)
- Safety net in message conversion: prevent undefined content from being sent to OpenAI-compatible APIs

## [3.86.9]

### Fixed

- Fix "Invalid API Response: empty or unparsable response" errors for reasoning-only models (DeepSeek V4, Mimo, etc.) by falling back to reasoning content when no text is produced
- Change `tool_choice` from `"required"` to `"auto"` for DeepSeek, OpenAI Compatible, and Qwen reasoning models to prevent forced tool calls causing empty responses or missing parameters
- Fix API Key being cleared when switching between model profiles — secrets are now preserved when new value is empty
- Add reasoning content as valid assistant response to prevent false "no response" errors in plan mode

## [3.86.8]

### Added

- Multi-API configuration profiles: save, switch, reorder (drag-and-drop), and manage multiple API configurations with card-based UI
- Profile manager in API settings with blue-bordered cards, click-to-edit, and "+" button to add new configurations
- Toast notification on save for clearer feedback
- `thinkingBudgetTokens` support for DeepSeek thinking models

### Fixed

- Force English prompts to avoid garbled Chinese tool descriptions (mojibake) causing models to misunderstand tool parameter requirements
- Preprocess unfenced code blocks in Markdown rendering to prevent garbled red text output
- Increase base URL input width to match other fields
- Add eye toggle button to API Key field for show/hide password
- Increase default consecutive mistake threshold from 3 to 5

### Changed

- Rebrand from "Cline Chinese" to "Cline Multi"
- Remove ShengSuanYun (胜算云) provider and related code
- Update description, README, keywords, and publisher info for marketplace

## [3.83.0]

### Fixed

- Show a clear "Searching..." state in the @-mention file picker
- Improve @-mention file search performance
- Allow `write_to_file` to create or overwrite files with empty content
- Fix validation failures for MCP servers that require an object
- Enable OpenRouter prompt cache control for Qwen models
- Update Axios and SAP Connectivity dependencies

### Changed

- Use the VS Code-specific `README.marketplace.md` when packaging and publishing the VS Code extension
- Add telemetry to @-mention search to help diagnose local, remote, and multi-root workspace search behavior

## [3.82.0]

### Added

- Restore VS Code foreground terminal support and settings
- Add latest OpenAI, SAP AI Core, and Z AI models

### Fixed

- Fix hook template JSON escaping
- Improve ripgrep file search error handling

### Changed

- Remove hardcoded model lists from docs

## [3.81.0]

### Added

- Add GPT-5.5 model support for OpenAI Codex subscription users

### Fixed

- Remove hardcoded "What's New" fallback items in webview; only remote-configured welcome banners are shown

### Changed

- Improve cline-core memory diagnostics used by the extension runtime:
  - Enable near-heap-limit heap snapshots
  - Add periodic memory usage logging
  - Log discovered heap snapshots on abnormal exits for easier OOM debugging

## [3.80.0]

### Added

- Wire up remote `globalSkills` from enterprise remote config with full UI, toggle support, and system prompt integration — enterprise-managed skills now appear under a dedicated "Enterprise Skills" section and support `alwaysEnabled` enforcement
- Onboarding flow now uses dynamically fetched recommended models instead of a hardcoded list, with a fallback to the welcome view on failure
- Add dedicated "Quota Exceeded" error message in the chat error UI when Cline account spend caps are hit

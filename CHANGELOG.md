# Changelog

## [4.2.0]

### Added

- **Context compression: auto-condense for more models** — Replaced model-family-based check with context-window-based check (>= 200K), enabling auto-condense for models like Kimi K3, Qwen-Long, MiniMax-M3, and other large-context models that were previously excluded
- **Context compression: optimized buffer for 500K+ models** — Ultra-large context windows (500K+) now use 92% utilization instead of the conservative formula, freeing up ~120K additional tokens for 1M models
- **Context compression: lite summary template** — Added summarizeTaskLite with 4 essential sections (down from 10) for models with <200K context, reducing the token cost of summarization itself
- **Context compression: configurable file optimization threshold** — New ileOptimizationThreshold setting (default: 0.3) allows users to tune when file-read optimization triggers compaction
- **Multimodal image stripping** — When switching from a vision model to a text-only model, images in conversation history are automatically replaced with text placeholders to prevent API errors
- **Image stripping notification** — First-time image stripping shows a one-time notification explaining that historical images were removed

### Changed

- Auto-condense eligibility now determined by context window size (>= 200K) instead of hardcoded model family list
- SubagentRunner also applies image stripping for consistency with the main task flow

### Fixed

- Fixed potential API errors when switching from multimodal models (GPT-4o, Claude, Gemini) to text-only models (DeepSeek, Qwen, etc.) in an ongoing conversation with image content
- Image stripping notification now shows only once per task session instead of on every API call
## [4.1.0]

### Added

- **EditableModelSelector**: All provider model dropdowns now support free-text input — users can type any custom model ID and save it
- **Anthropic Claude 5 models**: claude-opus-5, claude-sonnet-5, claude-fable-5, claude-mythos-5 (with 1M context variants)
- **DeepSeek**: deepseek-v4-flash-vision-exp (vision support), deepseek-v4-flash-0731 (1.3M context), deepseek-v3.2, deepseek-v3.1-terminus, deepseek-chat-v3.1
- **XAI/Grok**: grok-4.20 (2M context), grok-4.20-multi-agent, grok-4.6, grok-4.5, grok-4.3
- **OpenAI**: gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.6-sol-pro, gpt-5.6-terra-pro, gpt-5.6-luna-pro, gpt-5.5-pro, gpt-5.4-pro, gpt-5.2-pro, gpt-5.1-mini
- **Gemini**: gemini-3.7-flash, gemini-3.6-flash, gemini-3.5-flash-lite, gemini-3.1-pro (GA), gemini-3.1-flash-lite
- **Qwen/通义**: qwen3.8-max, qwen3.8-flash, qwen3.7-max/plus/flash, qwen3.6-plus/flash, qwen3.5-plus/flash, qwen3-coder-flash, qwen3-coder-next (intl + mainland)
- **Kimi/Moonshot**: kimi-k3 (1M context), kimi-k2.7-code
- **GLM/智谱**: glm-5.3-flash (1.3M context), glm-5.3, glm-5.2, glm-5-turbo, glm-5v-turbo, glm-4.7-flash (intl + mainland)
- **Doubao/豆包**: seed-2-1-turbo, seed-2.0-code, seed-2.0-lite, seed-2.0-mini, seed-1.6-flash, seed-1.6
- **MiniMax**: MiniMax-M3 (1M context), MiniMax-M1
- **Bedrock**: anthropic.claude-opus-5, anthropic.claude-sonnet-5, anthropic.claude-fable-5, anthropic.claude-mythos-5
- **Claude Code**: claude-opus-5, claude-sonnet-5, claude-fable-5, claude-mythos-5

### Changed

- Default Anthropic model updated to claude-sonnet-5
- Default Claude Code model updated to claude-sonnet-5
- normalizeApiConfiguration now preserves custom model IDs with sane defaults (8K output, 128K context)

### Fixed

- EditableModelSelector now uses native input + datalist with VS Code theme CSS variables for proper styling
- EditableModelSelector dropdown z-index handling to prevent UI elements from being hidden


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



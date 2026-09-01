import { ApiHandler } from "@core/api"

/**
 * Gets context window information for the given API handler
 *
 * @param api The API handler to get context window information for
 * @returns An object containing the raw context window size and the effective max allowed size
 */
export function getContextWindowInfo(api: ApiHandler) {
	const contextWindow = api.getModel().info.contextWindow || 128_000
	let maxAllowedSize: number
	switch (contextWindow) {
		case 64_000: // deepseek models
			maxAllowedSize = contextWindow - 27_000
			break
		case 128_000: // most models
			maxAllowedSize = contextWindow - 30_000
			break
		case 200_000: // claude models
			maxAllowedSize = contextWindow - 40_000
			break
		default:
			// For very large context windows (500K+), use 92% to maximize usable space
			// For smaller windows, keep the existing conservative formula
			if (contextWindow >= 500_000) {
				maxAllowedSize = Math.floor(contextWindow * 0.92)
			} else {
				maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
			}
	}

	return { contextWindow, maxAllowedSize }
}

/**
 * Determines if a model supports auto-condense (automatic context summarization).
 * Uses context window size as the signal: models with >= 200K context window
 * are considered capable enough to handle the summarize_task flow reliably.
 * This replaces the previous isNextGenModelFamily() check which was too restrictive
 * and excluded capable models like DeepSeek V3, Qwen-Long, Kimi, etc.
 */
export function supportsAutoCondense(api: ApiHandler): boolean {
	const contextWindow = api.getModel().info.contextWindow || 128_000
	return contextWindow >= 200_000
}

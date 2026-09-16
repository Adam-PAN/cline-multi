import type { UsageEntry } from "./usage-stats"

export type HistoryItem = {
	id: string
	ulid?: string // ULID for better tracking and metrics
	ts: number
	task: string
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number

	size?: number
	shadowGitConfigWorkTree?: string
	cwdOnTaskInitialization?: string
	conversationHistoryDeletedRange?: [number, number]
	isFavorited?: boolean
	checkpointManagerErrorMessage?: string

	modelId?: string

	/** Number of API requests made in this task (accurate request count, not task count) */
	apiRequests?: number
	/** Per-request usage details captured while the task ran (tokens/cost/model per request) */
	usageEntries?: UsageEntry[]
}

import { ClineMessage } from "./ExtensionMessage"

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
}

export type UsageStatsData = {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites: number
	totalCacheReads: number
	totalCost: number
	totalRequests: number
	modelStats: Map<string, {
		requests: number
		tokensIn: number
		tokensOut: number
		cost: number
	}>
	dailyStats: Map<string, {
		tokensIn: number
		tokensOut: number
		cacheWrites: number
		cacheReads: number
		cost: number
	}>
}

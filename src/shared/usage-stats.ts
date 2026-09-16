import type { ClineMessage } from "./ExtensionMessage"
import type { HistoryItem } from "./HistoryItem"

export type UsageTimeRange = "today" | "week" | "month" | "all"

/** Usage recorded for a single API request (or an aggregated snapshot such as deleted_api_reqs / subagent_usage). */
export interface UsageEntry {
	/** Timestamp (ms) of the API request / usage snapshot */
	ts: number
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost: number
	/** Cost breakdown by pricing component (input / cache writes / cache reads / output) */
	inputCost?: number
	outputCost?: number
	cacheWritesCost?: number
	cacheReadsCost?: number
	/** Model that served this request, if known */
	modelId?: string
}

export interface ModelUsageStats {
	requests: number
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost: number
	/** Cost breakdown by pricing component (input / cache writes / cache reads / output) */
	inputCost: number
	outputCost: number
	cacheWritesCost: number
	cacheReadsCost: number
}

export interface UsageTotals {
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost: number
	/** Cost breakdown by pricing component (input / cache writes / cache reads / output) */
	inputCost: number
	outputCost: number
	cacheWritesCost: number
	cacheReadsCost: number
	/** Number of API requests (not tasks) */
	requests: number
	/** Number of tasks contributing usage in the range */
	tasks: number
}

/** A calendar-aligned bucket used to render the usage trend chart. */
export interface UsageTrendBucket {
	/** "YYYY-MM-DD" for day buckets, "HH" for hour buckets */
	key: string
	/** Human readable label, e.g. "9/12" or "08:00" */
	label: string
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost: number
	/** Cost breakdown by pricing component (input / cache writes / cache reads / output) */
	inputCost: number
	outputCost: number
	cacheWritesCost: number
	cacheReadsCost: number
}

export interface UsageStatsResult {
	totals: UsageTotals
	modelStats: Map<string, ModelUsageStats>
	/** Ordered old -> new, with missing days/hours zero-filled so the chart aligns to the calendar. */
	trend: UsageTrendBucket[]
}

/**
 * A durable per-request usage log record persisted to disk (usage-log.jsonl).
 * Unlike UsageEntry (which lives inside task history and disappears when a task
 * is deleted), these records survive task deletion so usage statistics remain
 * complete and stable over time.
 */
export interface UsageLogEntry extends UsageEntry {
	/** Task that made the request */
	taskId?: string
	/** API provider id (e.g. "openai", "openrouter", "anthropic") */
	provider?: string
	/** "plan" | "act" */
	mode?: string
	/** Human readable task text snippet for the record */
	taskSnippet?: string
}

/** Aggregation result over raw usage-log entries (no per-task grouping needed). */
export interface UsageLogAggregate {
	totals: UsageTotals
	modelStats: Map<string, ModelUsageStats>
	trend: UsageTrendBucket[]
}

const DAY_MS = 24 * 60 * 60 * 1000
export const UNKNOWN_MODEL_KEY = "unknown"

export function getTimeRangeCutoff(range: UsageTimeRange, now = Date.now()): number {
	switch (range) {
		case "today":
			return new Date(now).setHours(0, 0, 0, 0)
		case "week":
			return now - 7 * DAY_MS
		case "month":
			return now - 30 * DAY_MS
		default:
			return 0
	}
}

function toNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function hasUsageData(entry: { tokensIn?: unknown; tokensOut?: unknown; cost?: unknown }): boolean {
	return typeof entry.tokensIn === "number" || typeof entry.tokensOut === "number" || typeof entry.cost === "number"
}

/**
 * Extracts per-request usage entries from a task's clineMessages.
 * Sources:
 * - `api_req_started` messages (finalized ones carry tokens/cost and the modelId of the request)
 * - `deleted_api_reqs` messages (aggregate of messages removed by checkpoint restores / truncation)
 * - `subagent_usage` messages (aggregate usage of subagent batches)
 */
export function extractUsageEntries(messages: ClineMessage[]): { usageEntries: UsageEntry[]; apiRequestCount: number } {
	const usageEntries: UsageEntry[] = []
	let apiRequestCount = 0

	for (const message of messages) {
		if (message.type !== "say" || !message.text) {
			continue
		}
		if (message.say === "api_req_started") {
			apiRequestCount++
			try {
				const data = JSON.parse(message.text)
				if (hasUsageData(data)) {
					usageEntries.push({
						ts: message.ts,
						tokensIn: toNumber(data.tokensIn),
						tokensOut: toNumber(data.tokensOut),
						cacheWrites: toNumber(data.cacheWrites),
						cacheReads: toNumber(data.cacheReads),
						cost: toNumber(data.cost),
						inputCost: toNumber(data.inputCost),
						outputCost: toNumber(data.outputCost),
						cacheWritesCost: toNumber(data.cacheWritesCost),
						cacheReadsCost: toNumber(data.cacheReadsCost),
						modelId: typeof data.modelId === "string" && data.modelId ? data.modelId : undefined,
					})
				}
			} catch {
				// Ignore malformed usage payloads
			}
		} else if (message.say === "deleted_api_reqs" || message.say === "subagent_usage") {
			try {
				const data = JSON.parse(message.text)
				if (hasUsageData(data)) {
					usageEntries.push({
						ts: message.ts,
						tokensIn: toNumber(data.tokensIn),
						tokensOut: toNumber(data.tokensOut),
						cacheWrites: toNumber(data.cacheWrites),
						cacheReads: toNumber(data.cacheReads),
						cost: toNumber(data.cost),
						inputCost: toNumber(data.inputCost),
						outputCost: toNumber(data.outputCost),
						cacheWritesCost: toNumber(data.cacheWritesCost),
						cacheReadsCost: toNumber(data.cacheReadsCost),
					})
				}
			} catch {
				// Ignore malformed usage payloads
			}
		}
	}

	return { usageEntries, apiRequestCount }
}

/**
 * Normalizes a history item into per-request usage entries.
 * New items carry `usageEntries` captured per API request; older items only have
 * task-level totals, which we fall back to as a single approximate entry.
 */
export function normalizeUsageEntries(item: HistoryItem): UsageEntry[] {
	if (item.usageEntries && item.usageEntries.length > 0) {
		return item.usageEntries
	}
	if (!hasUsageData(item) && !item.cacheWrites && !item.cacheReads) {
		return []
	}
	if (toNumber(item.tokensIn) === 0 && toNumber(item.tokensOut) === 0 && toNumber(item.totalCost) === 0) {
		return []
	}
	return [
		{
			ts: item.ts,
			tokensIn: toNumber(item.tokensIn),
			tokensOut: toNumber(item.tokensOut),
			cacheWrites: toNumber(item.cacheWrites),
			cacheReads: toNumber(item.cacheReads),
			cost: toNumber(item.totalCost),
			modelId: item.modelId,
		},
	]
}

function getDayKey(ts: number): string {
	const d = new Date(ts)
	const month = `${d.getMonth() + 1}`.padStart(2, "0")
	const day = `${d.getDate()}`.padStart(2, "0")
	return `${d.getFullYear()}-${month}-${day}`
}

function createEmptyBucket(key: string, label: string): UsageTrendBucket {
	return {
		key,
		label,
		tokensIn: 0,
		tokensOut: 0,
		cacheWrites: 0,
		cacheReads: 0,
		cost: 0,
		inputCost: 0,
		outputCost: 0,
		cacheWritesCost: 0,
		cacheReadsCost: 0,
	}
}

function accumulateBucket(bucket: UsageTrendBucket, entry: UsageEntry): void {
	bucket.tokensIn += entry.tokensIn
	bucket.tokensOut += entry.tokensOut
	bucket.cacheWrites += entry.cacheWrites
	bucket.cacheReads += entry.cacheReads
	bucket.cost += entry.cost
	bucket.inputCost += toNumber(entry.inputCost)
	bucket.outputCost += toNumber(entry.outputCost)
	bucket.cacheWritesCost += toNumber(entry.cacheWritesCost)
	bucket.cacheReadsCost += toNumber(entry.cacheReadsCost)
}

function buildHourBuckets(entries: UsageEntry[]): UsageTrendBucket[] {
	const buckets: UsageTrendBucket[] = []
	for (let hour = 0; hour < 24; hour++) {
		const key = `${hour}`.padStart(2, "0")
		buckets.push(createEmptyBucket(key, `${key}:00`))
	}
	for (const entry of entries) {
		const bucket = buckets[new Date(entry.ts).getHours()]
		if (bucket) {
			accumulateBucket(bucket, entry)
		}
	}
	return buckets
}

function buildDayBuckets(entries: UsageEntry[], fromDayStart: number, toDayStart: number): UsageTrendBucket[] {
	const bucketsByDayStart = new Map<number, UsageTrendBucket>()
	const cursor = new Date(fromDayStart)
	const last = new Date(toDayStart)
	// Iterate calendar days (DST-safe via setDate)
	while (cursor.getTime() <= last.getTime()) {
		const dayStart = new Date(cursor).setHours(0, 0, 0, 0)
		const d = new Date(dayStart)
		bucketsByDayStart.set(dayStart, createEmptyBucket(getDayKey(dayStart), `${d.getMonth() + 1}/${d.getDate()}`))
		cursor.setDate(cursor.getDate() + 1)
	}
	for (const entry of entries) {
		const bucket = bucketsByDayStart.get(new Date(entry.ts).setHours(0, 0, 0, 0))
		if (bucket) {
			accumulateBucket(bucket, entry)
		}
	}
	return Array.from(bucketsByDayStart.values())
}

function roundBucketCosts(bucket: UsageTrendBucket): UsageTrendBucket {
	bucket.cost = round6(bucket.cost)
	bucket.inputCost = round6(bucket.inputCost)
	bucket.outputCost = round6(bucket.outputCost)
	bucket.cacheWritesCost = round6(bucket.cacheWritesCost)
	bucket.cacheReadsCost = round6(bucket.cacheReadsCost)
	return bucket
}

function buildTrend(entries: UsageEntry[], range: UsageTimeRange, now: number): UsageTrendBucket[] {
	if (entries.length === 0) {
		return []
	}
	if (range === "today") {
		return buildHourBuckets(entries).map(roundBucketCosts)
	}
	const todayStart = new Date(now).setHours(0, 0, 0, 0)
	if (range === "week") {
		return buildDayBuckets(entries, todayStart - 6 * DAY_MS, todayStart).map(roundBucketCosts)
	}
	if (range === "month") {
		return buildDayBuckets(entries, todayStart - 29 * DAY_MS, todayStart).map(roundBucketCosts)
	}
	// "all": span from the earliest entry's day through today
	let earliest = now
	for (const entry of entries) {
		earliest = Math.min(earliest, entry.ts)
	}
	const earliestDayStart = new Date(earliest).setHours(0, 0, 0, 0)
	return buildDayBuckets(entries, earliestDayStart, todayStart).map(roundBucketCosts)
}

function round6(value: number): number {
	return Math.round(value * 1e6) / 1e6
}

/**
 * Aggregates usage across the FULL task history (not truncated), producing
 * totals, per-model stats and a calendar-aligned trend series.
 */
export function aggregateUsageStats(items: HistoryItem[], range: UsageTimeRange, now = Date.now()): UsageStatsResult {
	const cutoff = getTimeRangeCutoff(range, now)

	const totals: UsageTotals = {
		tokensIn: 0,
		tokensOut: 0,
		cacheWrites: 0,
		cacheReads: 0,
		cost: 0,
		inputCost: 0,
		outputCost: 0,
		cacheWritesCost: 0,
		cacheReadsCost: 0,
		requests: 0,
		tasks: 0,
	}
	const modelStats = new Map<string, ModelUsageStats>()
	const allEntries: UsageEntry[] = []

	for (const item of items) {
		if (!item.ts || item.ts < cutoff) {
			continue
		}
		totals.tasks++

		const entries = normalizeUsageEntries(item)
		for (const entry of entries) {
			allEntries.push(entry)
			totals.tokensIn += entry.tokensIn
			totals.tokensOut += entry.tokensOut
			totals.cacheWrites += entry.cacheWrites
			totals.cacheReads += entry.cacheReads
			totals.cost += entry.cost
			totals.inputCost += toNumber(entry.inputCost)
			totals.outputCost += toNumber(entry.outputCost)
			totals.cacheWritesCost += toNumber(entry.cacheWritesCost)
			totals.cacheReadsCost += toNumber(entry.cacheReadsCost)
			totals.requests++

			const modelKey = entry.modelId || UNKNOWN_MODEL_KEY
			const model = modelStats.get(modelKey) ?? {
				requests: 0,
				tokensIn: 0,
				tokensOut: 0,
				cacheWrites: 0,
				cacheReads: 0,
				cost: 0,
				inputCost: 0,
				outputCost: 0,
				cacheWritesCost: 0,
				cacheReadsCost: 0,
			}
			model.requests++
			model.tokensIn += entry.tokensIn
			model.tokensOut += entry.tokensOut
			model.cacheWrites += entry.cacheWrites
			model.cacheReads += entry.cacheReads
			model.cost += entry.cost
			model.inputCost += toNumber(entry.inputCost)
			model.outputCost += toNumber(entry.outputCost)
			model.cacheWritesCost += toNumber(entry.cacheWritesCost)
			model.cacheReadsCost += toNumber(entry.cacheReadsCost)
			modelStats.set(modelKey, model)
		}
	}

	totals.cost = round6(totals.cost)
	totals.inputCost = round6(totals.inputCost)
	totals.outputCost = round6(totals.outputCost)
	totals.cacheWritesCost = round6(totals.cacheWritesCost)
	totals.cacheReadsCost = round6(totals.cacheReadsCost)
	for (const model of modelStats.values()) {
		model.cost = round6(model.cost)
		model.inputCost = round6(model.inputCost)
		model.outputCost = round6(model.outputCost)
		model.cacheWritesCost = round6(model.cacheWritesCost)
		model.cacheReadsCost = round6(model.cacheReadsCost)
	}

	return { totals, modelStats, trend: buildTrend(allEntries, range, now) }
}

/**
 * Aggregates raw usage-log entries (from the durable usage-log.jsonl) into
 * totals, per-model stats and a calendar-aligned trend series.
 * The cutoff is applied per-entry using its own timestamp.
 */
export function aggregateUsageEntries(entries: UsageLogEntry[], range: UsageTimeRange, now = Date.now()): UsageLogAggregate {
	const cutoff = getTimeRangeCutoff(range, now)

	const totals: UsageTotals = {
		tokensIn: 0,
		tokensOut: 0,
		cacheWrites: 0,
		cacheReads: 0,
		cost: 0,
		inputCost: 0,
		outputCost: 0,
		cacheWritesCost: 0,
		cacheReadsCost: 0,
		requests: 0,
		tasks: 0,
	}
	const modelStats = new Map<string, ModelUsageStats>()
	const activeTaskIds = new Set<string>()
	const inRange: UsageEntry[] = []

	for (const entry of entries) {
		if (!entry || typeof entry.ts !== "number" || entry.ts < cutoff) {
			continue
		}
		// Entries without a taskId (e.g. legacy records) still represent one
		// task session — count them under a sentinel so tasks stays >= 1.
		activeTaskIds.add(entry.taskId || "__unknown_task__")
		const normalized: UsageEntry = {
			ts: entry.ts,
			tokensIn: toNumber(entry.tokensIn),
			tokensOut: toNumber(entry.tokensOut),
			cacheWrites: toNumber(entry.cacheWrites),
			cacheReads: toNumber(entry.cacheReads),
			cost: toNumber(entry.cost),
			inputCost: toNumber(entry.inputCost),
			outputCost: toNumber(entry.outputCost),
			cacheWritesCost: toNumber(entry.cacheWritesCost),
			cacheReadsCost: toNumber(entry.cacheReadsCost),
			modelId: entry.modelId,
		}
		inRange.push(normalized)

		totals.tokensIn += normalized.tokensIn
		totals.tokensOut += normalized.tokensOut
		totals.cacheWrites += normalized.cacheWrites
		totals.cacheReads += normalized.cacheReads
		totals.cost += normalized.cost
		totals.inputCost += toNumber(normalized.inputCost)
		totals.outputCost += toNumber(normalized.outputCost)
		totals.cacheWritesCost += toNumber(normalized.cacheWritesCost)
		totals.cacheReadsCost += toNumber(normalized.cacheReadsCost)
		totals.requests++

		const modelKey = normalized.modelId || UNKNOWN_MODEL_KEY
		const model = modelStats.get(modelKey) ?? {
			requests: 0,
			tokensIn: 0,
			tokensOut: 0,
			cacheWrites: 0,
			cacheReads: 0,
			cost: 0,
			inputCost: 0,
			outputCost: 0,
			cacheWritesCost: 0,
			cacheReadsCost: 0,
		}
		model.requests++
		model.tokensIn += normalized.tokensIn
		model.tokensOut += normalized.tokensOut
		model.cacheWrites += normalized.cacheWrites
		model.cacheReads += normalized.cacheReads
		model.cost += normalized.cost
		model.inputCost += toNumber(normalized.inputCost)
		model.outputCost += toNumber(normalized.outputCost)
		model.cacheWritesCost += toNumber(normalized.cacheWritesCost)
		model.cacheReadsCost += toNumber(normalized.cacheReadsCost)
		modelStats.set(modelKey, model)
	}

	totals.tasks = activeTaskIds.size
	totals.cost = round6(totals.cost)
	totals.inputCost = round6(totals.inputCost)
	totals.outputCost = round6(totals.outputCost)
	totals.cacheWritesCost = round6(totals.cacheWritesCost)
	totals.cacheReadsCost = round6(totals.cacheReadsCost)
	for (const model of modelStats.values()) {
		model.cost = round6(model.cost)
		model.inputCost = round6(model.inputCost)
		model.outputCost = round6(model.outputCost)
		model.cacheWritesCost = round6(model.cacheWritesCost)
		model.cacheReadsCost = round6(model.cacheReadsCost)
	}

	return { totals, modelStats, trend: buildTrend(inRange, range, now) }
}

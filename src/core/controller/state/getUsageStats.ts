import { usageLog } from "@core/storage/usage-log"
import { StringRequest } from "@shared/proto/cline/common"
import { UsageStats } from "@shared/proto/cline/state"
import { aggregateUsageEntries, aggregateUsageStats, type UsageStatsResult, type UsageTimeRange } from "@/shared/usage-stats"
import type { Controller } from "../index"

const VALID_RANGES: UsageTimeRange[] = ["today", "week", "month", "all"]

/**
 * Aggregates usage statistics over the durable usage log (usage-log.jsonl),
 * which records every model call independently of task history — so stats
 * stay stable even when tasks are deleted. Falls back to aggregating the
 * full task history when the log is empty (e.g. users who haven't made any
 * requests since this log was introduced), so pre-existing history still shows.
 * @param controller The controller instance
 * @param request The request containing the time range ("today" | "week" | "month" | "all")
 * @returns UsageStats with the serialized UsageStatsResult JSON payload
 */
export async function getUsageStats(controller: Controller, request: StringRequest): Promise<UsageStats> {
	const range = VALID_RANGES.includes(request.value as UsageTimeRange) ? (request.value as UsageTimeRange) : "all"

	// Prefer the durable per-request log; it survives task deletion and
	// aggregates are unaffected by VSCode-side history truncation.
	const logEntries = usageLog.readAll()
	let result: UsageStatsResult
	if (logEntries.length > 0) {
		result = aggregateUsageEntries(logEntries, range)
	} else {
		// Fallback: aggregate from task history (legacy data before the log existed).
		const taskHistory = controller.stateManager.getGlobalStateKey("taskHistory")
		result = aggregateUsageStats(taskHistory, range)
	}

	return UsageStats.create({
		usageJson: JSON.stringify({
			totals: result.totals,
			modelStats: Array.from(result.modelStats.entries()),
			trend: result.trend,
		}),
	})
}

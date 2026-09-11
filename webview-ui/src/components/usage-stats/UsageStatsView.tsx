import { HistoryItem } from "@shared/HistoryItem"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import ViewHeader from "../common/ViewHeader"
import { ModelStatsTable } from "./ModelStatsTable"
import { UsageSummaryCard } from "./UsageSummaryCard"
import { UsageTrendChart } from "./UsageTrendChart"

type UsageStatsViewProps = {
	onDone: () => void
}

export type UsageStatsData = {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites: number
	totalCacheReads: number
	totalCost: number
	totalRequests: number
	modelStats: Map<
		string,
		{
			requests: number
			tokensIn: number
			tokensOut: number
			cost: number
		}
	>
	dailyStats: Map<
		string,
		{
			tokensIn: number
			tokensOut: number
			cacheWrites: number
			cacheReads: number
			cost: number
		}
	>
}

function parseUsageFromHistoryItem(item: HistoryItem): {
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost: number
	modelId: string
	timestamp: number
} {
	return {
		tokensIn: item.tokensIn || 0,
		tokensOut: item.tokensOut || 0,
		cacheWrites: item.cacheWrites || 0,
		cacheReads: item.cacheReads || 0,
		cost: item.totalCost || 0,
		modelId: item.modelId || "unknown",
		timestamp: item.ts,
	}
}

function getDateKey(timestamp: number): string {
	const date = new Date(timestamp)
	return `${date.getMonth() + 1}/${date.getDate()}`
}

function getHourKey(timestamp: number): string {
	const date = new Date(timestamp)
	return `${date.getHours().toString().padStart(2, "0")}:00`
}

export const UsageStatsView = ({ onDone }: UsageStatsViewProps) => {
	const { t } = useTranslation("settings")
	const { environment, taskHistory = [] } = useExtensionState()

	const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("all")

	const statsData = useMemo((): UsageStatsData => {
		const now = Date.now()
		let cutoffTime = 0

		switch (timeRange) {
			case "today":
				cutoffTime = new Date().setHours(0, 0, 0, 0)
				break
			case "week":
				cutoffTime = now - 7 * 24 * 60 * 60 * 1000
				break
			case "month":
				cutoffTime = now - 30 * 24 * 60 * 60 * 1000
				break
			default:
				cutoffTime = 0
		}

		const filteredItems = taskHistory.filter((item: HistoryItem) => item.ts >= cutoffTime)

		let totalTokensIn = 0
		let totalTokensOut = 0
		let totalCacheWrites = 0
		let totalCacheReads = 0
		let totalCost = 0
		const totalRequests = filteredItems.length

		const modelStats = new Map<
			string,
			{
				requests: number
				tokensIn: number
				tokensOut: number
				cost: number
			}
		>()

		const dailyStats = new Map<
			string,
			{
				tokensIn: number
				tokensOut: number
				cacheWrites: number
				cacheReads: number
				cost: number
			}
		>()

		filteredItems.forEach((item: HistoryItem) => {
			const usage = parseUsageFromHistoryItem(item)

			totalTokensIn += usage.tokensIn
			totalTokensOut += usage.tokensOut
			totalCacheWrites += usage.cacheWrites
			totalCacheReads += usage.cacheReads
			totalCost += usage.cost

			// Model stats
			const modelKey = usage.modelId
			if (!modelStats.has(modelKey)) {
				modelStats.set(modelKey, {
					requests: 0,
					tokensIn: 0,
					tokensOut: 0,
					cost: 0,
				})
			}
			const modelData = modelStats.get(modelKey)!
			modelData.requests++
			modelData.tokensIn += usage.tokensIn
			modelData.tokensOut += usage.tokensOut
			modelData.cost += usage.cost

			// Daily stats - use different keys based on time range
			let statKey: string
			if (timeRange === "today") {
				statKey = getHourKey(usage.timestamp)
			} else {
				statKey = getDateKey(usage.timestamp)
			}

			if (!dailyStats.has(statKey)) {
				dailyStats.set(statKey, {
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					cost: 0,
				})
			}
			const dayData = dailyStats.get(statKey)!
			dayData.tokensIn += usage.tokensIn
			dayData.tokensOut += usage.tokensOut
			dayData.cacheWrites += usage.cacheWrites
			dayData.cacheReads += usage.cacheReads
			dayData.cost += usage.cost
		})

		return {
			totalTokensIn,
			totalTokensOut,
			totalCacheWrites,
			totalCacheReads,
			totalCost,
			totalRequests,
			modelStats,
			dailyStats,
		}
	}, [taskHistory, timeRange])

	const handleTimeRangeChange = useCallback((range: "today" | "week" | "month" | "all") => {
		setTimeRange(range)
	}, [])

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<ViewHeader environment={environment} onDone={onDone} title={t("usageStats.title")} />
			<div className="flex-1 overflow-y-auto px-5 pb-6">
				{/* Time Range Selector */}
				<div className="flex gap-2 mb-6">
					{(["today", "week", "month", "all"] as const).map((range) => (
						<button
							className={`px-3 py-1.5 rounded text-sm ${
								timeRange === range
									? "bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]"
									: "bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-inputOption-activeBackground)]"
							}`}
							key={range}
							onClick={() => handleTimeRangeChange(range)}>
							{t(`usageStats.timeRange.${range}`)}
						</button>
					))}
				</div>

				{/* Summary Cards */}
				<UsageSummaryCard
					totalCacheReads={statsData.totalCacheReads}
					totalCost={statsData.totalCost}
					totalRequests={statsData.totalRequests}
					totalTokens={statsData.totalTokensIn + statsData.totalTokensOut}
					totalTokensIn={statsData.totalTokensIn}
					totalTokensOut={statsData.totalTokensOut}
				/>

				{/* Usage Trend Chart */}
				<UsageTrendChart dailyStats={statsData.dailyStats} timeRange={timeRange} />

				{/* Model Statistics Table */}
				<ModelStatsTable modelStats={statsData.modelStats} />
			</div>
		</div>
	)
}

export default UsageStatsView

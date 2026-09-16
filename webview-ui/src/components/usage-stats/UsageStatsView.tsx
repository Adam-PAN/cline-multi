import { StringRequest } from "@shared/proto/cline/common"
import type { UsageTimeRange } from "@shared/usage-stats"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StateServiceClient } from "@/services/grpc-client"
import ViewHeader from "../common/ViewHeader"
import { ModelStatsTable } from "./ModelStatsTable"
import { UsageSummaryCard } from "./UsageSummaryCard"
import { UsageTrendChart } from "./UsageTrendChart"

type UsageStatsViewProps = {
	onDone: () => void
}

export type CostBreakdown = {
	inputCost: number
	outputCost: number
	cacheWritesCost: number
	cacheReadsCost: number
}

export type UsageStatsData = {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites: number
	totalCacheReads: number
	totalCost: number
	costBreakdown: CostBreakdown
	totalRequests: number
	totalTasks: number
	modelStats: Map<
		string,
		{
			requests: number
			tokensIn: number
			tokensOut: number
			cacheWrites: number
			cacheReads: number
			cost: number
			inputCost: number
			outputCost: number
			cacheWritesCost: number
			cacheReadsCost: number
		}
	>
	trend: Array<{
		key: string
		label: string
		tokensIn: number
		tokensOut: number
		cacheWrites: number
		cacheReads: number
		cost: number
		inputCost: number
		outputCost: number
		cacheWritesCost: number
		cacheReadsCost: number
	}>
}

const EMPTY_STATS: UsageStatsData = {
	totalTokensIn: 0,
	totalTokensOut: 0,
	totalCacheWrites: 0,
	totalCacheReads: 0,
	totalCost: 0,
	costBreakdown: { inputCost: 0, outputCost: 0, cacheWritesCost: 0, cacheReadsCost: 0 },
	totalRequests: 0,
	totalTasks: 0,
	modelStats: new Map(),
	trend: [],
}

const TIME_RANGES: UsageTimeRange[] = ["today", "week", "month", "all"]

export const UsageStatsView = ({ onDone }: UsageStatsViewProps) => {
	const { t } = useTranslation("settings")
	// taskHistory updates (e.g. after every API request finishes) trigger a refresh,
	// so stats stay up to date while the view is open.
	const { environment, taskHistory = [] } = useExtensionState()

	const [timeRange, setTimeRange] = useState<UsageTimeRange>("all")
	const [statsData, setStatsData] = useState<UsageStatsData>(EMPTY_STATS)
	const [isLoading, setIsLoading] = useState(true)

	const statsVersion = useMemo(() => {
		// Bump whenever the underlying history changes so effects can re-run
		const last = taskHistory[0]
		return `${taskHistory.length}:${last?.ts ?? 0}:${last?.totalCost ?? 0}:${last?.tokensIn ?? 0}:${last?.tokensOut ?? 0}`
	}, [taskHistory])

	const fetchStats = useCallback(async (range: UsageTimeRange) => {
		setIsLoading(true)
		try {
			const response = await StateServiceClient.getUsageStats(StringRequest.create({ value: range }))
			if (!response.usageJson) {
				setStatsData(EMPTY_STATS)
				return
			}
			const parsed = JSON.parse(response.usageJson)
			setStatsData({
				totalTokensIn: parsed.totals?.tokensIn ?? 0,
				totalTokensOut: parsed.totals?.tokensOut ?? 0,
				totalCacheWrites: parsed.totals?.cacheWrites ?? 0,
				totalCacheReads: parsed.totals?.cacheReads ?? 0,
				totalCost: parsed.totals?.cost ?? 0,
				costBreakdown: {
					inputCost: parsed.totals?.inputCost ?? 0,
					outputCost: parsed.totals?.outputCost ?? 0,
					cacheWritesCost: parsed.totals?.cacheWritesCost ?? 0,
					cacheReadsCost: parsed.totals?.cacheReadsCost ?? 0,
				},
				totalRequests: parsed.totals?.requests ?? 0,
				totalTasks: parsed.totals?.tasks ?? 0,
				modelStats: new Map(parsed.modelStats ?? []),
				trend: parsed.trend ?? [],
			})
		} catch (error) {
			console.error("Failed to load usage stats:", error)
		} finally {
			setIsLoading(false)
		}
	}, [])

	// Use a ref so refreshes caused by state pushes don't re-create the fetch callback
	const fetchStatsRef = useRef(fetchStats)
	fetchStatsRef.current = fetchStats

	useEffect(() => {
		fetchStatsRef.current(timeRange)
	}, [timeRange, statsVersion])

	const handleTimeRangeChange = useCallback((range: UsageTimeRange) => {
		setTimeRange(range)
	}, [])

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<ViewHeader environment={environment} onDone={onDone} title={t("usageStats.title")} />
			<div className="flex-1 overflow-y-auto px-5 pb-6">
				{/* Time Range Selector */}
				<div className="flex gap-2 mb-6">
					{TIME_RANGES.map((range) => (
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
					costBreakdown={statsData.costBreakdown}
					isLoading={isLoading}
					totalCacheReads={statsData.totalCacheReads}
					totalCost={statsData.totalCost}
					totalRequests={statsData.totalRequests}
					totalTokens={statsData.totalTokensIn + statsData.totalTokensOut}
					totalTokensIn={statsData.totalTokensIn}
					totalTokensOut={statsData.totalTokensOut}
				/>

				{/* Usage Trend Chart */}
				<UsageTrendChart isLoading={isLoading} timeRange={timeRange} trend={statsData.trend} />

				{/* Model Statistics Table */}
				<ModelStatsTable isLoading={isLoading} modelStats={statsData.modelStats} />
			</div>
		</div>
	)
}

export default UsageStatsView

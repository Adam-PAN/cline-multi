import { useMemo } from "react"
import { useTranslation } from "react-i18next"

type DailyStats = {
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	cost: number
}

type UsageTrendChartProps = {
	dailyStats: Map<string, DailyStats>
	timeRange: "today" | "week" | "month" | "all"
}

function formatNumber(num: number): string {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + "M"
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + "K"
	}
	return num.toString()
}

// Generate X-axis labels based on time range
function generateXAxisLabels(timeRange: "today" | "week" | "month" | "all"): string[] {
	const now = new Date()

	switch (timeRange) {
		case "today": {
			// 12 hour marks, every 2 hours
			const labels: string[] = []
			for (let i = 0; i < 12; i++) {
				const hour = i * 2
				labels.push(`${hour.toString().padStart(2, "0")}:00`)
			}
			return labels
		}
		case "week": {
			// 7 days, one mark per day
			const labels: string[] = []
			for (let i = 6; i >= 0; i--) {
				const date = new Date(now)
				date.setDate(date.getDate() - i)
				labels.push(`${date.getMonth() + 1}/${date.getDate()}`)
			}
			return labels
		}
		case "month":
		case "all": {
			// 10 marks, every 3 days
			const labels: string[] = []
			for (let i = 9; i >= 0; i--) {
				const date = new Date(now)
				date.setDate(date.getDate() - i * 3)
				labels.push(`${date.getMonth() + 1}/${date.getDate()}`)
			}
			return labels
		}
	}
}

// Get the number of tick positions for the chart
function getTickCount(timeRange: "today" | "week" | "month" | "all"): number {
	switch (timeRange) {
		case "today":
			return 12
		case "week":
			return 7
		case "month":
		case "all":
			return 10
	}
}

export const UsageTrendChart = ({ dailyStats, timeRange }: UsageTrendChartProps) => {
	const { t } = useTranslation("settings")

	const xAxisLabels = useMemo(() => generateXAxisLabels(timeRange), [timeRange])
	const tickCount = useMemo(() => getTickCount(timeRange), [timeRange])

	const chartData = useMemo(() => {
		const entries = Array.from(dailyStats.entries())
		if (entries.length === 0) return []

		// Sort by date
		entries.sort((a, b) => {
			// Handle hour format for "today"
			if (timeRange === "today") {
				return a[0].localeCompare(b[0])
			}
			const [aMonth, aDay] = a[0].split("/").map(Number)
			const [bMonth, bDay] = b[0].split("/").map(Number)
			if (aMonth !== bMonth) return aMonth - bMonth
			return aDay - bDay
		})

		return entries.map(([date, stats]) => ({
			date,
			...stats,
		}))
	}, [dailyStats, timeRange])

	const maxValue = useMemo(() => {
		if (chartData.length === 0) return 1000000
		return Math.max(...chartData.map((d) => d.tokensIn + d.tokensOut + d.cacheReads)) * 1.1 || 1000000
	}, [chartData])

	const maxCost = useMemo(() => {
		if (chartData.length === 0) return 1
		return Math.max(...chartData.map((d) => d.cost)) * 1.1 || 1
	}, [chartData])

	if (chartData.length === 0) {
		return (
			<div className="bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded-lg p-6 mb-6">
				<h3 className="text-lg font-semibold text-[var(--vscode-foreground)] mb-4">{t("usageStats.usageTrend")}</h3>
				<div className="text-center text-[var(--vscode-descriptionForeground)] py-8">{t("usageStats.noData")}</div>
			</div>
		)
	}

	return (
		<div className="bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded-lg p-6 mb-6">
			<h3 className="text-lg font-semibold text-[var(--vscode-foreground)] mb-4">{t("usageStats.usageTrend")}</h3>

			<div className="w-full" style={{ height: "220px" }}>
				<svg className="w-full h-full" preserveAspectRatio="xMidYMid meet" viewBox="0 0 500 200">
					{/* Chart area: x from 50 to 450, y from 10 to 150 */}
					{/* Grid lines */}
					{[0.25, 0.5, 0.75, 1].map((ratio) => (
						<line
							key={`grid-${ratio}`}
							stroke="var(--vscode-widget-border, #444)"
							strokeDasharray="4,4"
							strokeWidth="0.5"
							x1="50"
							x2="450"
							y1={150 - ratio * 140}
							y2={150 - ratio * 140}
						/>
					))}

					{/* Y-axis labels (tokens) */}
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="end" x="45" y="12">
						{formatNumber(maxValue)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="end" x="45" y="47">
						{formatNumber(maxValue * 0.75)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="end" x="45" y="82">
						{formatNumber(maxValue * 0.5)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="end" x="45" y="117">
						{formatNumber(maxValue * 0.25)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="end" x="45" y="152">
						0
					</text>

					{/* Y-axis labels (cost) */}
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="start" x="455" y="12">
						${maxCost.toFixed(2)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="start" x="455" y="47">
						${(maxCost * 0.75).toFixed(2)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="start" x="455" y="82">
						${(maxCost * 0.5).toFixed(2)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="start" x="455" y="117">
						${(maxCost * 0.25).toFixed(2)}
					</text>
					<text fill="var(--vscode-descriptionForeground)" fontSize="9" textAnchor="start" x="455" y="152">
						$0
					</text>

					{/* Axes */}
					<line stroke="var(--vscode-widget-border, #444)" strokeWidth="1" x1="50" x2="450" y1="150" y2="150" />
					<line stroke="var(--vscode-widget-border, #444)" strokeWidth="1" x1="50" x2="50" y1="10" y2="150" />

					{/* X-axis tick marks and labels */}
					{xAxisLabels.map((label, i) => {
						const x = 50 + (i / (xAxisLabels.length - 1)) * 400
						return (
							<g key={`tick-${i}`}>
								<line
									stroke="var(--vscode-widget-border, #444)"
									strokeWidth="1"
									x1={x}
									x2={x}
									y1="150"
									y2="155"
								/>
								<text fill="var(--vscode-descriptionForeground)" fontSize="8" textAnchor="middle" x={x} y="168">
									{label}
								</text>
							</g>
						)
					})}

					{/* Data lines */}
					{chartData.map((d, i) => {
						// Find the closest tick position for this data point
						const x = 50 + (i / (chartData.length - 1 || 1)) * 400
						const inputY = 150 - (d.tokensIn / maxValue) * 140
						const outputY = 150 - (d.tokensOut / maxValue) * 140
						const cacheReadsY = 150 - (d.cacheReads / maxValue) * 140
						const costY = 150 - (d.cost / maxCost) * 140

						return (
							<g key={i}>
								{/* Input tokens line */}
								{i > 0 &&
									(() => {
										const prevX = 50 + ((i - 1) / (chartData.length - 1)) * 400
										const prevInputY = 150 - (chartData[i - 1].tokensIn / maxValue) * 140
										return (
											<line
												fill="none"
												stroke="#3b82f6"
												strokeWidth="2"
												x1={prevX}
												x2={x}
												y1={prevInputY}
												y2={inputY}
											/>
										)
									})()}
								<circle cx={x} cy={inputY} fill="#3b82f6" r="3" />

								{/* Output tokens line */}
								{i > 0 &&
									(() => {
										const prevX = 50 + ((i - 1) / (chartData.length - 1)) * 400
										const prevOutputY = 150 - (chartData[i - 1].tokensOut / maxValue) * 140
										return (
											<line
												fill="none"
												stroke="#22c55e"
												strokeWidth="2"
												x1={prevX}
												x2={x}
												y1={prevOutputY}
												y2={outputY}
											/>
										)
									})()}
								<circle cx={x} cy={outputY} fill="#22c55e" r="3" />

								{/* Cache reads line */}
								{i > 0 &&
									(() => {
										const prevX = 50 + ((i - 1) / (chartData.length - 1)) * 400
										const prevCacheReadsY = 150 - (chartData[i - 1].cacheReads / maxValue) * 140
										return (
											<line
												fill="none"
												stroke="#8b5cf6"
												strokeDasharray="6,3"
												strokeWidth="2"
												x1={prevX}
												x2={x}
												y1={prevCacheReadsY}
												y2={cacheReadsY}
											/>
										)
									})()}
								<circle cx={x} cy={cacheReadsY} fill="#8b5cf6" r="3" />

								{/* Cost line */}
								{i > 0 &&
									(() => {
										const prevX = 50 + ((i - 1) / (chartData.length - 1)) * 400
										const prevCostY = 150 - (chartData[i - 1].cost / maxCost) * 140
										return (
											<line
												fill="none"
												stroke="#ef4444"
												strokeWidth="2"
												x1={prevX}
												x2={x}
												y1={prevCostY}
												y2={costY}
											/>
										)
									})()}
								<circle cx={x} cy={costY} fill="#ef4444" r="3" />
							</g>
						)
					})}
				</svg>
			</div>

			{/* Legend */}
			<div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
				<div className="flex items-center gap-2">
					<div className="w-4 h-0.5 bg-[#3b82f6]" />
					<span className="text-[var(--vscode-foreground)]">{t("usageStats.input")}</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-4 h-0.5 bg-[#22c55e]" />
					<span className="text-[var(--vscode-foreground)]">{t("usageStats.output")}</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-4 h-0.5 bg-[#8b5cf6]" style={{ borderTop: "2px dashed #8b5cf6", height: 0 }} />
					<span className="text-[var(--vscode-foreground)]">{t("usageStats.cacheHits")}</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-4 h-0.5 bg-[#ef4444]" />
					<span className="text-[var(--vscode-foreground)]">{t("usageStats.cost")}</span>
				</div>
			</div>
		</div>
	)
}

export default UsageTrendChart

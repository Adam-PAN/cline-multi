import { useTranslation } from "react-i18next"
import type { CostBreakdown } from "./UsageStatsView"

type UsageSummaryCardProps = {
	totalTokens: number
	totalTokensIn: number
	totalTokensOut: number
	totalCacheReads: number
	totalCost: number
	costBreakdown: CostBreakdown
	totalRequests: number
	isLoading?: boolean
}

function formatNumber(num: number): string {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(2) + "M"
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + "K"
	}
	return num.toLocaleString()
}

function formatCost(cost: number): string {
	return "$" + cost.toFixed(4)
}

export const UsageSummaryCard = ({
	totalTokens,
	totalTokensIn,
	totalTokensOut,
	totalCacheReads,
	totalCost,
	costBreakdown,
	totalRequests,
	isLoading,
}: UsageSummaryCardProps) => {
	const { t } = useTranslation("settings")

	// Calculate cache hit rate based on input tokens
	const cacheHitRate = totalTokensIn > 0 ? (totalCacheReads / totalTokensIn) * 100 : 0

	// Cost breakdown by pricing component (input / cache writes / cache reads / output)
	const costComponents = [
		{ key: "inputCost", label: t("usageStats.costBreakdown.input"), value: costBreakdown.inputCost, color: "#3b82f6" },
		{
			key: "cacheWritesCost",
			label: t("usageStats.costBreakdown.cacheWrites"),
			value: costBreakdown.cacheWritesCost,
			color: "#f97316",
		},
		{
			key: "cacheReadsCost",
			label: t("usageStats.costBreakdown.cacheReads"),
			value: costBreakdown.cacheReadsCost,
			color: "#8b5cf6",
		},
		{ key: "outputCost", label: t("usageStats.costBreakdown.output"), value: costBreakdown.outputCost, color: "#22c55e" },
	]
	const costTotal = costComponents.reduce((acc, c) => acc + c.value, 0)

	return (
		<div className="bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded-lg p-6 mb-6">
			{/* Top row: Total tokens + Total requests + Total cost */}
			<div className="flex items-center gap-4 mb-4">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-[var(--vscode-primediffEditor-insertedTextBackground)] flex items-center justify-center">
						<span className="text-lg">⚡</span>
					</div>
					<div>
						<div className="text-sm text-[var(--vscode-descriptionForeground)]">{t("usageStats.tokensConsumed")}</div>
						<div className="text-3xl font-bold text-[var(--vscode-foreground)]">
							{isLoading ? "..." : formatNumber(totalTokens)}
						</div>
					</div>
				</div>
				<div className="ml-auto flex items-center gap-6">
					<div className="text-right">
						<div className="text-sm text-[var(--vscode-descriptionForeground)]">{t("usageStats.totalRequests")}</div>
						<div className="text-xl font-semibold text-[var(--vscode-foreground)]">
							{isLoading ? "..." : totalRequests}
						</div>
					</div>
					{/* Divider line */}
					<div className="h-10 w-px bg-[var(--vscode-widget-border)] opacity-50" />
					<div className="text-right">
						<div className="text-sm text-[var(--vscode-descriptionForeground)]">{t("usageStats.totalCost")}</div>
						<div className="text-xl font-semibold text-[var(--vscode-foreground)]">
							{isLoading ? "..." : formatCost(totalCost)}
						</div>
					</div>
				</div>
			</div>

			{/* Cost breakdown by pricing component: input / cache writes / cache reads / output */}
			{!isLoading && costTotal > 0 && (
				<div className="mb-4">
					<div className="flex justify-between text-sm mb-1">
						<span className="text-[var(--vscode-descriptionForeground)]">{t("usageStats.costBreakdown.title")}</span>
					</div>
					<div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--vscode-editor-background)]">
						{costComponents.map(
							(component) =>
								component.value > 0 && (
									<div
										className="h-full"
										key={component.key}
										style={{
											width: `${(component.value / costTotal) * 100}%`,
											backgroundColor: component.color,
										}}
										title={`${component.label}: ${formatCost(component.value)}`}
									/>
								),
						)}
					</div>
					<div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
						{costComponents.map((component) => (
							<div className="flex items-center gap-1.5" key={`${component.key}-legend`}>
								<span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: component.color }} />
								<span className="text-[var(--vscode-descriptionForeground)]">{component.label}</span>
								<span className="text-[var(--vscode-foreground)] font-medium">{formatCost(component.value)}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Middle row: Input / Output / Cache Hits - three columns */}
			<div className="grid grid-cols-3 gap-4 mb-4">
				<div className="bg-[var(--vscode-editor-background)] rounded-lg p-4">
					<div className="text-sm text-[var(--vscode-descriptionForeground)] mb-1">↓ {t("usageStats.input")}</div>
					<div className="text-xl font-semibold text-[var(--vscode-foreground)]">{formatNumber(totalTokensIn)}</div>
				</div>
				<div className="bg-[var(--vscode-editor-background)] rounded-lg p-4">
					<div className="text-sm text-[var(--vscode-descriptionForeground)] mb-1">↑ {t("usageStats.output")}</div>
					<div className="text-xl font-semibold text-[var(--vscode-foreground)]">{formatNumber(totalTokensOut)}</div>
				</div>
				<div className="bg-[var(--vscode-editor-background)] rounded-lg p-4">
					<div className="text-sm text-[var(--vscode-descriptionForeground)] mb-1">🎯 {t("usageStats.cacheHits")}</div>
					<div className="text-xl font-semibold text-[var(--vscode-foreground)]">{formatNumber(totalCacheReads)}</div>
				</div>
			</div>

			{/* Cache hit rate bar */}
			<div>
				<div className="flex justify-between text-sm mb-1">
					<span className="text-[var(--vscode-descriptionForeground)]">{t("usageStats.cacheHitRate")}</span>
					<span className="text-[var(--vscode-foreground)] font-medium">{cacheHitRate.toFixed(1)}%</span>
				</div>
				<div className="h-2.5 bg-[var(--vscode-editor-background)] rounded-full overflow-hidden">
					<div
						className="h-full bg-green-500 transition-all duration-300"
						style={{ width: `${Math.min(cacheHitRate, 100)}%` }}
					/>
				</div>
			</div>
		</div>
	)
}

export default UsageSummaryCard

import { useTranslation } from "react-i18next"

type UsageSummaryCardProps = {
	totalTokens: number
	totalTokensIn: number
	totalTokensOut: number
	totalCacheReads: number
	totalCost: number
	totalRequests: number
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
	totalRequests,
}: UsageSummaryCardProps) => {
	const { t } = useTranslation("settings")

	// Calculate cache hit rate based on input tokens
	const cacheHitRate = totalTokensIn > 0 ? (totalCacheReads / totalTokensIn) * 100 : 0

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
						<div className="text-3xl font-bold text-[var(--vscode-foreground)]">{formatNumber(totalTokens)}</div>
					</div>
				</div>
				<div className="ml-auto flex items-center gap-6">
					<div className="text-right">
						<div className="text-sm text-[var(--vscode-descriptionForeground)]">{t("usageStats.totalRequests")}</div>
						<div className="text-xl font-semibold text-[var(--vscode-foreground)]">{totalRequests}</div>
					</div>
					{/* Divider line */}
					<div className="h-10 w-px bg-[var(--vscode-widget-border)] opacity-50" />
					<div className="text-right">
						<div className="text-sm text-[var(--vscode-descriptionForeground)]">{t("usageStats.totalCost")}</div>
						<div className="text-xl font-semibold text-[var(--vscode-foreground)]">{formatCost(totalCost)}</div>
					</div>
				</div>
			</div>

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

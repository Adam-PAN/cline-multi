import type { ClineMessage } from "@shared/ExtensionMessage"
import { getApiMetrics } from "@shared/getApiMetrics"
import { memo, useMemo } from "react"

interface CostBarProps {
	messages: ClineMessage[]
}

const CostBar = memo(({ messages }: CostBarProps) => {
	const metrics = useMemo(() => getApiMetrics(messages), [messages])

	const formatTokens = (n: number): string => {
		if (n >= 1_000_000) {
			return `${(n / 1_000_000).toFixed(1)}M`
		}
		if (n >= 1_000) {
			return `${(n / 1_000).toFixed(1)}K`
		}
		return n.toString()
	}

	const formatCost = (cost: number): string => {
		if (cost < 0.01) {
			return `$${cost.toFixed(4)}`
		}
		return `$${cost.toFixed(2)}`
	}

	if (metrics.totalTokensIn === 0 && metrics.totalTokensOut === 0 && metrics.totalCost === 0) {
		return null
	}

	return (
		<div className="flex items-center justify-between px-3 py-1.5 text-xs text-description border-t border-(--vscode-panel-border) bg-(--vscode-editor-background)/50">
			<div className="flex items-center gap-3">
				<span className="flex items-center gap-1">
					<span className="codicon codicon-arrow-down text-[10px] opacity-60" />
					{formatTokens(metrics.totalTokensIn)} in
				</span>
				<span className="flex items-center gap-1">
					<span className="codicon codicon-arrow-up text-[10px] opacity-60" />
					{formatTokens(metrics.totalTokensOut)} out
				</span>
				{metrics.totalCacheReads != null && metrics.totalCacheReads > 0 && (
					<span className="flex items-center gap-1 opacity-70">
						<span className="codicon codicon-database text-[10px]" />
						{formatTokens(metrics.totalCacheReads)} cached
					</span>
				)}
			</div>
			<div className="flex items-center gap-1 font-medium">
				{metrics.totalCost > 0 ? formatCost(metrics.totalCost) : "..."}
			</div>
		</div>
	)
})

CostBar.displayName = "CostBar"

export default CostBar

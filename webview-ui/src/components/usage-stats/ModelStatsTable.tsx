import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type ModelStats = {
	requests: number
	tokensIn: number
	tokensOut: number
	cost: number
}

type ModelStatsTableProps = {
	modelStats: Map<string, ModelStats>
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

export const ModelStatsTable = ({ modelStats }: ModelStatsTableProps) => {
	const { t } = useTranslation("settings")
	const [sortField, setSortField] = useState<"requests" | "tokens" | "cost">("tokens")
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

	const sortedModels = useMemo(() => {
		const models = Array.from(modelStats.entries()).map(([name, stats]) => ({
			name,
			...stats,
			totalTokens: stats.tokensIn + stats.tokensOut,
		}))

		models.sort((a, b) => {
			let aVal: number, bVal: number
			switch (sortField) {
				case "requests":
					aVal = a.requests
					bVal = b.requests
					break
				case "tokens":
					aVal = a.totalTokens
					bVal = b.totalTokens
					break
				case "cost":
					aVal = a.cost
					bVal = b.cost
					break
				default:
					aVal = a.totalTokens
					bVal = b.totalTokens
			}
			return sortDirection === "desc" ? bVal - aVal : aVal - bVal
		})

		return models
	}, [modelStats, sortField, sortDirection])

	const handleSort = (field: "requests" | "tokens" | "cost") => {
		if (sortField === field) {
			setSortDirection(sortDirection === "desc" ? "asc" : "desc")
		} else {
			setSortField(field)
			setSortDirection("desc")
		}
	}

	const SortIcon = ({ field }: { field: string }) => {
		if (sortField !== field) return <span className="ml-1 text-[var(--vscode-descriptionForeground)]">↕</span>
		return <span className="ml-1 text-[var(--vscode-foreground)]">{sortDirection === "desc" ? "↓" : "↑"}</span>
	}

	return (
		<div className="bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded-lg overflow-hidden">
			<h3 className="text-lg font-semibold text-[var(--vscode-foreground)] p-6 pb-4">{t("usageStats.modelStats")}</h3>

			{sortedModels.length === 0 ? (
				<div className="text-center text-[var(--vscode-descriptionForeground)] py-8">{t("usageStats.noData")}</div>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[var(--vscode-widget-border)]">
								<th className="text-left p-4 text-[var(--vscode-descriptionForeground)] font-medium">
									{t("usageStats.tableHeaders.model")}
								</th>
								<th
									className="text-right p-4 text-[var(--vscode-descriptionForeground)] font-medium cursor-pointer hover:text-[var(--vscode-foreground)]"
									onClick={() => handleSort("requests")}>
									{t("usageStats.tableHeaders.requests")}
									<SortIcon field="requests" />
								</th>
								<th
									className="text-right p-4 text-[var(--vscode-descriptionForeground)] font-medium cursor-pointer hover:text-[var(--vscode-foreground)]"
									onClick={() => handleSort("tokens")}>
									{t("usageStats.tableHeaders.tokens")}
									<SortIcon field="tokens" />
								</th>
								<th
									className="text-right p-4 text-[var(--vscode-descriptionForeground)] font-medium cursor-pointer hover:text-[var(--vscode-foreground)]"
									onClick={() => handleSort("cost")}>
									{t("usageStats.tableHeaders.totalCost")}
									<SortIcon field="cost" />
								</th>
								<th className="text-right p-4 text-[var(--vscode-descriptionForeground)] font-medium">
									{t("usageStats.tableHeaders.avgCost")}
								</th>
							</tr>
						</thead>
						<tbody>
							{sortedModels.map((model) => (
								<tr
									className="border-b border-[var(--vscode-widget-border)] last:border-0 hover:bg-[var(--vscode-list-hoverBackground)]"
									key={model.name}>
									<td className="p-4 text-[var(--vscode-foreground)] font-medium">{model.name}</td>
									<td className="p-4 text-right text-[var(--vscode-foreground)]">{model.requests}</td>
									<td className="p-4 text-right text-[var(--vscode-foreground)]">
										{formatNumber(model.totalTokens)}
									</td>
									<td className="p-4 text-right text-[var(--vscode-foreground)]">{formatCost(model.cost)}</td>
									<td className="p-4 text-right text-[var(--vscode-foreground)]">
										{model.requests > 0 ? formatCost(model.cost / model.requests) : "$0.0000"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

export default ModelStatsTable

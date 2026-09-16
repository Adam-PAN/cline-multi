import { ApiHandler } from "@core/api"
import { usageLog } from "@core/storage/usage-log"
import { execSync } from "child_process"
import { showApprovalNotification } from "@/integrations/notifications"
import type { ClineApiReqCancelReason, ClineApiReqInfo } from "@/shared/ExtensionMessage"
import { calculateApiCostBreakdownAnthropic } from "@/utils/cost"
import { MessageStateHandler } from "./message-state"

export const showNotificationForApproval = (message: string, notificationsEnabled: boolean) => {
	void showApprovalNotification({ message }, notificationsEnabled)
}

type UpdateApiReqMsgParams = {
	messageStateHandler: MessageStateHandler
	lastApiReqIndex: number
	inputTokens: number
	outputTokens: number
	cacheWriteTokens: number
	cacheReadTokens: number
	totalCost?: number
	api: ApiHandler
	cancelReason?: ClineApiReqCancelReason
	streamingFailedMessage?: string
	/** API provider id of the request (e.g. "openai", "openrouter") */
	provider?: string
	/** "plan" | "act" — the mode the request was made in */
	mode?: string
	/** Human readable task snippet to attach to the durable usage log */
	taskSnippet?: string
}

// update api_req_started. we can't use api_req_finished anymore since it's a unique case where it could come after a streaming message (ie in the middle of being updated or executed)
// fortunately api_req_finished was always parsed out for the gui anyways, so it remains solely for legacy purposes to keep track of prices in tasks from history
// (it's worth removing a few months from now)
export const updateApiReqMsg = async (params: UpdateApiReqMsgParams) => {
	const clineMessages = params.messageStateHandler.getClineMessages()
	const currentApiReqInfo: ClineApiReqInfo = JSON.parse(clineMessages[params.lastApiReqIndex].text || "{}")
	delete currentApiReqInfo.retryStatus // Clear retry status when request is finalized

	// Compute the per-component cost breakdown (input / cache writes / cache reads / output)
	// using the model's four pricing components. When an external totalCost is provided,
	// scale the components so they still sum exactly to the recorded total.
	const model = params.api.getModel()
	const breakdown = calculateApiCostBreakdownAnthropic(
		model.info,
		params.inputTokens,
		params.outputTokens,
		params.cacheWriteTokens,
		params.cacheReadTokens,
	)
	const totalCost = params.totalCost ?? breakdown.totalCost
	const scale =
		breakdown.totalCost > 0 && params.totalCost !== undefined && params.totalCost !== breakdown.totalCost
			? params.totalCost / breakdown.totalCost
			: 1

	await params.messageStateHandler.updateClineMessage(params.lastApiReqIndex, {
		text: JSON.stringify({
			...currentApiReqInfo, // Spread the modified info (with retryStatus removed)
			tokensIn: params.inputTokens,
			tokensOut: params.outputTokens,
			cacheWrites: params.cacheWriteTokens,
			cacheReads: params.cacheReadTokens,
			// Record which model served this request so usage stats can attribute tokens/cost per model
			modelId: model.id,
			cost: totalCost,
			inputCost: breakdown.inputCost * scale,
			outputCost: breakdown.outputCost * scale,
			cacheWritesCost: breakdown.cacheWritesCost * scale,
			cacheReadsCost: breakdown.cacheReadsCost * scale,
			cancelReason: params.cancelReason,
			streamingFailedMessage: params.streamingFailedMessage,
		} satisfies ClineApiReqInfo),
	})

	// Durable per-request usage record — survives task deletion and extension
	// reinstalls so usage statistics stay complete and stable over time.
	usageLog.append({
		ts: Date.now(),
		tokensIn: params.inputTokens,
		tokensOut: params.outputTokens,
		cacheWrites: params.cacheWriteTokens,
		cacheReads: params.cacheReadTokens,
		cost: totalCost,
		inputCost: breakdown.inputCost * scale,
		outputCost: breakdown.outputCost * scale,
		cacheWritesCost: breakdown.cacheWritesCost * scale,
		cacheReadsCost: breakdown.cacheReadsCost * scale,
		modelId: model.id,
		taskId: params.messageStateHandler.getTaskId(),
		provider: params.provider,
		mode: params.mode,
		taskSnippet: params.taskSnippet,
	})
}

/**
 * Common CLI tools that developers frequently use
 */
const CLI_TOOLS = [
	"gh",
	"git",
	"docker",
	"podman",
	"kubectl",
	"aws",
	"gcloud",
	"az",
	"terraform",
	"pulumi",
	"npm",
	"yarn",
	"pnpm",
	"pip",
	"cargo",
	"go",
	"curl",
	"jq",
	"make",
	"cmake",
	"python",
	"node",
	"psql",
	"mysql",
	"redis-cli",
	"sqlite3",
	"mongosh",
	"code",
	"grep",
	"sed",
	"awk",
	"brew",
	"apt",
	"yum",
	"gradle",
	"mvn",
	"bundle",
	"dotnet",
	"helm",
	"ansible",
	"wget",
]

/**
 * Detect which CLI tools are available in the system PATH
 * Uses 'which' command on Unix-like systems and 'where' on Windows
 */
export async function detectAvailableCliTools(): Promise<string[]> {
	const availableCommands: string[] = []
	const isWindows = process.platform === "win32"
	const checkCommand = isWindows ? "where" : "which"

	for (const command of CLI_TOOLS) {
		try {
			// Use execSync to check if the command exists
			execSync(`${checkCommand} ${command}`, {
				stdio: "ignore", // Don't output to console
				timeout: 1000, // 1 second timeout to avoid hanging
			})
			availableCommands.push(command)
		} catch (error) {
			// Command not found, skip it
		}
	}

	return availableCommands
}

/**
 * Extracts the domain from a provider URL string
 * @param url The URL to extract domain from
 * @returns The domain/hostname or undefined if invalid
 */
export function extractProviderDomainFromUrl(url: string | undefined): string | undefined {
	if (!url) {
		return undefined
	}
	try {
		const urlObj = new URL(url)
		return urlObj.hostname
	} catch {
		return undefined
	}
}

import { Anthropic } from "@anthropic-ai/sdk"
import { ClineMessageMetricsInfo, ClineMessageModelInfo } from "./metrics"

export type ClinePromptInputContent = string

export type ClineMessageRole = "user" | "assistant"

export interface ClineReasoningDetailParam {
	type: "reasoning.text" | string
	text: string
	signature: string
	format: "anthropic-claude-v1" | string
	index: number
}

interface ClineSharedMessageParam {
	// The id of the response that the block belongs to
	call_id?: string
}

export const REASONING_DETAILS_PROVIDERS = ["cline", "openrouter"]

/**
 * An extension of Anthropic.MessageParam that includes Cline-specific fields: reasoning_details.
 * This ensures backward compatibility where the messages were stored in Anthropic format with additional
 * fields unknown to Anthropic SDK.
 */
export interface ClineTextContentBlock extends Anthropic.TextBlockParam, ClineSharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: ClineReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface ClineImageContentBlock extends Anthropic.ImageBlockParam, ClineSharedMessageParam {}

export interface ClineDocumentContentBlock extends Anthropic.DocumentBlockParam, ClineSharedMessageParam {}

export interface ClineUserToolResultContentBlock extends Anthropic.ToolResultBlockParam, ClineSharedMessageParam {}

/**
 * Assistant only content types
 */
export interface ClineAssistantToolUseBlock extends Anthropic.ToolUseBlockParam, ClineSharedMessageParam {
	// reasoning_details only exists for providers listed in REASONING_DETAILS_PROVIDERS
	reasoning_details?: unknown[] | ClineReasoningDetailParam[]
	// Thought Signature associates with Gemini
	signature?: string
}

export interface ClineAssistantThinkingBlock extends Anthropic.ThinkingBlock, ClineSharedMessageParam {
	// The summary items returned by OpenAI response API
	// The reasoning details that will be moved to the text block when finalized
	summary?: unknown[] | ClineReasoningDetailParam[]
}

export interface ClineAssistantRedactedThinkingBlock extends Anthropic.RedactedThinkingBlockParam, ClineSharedMessageParam {}

export type ClineToolResponseContent = ClinePromptInputContent | Array<ClineTextContentBlock | ClineImageContentBlock>

export type ClineUserContent =
	| ClineTextContentBlock
	| ClineImageContentBlock
	| ClineDocumentContentBlock
	| ClineUserToolResultContentBlock

export type ClineAssistantContent =
	| ClineTextContentBlock
	| ClineImageContentBlock
	| ClineDocumentContentBlock
	| ClineAssistantToolUseBlock
	| ClineAssistantThinkingBlock
	| ClineAssistantRedactedThinkingBlock

export type ClineContent = ClineUserContent | ClineAssistantContent

/**
 * An extension of Anthropic.MessageParam that includes Cline-specific fields.
 * This ensures backward compatibility where the messages were stored in Anthropic format,
 * while allowing for additional metadata specific to Cline to avoid unknown fields in Anthropic SDK
 * added by ignoring the type checking for those fields.
 */
export interface ClineStorageMessage extends Anthropic.MessageParam {
	/**
	 * Response ID associated with this message
	 */
	id?: string
	role: ClineMessageRole
	content: ClinePromptInputContent | ClineContent[]
	/**
	 * NOTE: model information used when generating this message.
	 * Internal use for message conversion only.
	 * MUST be removed before sending message to any LLM provider.
	 */
	modelInfo?: ClineMessageModelInfo
	/**
	 * LLM operational and performance metrics for this message
	 * Includes token counts, costs.
	 */
	metrics?: ClineMessageMetricsInfo
	/**
	 * Timestamp of when the message was created
	 */
	ts?: number
}

/**
/**
 * Strips image blocks from conversation history, replacing them with text placeholders.
 * Used when switching from a multimodal model to a text-only model to prevent API errors.
 *
 * @param messages - Array of ClineStorageMessage to strip images from
 * @returns An object with the stripped messages and whether any images were removed
 */
export function stripImagesFromMessages(messages: ClineStorageMessage[]): {
	messages: ClineStorageMessage[]
	imagesStripped: boolean
} {
	let imagesStripped = false

	const stripped = messages.map((msg) => {
		if (typeof msg.content === "string") {
			return msg
		}

		if (!Array.isArray(msg.content)) {
			return msg
		}

		let hasImage = false
		const newContent = msg.content.map((block: any) => {
			if (block.type === "image") {
				hasImage = true
				return {
					type: "text" as const,
					text: "[Image: content not supported by current model]",
				}
			}
			// Handle tool_result blocks that may contain image content
			if (block.type === "tool_result" && Array.isArray(block.content)) {
				const innerHasImage = block.content.some((inner: any) => inner.type === "image")
				if (innerHasImage) {
					hasImage = true
					return {
						...block,
						content: block.content.map((inner: any) => {
							if (inner.type === "image") {
								return {
									type: "text" as const,
									text: "[Image: content not supported by current model]",
								}
							}
							return inner
						}),
					}
				}
			}
			return block
		})

		if (hasImage) {
			imagesStripped = true
		}

		return hasImage ? { ...msg, content: newContent } : msg
	})

	return { messages: stripped, imagesStripped }
}

/**
 * Converts ClineStorageMessage to Anthropic.MessageParam by removing Cline-specific fields
 * Cline-specific fields (like modelInfo, reasoning_details) are properly omitted.
 */
export function convertClineStorageToAnthropicMessage(
	clineMessage: ClineStorageMessage,
	provider = "anthropic",
): Anthropic.MessageParam {
	const { role, content } = clineMessage

	// Handle string content - fast path
	if (typeof content === "string") {
		return { role, content }
	}

	// Removes thinking block that has no signature (invalid thinking block that's incompatible with Anthropic API)
	const filteredContent = content.filter((b) => b.type !== "thinking" || !!b.signature)

	// Handle array content - strip Cline-specific fields for non-reasoning_details providers
	const shouldCleanContent = !REASONING_DETAILS_PROVIDERS.includes(provider)
	const cleanedContent = shouldCleanContent
		? filteredContent.map(cleanContentBlock)
		: (filteredContent as Anthropic.MessageParam["content"])

	return { role, content: cleanedContent }
}

/**
 * Clean a content block by removing Cline-specific fields and returning only Anthropic-compatible fields
 */
export function cleanContentBlock(block: ClineContent): Anthropic.ContentBlock {
	// Fast path: if no Cline-specific fields exist, return as-is
	const hasClineFields =
		"reasoning_details" in block ||
		"call_id" in block ||
		"summary" in block ||
		(block.type !== "thinking" && "signature" in block)

	if (!hasClineFields) {
		return block as Anthropic.ContentBlock
	}

	// Removes Cline-specific fields & the signature field that's added for Gemini.
	const { reasoning_details, call_id, summary, ...rest } = block as any

	// Remove signature from non-thinking blocks that were added for Gemini
	if (block.type !== "thinking" && rest.signature) {
		rest.signature = undefined
	}

	return rest satisfies Anthropic.ContentBlock
}

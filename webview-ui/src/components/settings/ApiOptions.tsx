import { StringRequest } from "@shared/proto/cline/common"
import PROVIDERS from "@shared/providers/providers.json"
import { Mode } from "@shared/storage/types"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse from "fuse.js"
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useInterval } from "react-use"
import styled from "styled-components"
import { getModeSpecificFields, normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PLATFORM_CONFIG, PlatformType } from "@/config/platform.config"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient } from "@/services/grpc-client"
import { OPENROUTER_MODEL_PICKER_Z_INDEX } from "./OpenRouterModelPicker"
import { AIhubmixProvider } from "./providers/AihubmixProvider"
import { AnthropicProvider } from "./providers/AnthropicProvider"
import { AskSageProvider } from "./providers/AskSageProvider"
import { BasetenProvider } from "./providers/BasetenProvider"
import { BedrockProvider } from "./providers/BedrockProvider"
import { CerebrasProvider } from "./providers/CerebrasProvider"
import { ClaudeCodeProvider } from "./providers/ClaudeCodeProvider"
import { ClineProvider } from "./providers/ClineProvider"
import { DeepSeekProvider } from "./providers/DeepSeekProvider"
import { DifyProvider } from "./providers/DifyProvider"
import { DoubaoProvider } from "./providers/DoubaoProvider"
import { FireworksProvider } from "./providers/FireworksProvider"
import { GeminiProvider } from "./providers/GeminiProvider"
import { GroqProvider } from "./providers/GroqProvider"
import { HicapProvider } from "./providers/HicapProvider"
import { HuaweiCloudMaasProvider } from "./providers/HuaweiCloudMaasProvider"
import { HuggingFaceProvider } from "./providers/HuggingFaceProvider"
import { LiteLlmProvider } from "./providers/LiteLlmProvider"
import { LMStudioProvider } from "./providers/LMStudioProvider"
import { MinimaxProvider } from "./providers/MiniMaxProvider"
import { MistralProvider } from "./providers/MistralProvider"
import { MoonshotProvider } from "./providers/MoonshotProvider"
import { NebiusProvider } from "./providers/NebiusProvider"
import { NousResearchProvider } from "./providers/NousresearchProvider"
import { OcaProvider } from "./providers/OcaProvider"
import { OllamaProvider } from "./providers/OllamaProvider"
import { OpenAICompatibleProvider } from "./providers/OpenAICompatible"
import { OpenAINativeProvider } from "./providers/OpenAINative"
import { OpenAiCodexProvider } from "./providers/OpenAiCodexProvider"
import { OpenRouterProvider } from "./providers/OpenRouterProvider"
import { QwenCodeProvider } from "./providers/QwenCodeProvider"
import { QwenProvider } from "./providers/QwenProvider"
import { RequestyProvider } from "./providers/RequestyProvider"
import { SambanovaProvider } from "./providers/SambanovaProvider"
import { SapAiCoreProvider } from "./providers/SapAiCoreProvider"
import { TogetherProvider } from "./providers/TogetherProvider"
import { VercelAIGatewayProvider } from "./providers/VercelAIGatewayProvider"
import { VertexProvider } from "./providers/VertexProvider"
import { VSCodeLmProvider } from "./providers/VSCodeLmProvider"
import { WandbProvider } from "./providers/WandbProvider"
import { XaiProvider } from "./providers/XaiProvider"
import { ZAiProvider } from "./providers/ZAiProvider"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

interface ApiOptionsProps {
	showModelOptions: boolean
	apiErrorMessage?: string
	modelIdErrorMessage?: string
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

// This is necessary to ensure dropdown opens downward, important for when this is used in popup
export const DROPDOWN_Z_INDEX = OPENROUTER_MODEL_PICKER_Z_INDEX + 2 // Higher than the OpenRouterModelPicker's and ModelSelectorTooltip's z-index

export const DropdownContainer = styled.div<{ zIndex?: number }>`
	position: relative;
	z-index: ${(props) => props.zIndex || DROPDOWN_Z_INDEX};

	// Force dropdowns to open downward
	& vscode-dropdown::part(listbox) {
		position: absolute !important;
		top: 100% !important;
		bottom: auto !important;
	}
`

declare module "vscode" {
	interface LanguageModelChatSelector {
		vendor?: string
		family?: string
		version?: string
		id?: string
	}
}

export const ProfileManager: React.FC<{ currentMode: Mode; showCards?: boolean; showSaveButton?: boolean }> = ({
	currentMode,
	showCards = true,
	showSaveButton = false,
}) => {
	const {
		apiProfiles,
		activeApiProfileId,
		addApiProfile,
		removeApiProfile,
		updateApiProfile,
		reorderApiProfiles,
		applyApiProfile,
		apiConfiguration,
	} = useExtensionState()
	const { selectedProvider } = normalizeApiConfiguration(apiConfiguration, currentMode)
	const [dragIdx, setDragIdx] = useState<number | null>(null)
	const [overIdx, setOverIdx] = useState<number | null>(null)
	const [savedToast, setSavedToast] = useState(false)

	const getProviderDisplayName = (pv: string) => PROVIDERS.list.find((p: any) => p.value === pv)?.label || pv

	const getCurrentModelId = () => {
		const { selectedModelId } = normalizeApiConfiguration(apiConfiguration, currentMode)
		return selectedModelId || ""
	}

	const getCurrentApiKey = () => {
		if (!apiConfiguration) {
			return ""
		}
		const cfg = apiConfiguration as Record<string, any>
		const providerApiKeyField: Record<string, string> = {
			anthropic: "apiKey",
			"claude-code": "apiKey",
			openrouter: "openRouterApiKey",
			bedrock: "awsBedrockApiKey",
			openai: "openAiApiKey",
			ollama: "ollamaApiKey",
			lmstudio: "lmStudioApiKey",
			gemini: "geminiApiKey",
			"openai-native": "openAiNativeApiKey",
			"openai-codex": "openAiCodexApiKey",
			deepseek: "deepSeekApiKey",
			qwen: "qwenApiKey",
			"qwen-code": "qwenCodeApiKey",
			doubao: "doubaoApiKey",
			mistral: "mistralApiKey",
			litellm: "liteLlmApiKey",
			moonshot: "moonshotApiKey",
			nebius: "nebiusApiKey",
			fireworks: "fireworksApiKey",
			asksage: "asksageApiKey",
			xai: "xaiApiKey",
			sambanova: "sambanovaApiKey",
			cerebras: "cerebrasApiKey",
			sapaicore: "sapAiCoreApiKey",
			groq: "groqApiKey",
			huggingface: "huggingFaceApiKey",
			"huawei-cloud-maas": "huaweiCloudMaasApiKey",
			dify: "difyApiKey",
			baseten: "basetenApiKey",
			"vercel-ai-gateway": "vercelAiGatewayApiKey",
			zai: "zaiApiKey",
			minimax: "minimaxApiKey",
			hicap: "hicapApiKey",
			aihubmix: "aihubmixApiKey",
			requesty: "requestyApiKey",
			together: "togetherApiKey",
			nousResearch: "nousResearchApiKey",
			cline: "clineApiKey",
			"vscode-lm": "",
			wandb: "wandbApiKey",
		}
		const field = providerApiKeyField[selectedProvider]
		return (field && cfg[field]) || cfg.apiKey || ""
	}

	const getCurrentBaseUrl = () => {
		if (!apiConfiguration) {
			return ""
		}
		const cfg = apiConfiguration as Record<string, any>
		const baseUrlFields: Record<string, string> = {
			openai: "openAiBaseUrl",
			ollama: "ollamaBaseUrl",
			lmstudio: "lmStudioBaseUrl",
			litellm: "liteLlmBaseUrl",
			anthropic: "anthropicBaseUrl",
			"openai-native": "openAiNativeBaseUrl",
			deepseek: "deepSeekBaseUrl",
			requesty: "requestyBaseUrl",
			dify: "difyBaseUrl",
			gemini: "geminiBaseUrl",
		}
		const field = baseUrlFields[selectedProvider]
		return (field && cfg[field]) || ""
	}

	const getCurrentModelInfo = () => {
		if (!apiConfiguration) {
			return undefined
		}
		const fields = getModeSpecificFields(apiConfiguration, currentMode)
		const modelInfoMap: Record<string, any> = {
			openai: fields.openAiModelInfo,
			deepseek: fields.deepSeekModelInfo,
			openrouter: fields.openRouterModelInfo,
			cline: fields.clineModelInfo,
			requesty: fields.requestyModelInfo,
			groq: fields.groqModelInfo,
			baseten: fields.basetenModelInfo,
			huggingface: fields.huggingFaceModelInfo,
			"huawei-cloud-maas": fields.huaweiCloudMaasModelInfo,
			litellm: fields.liteLlmModelInfo,
			aihubmix: fields.aihubmixModelInfo,
			hicap: fields.hicapModelInfo,
			"vercel-ai-gateway": fields.vercelAiGatewayModelInfo,
			oca: fields.ocaModelInfo,
		}
		return modelInfoMap[selectedProvider]
	}

	const profilePayload = () => {
		const modelInfo = getCurrentModelInfo()
		const payload: {
			provider: typeof selectedProvider
			apiKey: string
			modelId: string
			baseUrl: string
			extra?: Record<string, unknown>
		} = {
			provider: selectedProvider,
			apiKey: getCurrentApiKey(),
			modelId: getCurrentModelId(),
			baseUrl: getCurrentBaseUrl(),
		}
		if (modelInfo) {
			payload.extra = { profileModelInfo: modelInfo }
		}
		return payload
	}

	const handleSave = () => {
		if (activeApiProfileId) {
			updateApiProfile(activeApiProfileId, profilePayload())
		} else {
			const mid = getCurrentModelId()
			addApiProfile({
				name: mid ? `${getProviderDisplayName(selectedProvider)} / ${mid}` : getProviderDisplayName(selectedProvider),
				...profilePayload(),
			})
		}
		setSavedToast(true)
		setTimeout(() => setSavedToast(false), 1500)
	}

	const handleAdd = () => {
		const mid = getCurrentModelId()
		const newP = addApiProfile({
			name: mid ? `${getProviderDisplayName(selectedProvider)} / ${mid}` : getProviderDisplayName(selectedProvider),
			...profilePayload(),
		})
		applyApiProfile(newP.id)
	}

	const handleDelete = (id: string, e: React.MouseEvent) => {
		e.stopPropagation()
		removeApiProfile(id)
	}

	const handleDragStart = (e: React.DragEvent, i: number) => {
		setDragIdx(i)
		e.dataTransfer.effectAllowed = "move"
		e.dataTransfer.setData("text/plain", String(i))
	}
	const handleDragOver = (e: React.DragEvent, i: number) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		setOverIdx(i)
	}
	const handleDrop = (e: React.DragEvent, i: number) => {
		e.preventDefault()
		if (dragIdx !== null && dragIdx !== i) {
			reorderApiProfiles(dragIdx, i)
		}
		setDragIdx(null)
		setOverIdx(null)
	}
	const handleDragEnd = () => {
		setDragIdx(null)
		setOverIdx(null)
	}

	// Save button only
	if (showSaveButton && !showCards) {
		return (
			<button
				onClick={handleSave}
				onMouseEnter={(e) => {
					;(e.currentTarget as HTMLElement).style.background =
						"color-mix(in srgb, var(--vscode-focusBorder) 12%, transparent)"
				}}
				onMouseLeave={(e) => {
					;(e.currentTarget as HTMLElement).style.background = "transparent"
				}}
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 4,
					padding: "3px 10px",
					borderRadius: 4,
					border: "1px solid var(--vscode-focusBorder)",
					background: "transparent",
					color: savedToast ? "var(--vscode-testing-iconPassed)" : "var(--vscode-focusBorder)",
					cursor: "pointer",
					fontSize: 12,
					whiteSpace: "nowrap",
				}}>
				<span className="codicon codicon-save" style={{ fontSize: 13 }} />
				{"保存配置"}
			</button>
		)
	}

	// Cards grid
	if (!showCards) {
		return null
	}
	return (
		<div style={{ marginBottom: 4 }}>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
				{apiProfiles.map((profile, i) => {
					const isActive = profile.id === activeApiProfileId
					const isDragging = dragIdx === i
					const isOver = overIdx === i && dragIdx !== null && dragIdx !== i
					return (
						<div
							draggable
							key={profile.id}
							onClick={() => applyApiProfile(profile.id)}
							onDragEnd={handleDragEnd}
							onDragOver={(e) => handleDragOver(e, i)}
							onDragStart={(e) => handleDragStart(e, i)}
							onDrop={(e) => handleDrop(e, i)}
							style={{
								position: "relative",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								gap: 3,
								padding: "10px 8px 8px",
								borderRadius: 6,
								minHeight: 56,
								cursor: "grab",
								transition: "border-color 0.15s, background 0.15s, opacity 0.15s, transform 0.15s",
								overflow: "hidden",
								background: isActive
									? "color-mix(in srgb, var(--vscode-focusBorder) 10%, transparent)"
									: "var(--vscode-input-background, rgba(128,128,128,0.06))",
								border: isOver
									? "2px dashed var(--vscode-focusBorder)"
									: isActive
										? "1.5px solid var(--vscode-focusBorder)"
										: "1px solid var(--vscode-focusBorder, #007acc)",
								opacity: isDragging ? 0.4 : 1,
								transform: isOver ? "scale(1.03)" : "none",
							}}>
							<button
								onClick={(e) => handleDelete(profile.id, e)}
								onMouseEnter={(e) => {
									;(e.currentTarget as HTMLElement).style.opacity = "1"
									;(e.currentTarget as HTMLElement).style.background = "var(--vscode-toolbar-hoverBackground)"
								}}
								onMouseLeave={(e) => {
									;(e.currentTarget as HTMLElement).style.opacity = "0.3"
									;(e.currentTarget as HTMLElement).style.background = "transparent"
								}}
								style={{
									position: "absolute",
									top: 3,
									right: 3,
									width: 18,
									height: 18,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
									border: "none",
									borderRadius: 3,
									cursor: "pointer",
									color: "var(--vscode-foreground)",
									opacity: 0.3,
									fontSize: 13,
									lineHeight: 1,
									padding: 0,
								}}
								title="删除">
								{"\u00D7"}
							</button>
							<div
								style={{
									fontWeight: 500,
									fontSize: 12,
									lineHeight: "15px",
									textAlign: "center",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									maxWidth: "100%",
									color: isActive ? "var(--vscode-focusBorder)" : "var(--vscode-foreground)",
								}}>
								{profile.modelId || profile.name}
							</div>
							<div
								style={{
									fontSize: 10,
									lineHeight: "13px",
									textAlign: "center",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									maxWidth: "100%",
									opacity: 0.6,
								}}>
								{getProviderDisplayName(profile.provider)}
							</div>
						</div>
					)
				})}
				<div
					onClick={handleAdd}
					onMouseEnter={(e) => {
						;(e.currentTarget as HTMLElement).style.borderColor = "var(--vscode-focusBorder)"
					}}
					onMouseLeave={(e) => {
						;(e.currentTarget as HTMLElement).style.borderColor =
							"var(--vscode-widget-border, rgba(128,128,128,0.25))"
					}}
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						borderRadius: 6,
						minHeight: 56,
						cursor: "pointer",
						background: "transparent",
						border: "1.5px dashed var(--vscode-widget-border, rgba(128,128,128,0.25))",
						transition: "border-color 0.15s",
					}}>
					<span style={{ fontSize: 22, lineHeight: 1, opacity: 0.5 }}>+</span>
				</div>
			</div>
		</div>
	)
}

const ApiOptions = ({
	showModelOptions,
	apiErrorMessage,
	modelIdErrorMessage,
	isPopup,
	currentMode,
	initialModelTab,
}: ApiOptionsProps) => {
	const { t } = useTranslation("settings")
	// Use full context state for immediate save payload
	const { apiConfiguration, remoteConfigSettings } = useExtensionState()

	const { selectedProvider } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const { handleModeFieldChange } = useApiConfigurationHandlers()

	const [_ollamaModels, setOllamaModels] = useState<string[]>([])

	// Poll ollama/vscode-lm models
	const requestLocalModels = useCallback(async () => {
		if (selectedProvider === "ollama") {
			try {
				const response = await ModelsServiceClient.getOllamaModels(
					StringRequest.create({
						value: apiConfiguration?.ollamaBaseUrl || "",
					}),
				)
				if (response?.values) {
					setOllamaModels(response.values)
				}
			} catch (error) {
				console.error("Failed to fetch Ollama models:", error)
				setOllamaModels([])
			}
		}
	}, [selectedProvider, apiConfiguration?.ollamaBaseUrl])
	useEffect(() => {
		if (selectedProvider === "ollama") {
			requestLocalModels()
		}
	}, [selectedProvider, requestLocalModels])
	useInterval(requestLocalModels, selectedProvider === "ollama" ? 2000 : null)

	// Provider search state
	const [searchTerm, setSearchTerm] = useState("")
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const providerOptions = useMemo(() => {
		let providers = PROVIDERS.list
		// Filter by platform
		if (PLATFORM_CONFIG.type !== PlatformType.VSCODE) {
			// Don't include VS Code LM API for non-VSCode platforms
			providers = providers.filter((option) => option.value !== "vscode-lm")
		}

		// Filter by remote config if remoteConfiguredProviders is set
		const remoteProviders: string[] = remoteConfigSettings?.remoteConfiguredProviders || []
		if (remoteProviders.length > 0) {
			providers = providers.filter((option) => remoteProviders.includes(option.value))
		}

		return providers
	}, [remoteConfigSettings])

	const currentProviderLabel = useMemo(() => {
		return providerOptions.find((option) => option.value === selectedProvider)?.label || selectedProvider
	}, [providerOptions, selectedProvider])

	// Sync search term with current provider when not searching
	useEffect(() => {
		if (!isDropdownVisible) {
			setSearchTerm(currentProviderLabel)
		}
	}, [currentProviderLabel, isDropdownVisible])

	const searchableItems = useMemo(() => {
		return providerOptions.map((option) => ({
			value: option.value,
			html: option.label,
		}))
	}, [providerOptions])

	const fuse = useMemo(() => {
		return new Fuse(searchableItems, {
			keys: ["html"],
			threshold: 0.3,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [searchableItems])

	const providerSearchResults = useMemo(() => {
		return searchTerm && searchTerm !== currentProviderLabel ? fuse.search(searchTerm)?.map((r) => r.item) : searchableItems
	}, [searchableItems, searchTerm, fuse, currentProviderLabel])

	const handleProviderChange = (newProvider: string) => {
		handleModeFieldChange({ plan: "planModeApiProvider", act: "actModeApiProvider" }, newProvider as any, currentMode)
		setIsDropdownVisible(false)
		setSelectedIndex(-1)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) {
			return
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < providerSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < providerSearchResults.length) {
					handleProviderChange(providerSearchResults[selectedIndex].value)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				setSearchTerm(currentProviderLabel)
				break
		}
	}

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
				setSearchTerm(currentProviderLabel)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [currentProviderLabel])

	// Reset selection when search term changes
	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [])

	// Scroll selected item into view
	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	/*
	VSCodeDropdown has an open bug where dynamically rendered options don't auto select the provided value prop. You can see this for yourself by comparing  it with normal select/option elements, which work as expected.
	https://github.com/microsoft/vscode-webview-ui-toolkit/issues/433

	In our case, when the user switches between providers, we recalculate the selectedModelId depending on the provider, the default model for that provider, and a modelId that the user may have selected. Unfortunately, the VSCodeDropdown component wouldn't select this calculated value, and would default to the first "Select a model..." option instead, which makes it seem like the model was cleared out when it wasn't.

	As a workaround, we create separate instances of the dropdown for each provider, and then conditionally render the one that matches the current provider.
	*/

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: isPopup ? -10 : 0 }}>
			<style>
				{`
				vscode-text-field {
						display: block !important;
						width: 100% !important;
					}
					vscode-text-field::part(control) {
						width: 100% !important;
					}
					.provider-item-highlight {
					background-color: var(--vscode-editor-findMatchHighlightBackground);
					color: inherit;
				}
				`}
			</style>

			<div
				style={{
					position: "relative",
					border: "1.5px dashed var(--vscode-widget-border, rgba(128,128,128,0.3))",
					borderRadius: 8,
					padding: "16px 14px 14px",
					display: "flex",
					flexDirection: "column",
					gap: 5,
				}}>
				<div style={{ position: "absolute", top: 2, right: 8, zIndex: 10 }}>
					<ProfileManager currentMode={currentMode} showCards={false} showSaveButton={true} />
				</div>

				<DropdownContainer className="dropdown-container">
					{remoteConfigSettings?.remoteConfiguredProviders &&
					remoteConfigSettings.remoteConfiguredProviders.length > 0 ? (
						<Tooltip>
							<TooltipTrigger>
								<div className="flex items-center gap-2 mb-1">
									<label htmlFor="api-provider">
										<span style={{ fontWeight: 500 }}>{t("settings.apiProvider")}</span>
									</label>
									<i className="codicon codicon-lock text-description text-sm" />
								</div>
							</TooltipTrigger>
							<TooltipContent>{t("settings.providerManagedByOrg")}</TooltipContent>
						</Tooltip>
					) : (
						<label htmlFor="api-provider">
							<span style={{ fontWeight: 500 }}>{t("settings.apiProvider")}</span>
						</label>
					)}
					<ProviderDropdownWrapper ref={dropdownRef}>
						<VSCodeTextField
							data-testid="provider-selector-input"
							id="api-provider"
							onFocus={() => {
								setIsDropdownVisible(true)
								setSearchTerm("")
							}}
							onInput={(e) => {
								setSearchTerm((e.target as HTMLInputElement)?.value || "")
								setIsDropdownVisible(true)
							}}
							onKeyDown={handleKeyDown}
							placeholder={t("settings.searchSelectProvider")}
							role="combobox"
							style={{
								width: "100%",
								zIndex: DROPDOWN_Z_INDEX,
								position: "relative",
								minWidth: 130,
							}}
							value={searchTerm}>
							{searchTerm && searchTerm !== currentProviderLabel && (
								<div
									aria-label={t("settings.clearSearch")}
									className="input-icon-button codicon codicon-close"
									onClick={() => {
										setSearchTerm("")
										setIsDropdownVisible(true)
									}}
									slot="end"
									style={{
										display: "flex",
										justifyContent: "center",
										alignItems: "center",
										height: "100%",
									}}
								/>
							)}
						</VSCodeTextField>
						{isDropdownVisible && (
							<ProviderDropdownList ref={dropdownListRef} role="listbox">
								{providerSearchResults.map((item, index) => (
									<ProviderDropdownItem
										data-testid={`provider-option-${item.value}`}
										isSelected={index === selectedIndex}
										key={item.value}
										onClick={() => handleProviderChange(item.value)}
										onMouseEnter={() => setSelectedIndex(index)}
										ref={(el) => {
											itemRefs.current[index] = el
										}}
										role="option">
										<span>{item.html}</span>
									</ProviderDropdownItem>
								))}
							</ProviderDropdownList>
						)}
					</ProviderDropdownWrapper>
				</DropdownContainer>

				{apiConfiguration && selectedProvider === "hicap" && (
					<HicapProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "cline" && (
					<ClineProvider
						currentMode={currentMode}
						initialModelTab={initialModelTab}
						isPopup={isPopup}
						showModelOptions={showModelOptions}
					/>
				)}

				{apiConfiguration && selectedProvider === "asksage" && (
					<AskSageProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "anthropic" && (
					<AnthropicProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "claude-code" && (
					<ClaudeCodeProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "openai-native" && (
					<OpenAINativeProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "openai-codex" && (
					<OpenAiCodexProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "qwen" && (
					<QwenProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "qwen-code" && (
					<QwenCodeProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "doubao" && (
					<DoubaoProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "mistral" && (
					<MistralProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "openrouter" && (
					<OpenRouterProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "deepseek" && (
					<DeepSeekProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "together" && (
					<TogetherProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "openai" && (
					<OpenAICompatibleProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "vercel-ai-gateway" && (
					<VercelAIGatewayProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "sambanova" && (
					<SambanovaProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "bedrock" && (
					<BedrockProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "vertex" && (
					<VertexProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "gemini" && (
					<GeminiProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "requesty" && (
					<RequestyProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "fireworks" && (
					<FireworksProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "vscode-lm" && <VSCodeLmProvider currentMode={currentMode} />}

				{apiConfiguration && selectedProvider === "groq" && (
					<GroqProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}
				{apiConfiguration && selectedProvider === "baseten" && (
					<BasetenProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}
				{apiConfiguration && selectedProvider === "litellm" && (
					<LiteLlmProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "lmstudio" && (
					<LMStudioProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "ollama" && (
					<OllamaProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "moonshot" && (
					<MoonshotProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "huggingface" && (
					<HuggingFaceProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "nebius" && (
					<NebiusProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "wandb" && (
					<WandbProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "xai" && (
					<XaiProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "cerebras" && (
					<CerebrasProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "sapaicore" && (
					<SapAiCoreProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "huawei-cloud-maas" && (
					<HuaweiCloudMaasProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "dify" && (
					<DifyProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "zai" && (
					<ZAiProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "minimax" && (
					<MinimaxProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "nousResearch" && (
					<NousResearchProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiConfiguration && selectedProvider === "oca" && <OcaProvider currentMode={currentMode} isPopup={isPopup} />}

				{apiConfiguration && selectedProvider === "aihubmix" && (
					<AIhubmixProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
				)}

				{apiErrorMessage && (
					<p
						style={{
							margin: "-10px 0 4px 0",
							fontSize: 12,
							color: "var(--vscode-errorForeground)",
						}}>
						{apiErrorMessage}
					</p>
				)}
				{modelIdErrorMessage && (
					<p
						style={{
							margin: "-10px 0 4px 0",
							fontSize: 12,
							color: "var(--vscode-errorForeground)",
						}}>
						{modelIdErrorMessage}
					</p>
				)}
			</div>
		</div>
	)
}

export default ApiOptions

const ProviderDropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

const ProviderDropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${DROPDOWN_Z_INDEX - 1};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const ProviderDropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`

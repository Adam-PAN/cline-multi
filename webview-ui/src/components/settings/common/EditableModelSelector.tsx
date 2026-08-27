import { ModelInfo } from "@shared/api"
import { useTranslation } from "react-i18next"
import styled from "styled-components"

interface EditableModelSelectorProps {
	models: Record<string, ModelInfo>
	selectedModelId: string | undefined
	onChange: (e: any) => void
	label?: string
	placeholder?: string
	zIndex?: number
}

const Container = styled.div<{ $zIndex?: number }>`
	position: relative;
	z-index: ${(p) => p.$zIndex ?? 1000};

	/* Force datalist dropdown to open downward */
	& input::-webkit-calendar-picker-indicator {
		opacity: 0.6;
		cursor: pointer;
	}
`

const Label = styled.label`
	display: block;
	margin-bottom: 4px;

	span {
		font-weight: 500;
		font-size: var(--vscode-font-size, 13px);
		color: var(--color-foreground);
	}
`

const SelectWrapper = styled.div`
	position: relative;
	width: 100%;
`

const StyledInput = styled.input`
	width: 100%;
	box-sizing: border-box;
	padding: 4px 28px 4px 8px;
	height: 26px;
	font-family: var(--font-base);
	font-size: var(--vscode-font-size, 13px);
	color: var(--color-input-foreground);
	background-color: var(--color-input-background);
	border: 1px solid var(--color-input-border);
	border-radius: 2px;
	outline: none;

	&:focus {
		border-color: var(--color-border);
	}

	&::placeholder {
		color: var(--color-input-placeholder);
	}

	&::-webkit-calendar-picker-indicator {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
	}
`

const ArrowIcon = styled.div`
	position: absolute;
	right: 8px;
	top: 50%;
	transform: translateY(-50%);
	pointer-events: none;
	width: 0;
	height: 0;
	border-left: 4px solid transparent;
	border-right: 4px solid transparent;
	border-top: 5px solid var(--color-foreground, #cccccc);
	opacity: 0.6;
`

export const EditableModelSelector = ({
	models,
	selectedModelId,
	onChange,
	label,
	placeholder,
	zIndex,
}: EditableModelSelectorProps) => {
	const { t } = useTranslation("settings")
	const labelValue = label ?? t("settings.model")
	const placeholderValue = placeholder ?? t("settings.selectModel")

	return (
		<Container $zIndex={zIndex}>
			<Label>
				<span>{labelValue}</span>
			</Label>
			<SelectWrapper>
				<StyledInput
					list="editable-model-id-options"
					onChange={(e) => onChange(e)}
					placeholder={placeholderValue}
					spellCheck={false}
					type="text"
					value={selectedModelId ?? ""}
				/>
				<ArrowIcon />
				<datalist id="editable-model-id-options">
					{Object.keys(models).map((modelId) => (
						<option key={modelId} value={modelId} />
					))}
				</datalist>
			</SelectWrapper>
		</Container>
	)
}

import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function RemotelyConfiguredInputWrapper({ hidden, children }: React.PropsWithChildren<{ hidden: boolean }>) {
	const { t } = useTranslation("settings")
	return (
		<Tooltip>
			<TooltipContent hidden={hidden}>{t("settings.remotelyConfiguredMessage")}</TooltipContent>
			{/* asChild + block wrapper: without asChild, Radix renders a <button> which
			    shrinks to fit its content and collapses full-width inputs inside it. */}
			<TooltipTrigger asChild>
				<div style={{ display: "block", width: "100%" }}>{children}</div>
			</TooltipTrigger>
		</Tooltip>
	)
}

export const LockIcon = () => <i className="codicon codicon-lock text-description text-sm" />

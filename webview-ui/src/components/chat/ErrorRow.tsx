import { ClineMessage } from "@shared/ExtensionMessage"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import CreditLimitError from "@/components/chat/CreditLimitError"
import SpendLimitError from "@/components/chat/SpendLimitError"
import { Button } from "@/components/ui/button"
import { useClineAuth, useClineSignIn } from "@/context/ClineAuthContext"
import { ClineError, ClineErrorType } from "../../../../src/services/error/ClineError"

const _errorColor = "var(--vscode-errorForeground)"

interface ErrorRowProps {
	message: ClineMessage
	errorType: "error" | "mistake_limit_reached" | "diff_error" | "clineignore_error"
	apiRequestFailedMessage?: string
	apiReqStreamingFailedMessage?: string
}

const ErrorRow = memo(({ message, errorType, apiRequestFailedMessage, apiReqStreamingFailedMessage }: ErrorRowProps) => {
	const { t } = useTranslation("common")
	const { clineUser } = useClineAuth()
	const rawApiError = apiRequestFailedMessage || apiReqStreamingFailedMessage

	const { isLoginLoading, handleSignIn } = useClineSignIn()

	const renderErrorContent = () => {
		switch (errorType) {
			case "error":
			case "mistake_limit_reached":
				if (rawApiError) {
					const clineError = ClineError.parse(rawApiError)
					const errorMessage = clineError?._error?.message || clineError?.message || rawApiError
					const requestId = clineError?._error?.request_id
					const providerId = clineError?.providerId || clineError?._error?.providerId
					const isClineProvider = providerId === "cline"
					const errorCode = clineError?._error?.code
					const status = clineError?._error?.status

					if (clineError?.isErrorType(ClineErrorType.Balance)) {
						const errorDetails = clineError._error?.details
						return (
							<CreditLimitError
								buyCreditsUrl={errorDetails?.buy_credits_url}
								currentBalance={errorDetails?.current_balance}
								message={errorDetails?.message}
								totalPromotions={errorDetails?.total_promotions}
								totalSpent={errorDetails?.total_spent}
							/>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.SpendLimit)) {
						const d = clineError._error?.details
						return (
							<SpendLimitError
								budgetPeriod={d?.budget_period}
								limitUsd={d?.limit_usd}
								message={d?.message || errorMessage}
								resetsAt={d?.resets_at}
								spentUsd={d?.spent_usd}
							/>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.RateLimit)) {
						return (
							<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</p>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.QuotaExceeded)) {
						const detailMessage = clineError?._error?.details?.message || errorMessage
						return <p className="m-0 whitespace-pre-wrap text-error wrap-anywhere">{detailMessage}</p>
					}

					if (clineError?.isErrorType(ClineErrorType.ModelNotFound)) {
						return (
							<div className="m-0 flex flex-col gap-2 text-error wrap-anywhere">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-warning" />
									<span className="font-bold">模型不存在</span>
								</div>
								<p className="m-0 text-sm opacity-90">
									配置的模型 ID 不正确或已下线。
									{providerId && <span>（Provider: {providerId}）</span>}
									请在设置中检查模型名称是否正确。
								</p>
								{requestId && <div className="text-xs opacity-60">Request ID: {requestId}</div>}
								<div className="mt-2">
									<span className="text-description">{t("error.clickRetry")}</span>
								</div>
							</div>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.ContentFiltered)) {
						return (
							<div className="m-0 flex flex-col gap-2 text-error wrap-anywhere">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-shield" />
									<span className="font-bold">内容被拦截</span>
								</div>
								<p className="m-0 text-sm opacity-90">
									模型的安全策略拦截了本次请求。请调整任务描述，或切换其他模型后重试。
								</p>
								{requestId && <div className="text-xs opacity-60">Request ID: {requestId}</div>}
								<div className="mt-2">
									<span className="text-description">{t("error.clickRetry")}</span>
								</div>
							</div>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.ServerError)) {
						return (
							<div className="m-0 flex flex-col gap-2 text-error wrap-anywhere">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-server" />
									<span className="font-bold">服务商暂时不可用</span>
								</div>
								<p className="m-0 text-sm opacity-90">
									API 服务返回了服务器错误（{status}）。通常是临时问题，系统会自动重试。
									{providerId && <span>（Provider: {providerId}）</span>}
								</p>
								{requestId && <div className="text-xs opacity-60">Request ID: {requestId}</div>}
								<div className="mt-2">
									<span className="text-description">{t("error.clickRetry")}</span>
								</div>
							</div>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.Timeout)) {
						return (
							<div className="m-0 flex flex-col gap-2 text-error wrap-anywhere">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-clock" />
									<span className="font-bold">请求超时</span>
								</div>
								<p className="m-0 text-sm opacity-90">
									API 请求超时，可能是网络不稳定或模型响应过慢。请检查网络连接后重试。
								</p>
								<div className="mt-2">
									<span className="text-description">{t("error.clickRetry")}</span>
								</div>
							</div>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.Network)) {
						return (
							<div className="m-0 flex flex-col gap-2 text-error wrap-anywhere">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-cloud-offline" />
									<span className="font-bold">网络连接失败</span>
								</div>
								<p className="m-0 text-sm opacity-90">
									无法连接到 API 服务。请检查网络连接或代理设置。
									{providerId && <span>（Provider: {providerId}）</span>}
								</p>
								<div className="mt-2">
									<span className="text-description">{t("error.clickRetry")}</span>
								</div>
							</div>
						)
					}

					if (clineError?.isErrorType(ClineErrorType.Auth) && isClineProvider) {
						return !clineUser ? (
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-center rounded border border-neutral-500/30 bg-vscode-editor-background p-6 text-center text-vscode-foreground">
									{t("error.loggedOut")}
								</div>
								<Button className="w-full" disabled={isLoginLoading} onClick={handleSignIn}>
									{t("error.signInToCline")}
									{isLoginLoading && (
										<span className="ml-1 animate-spin">
											<span className="codicon codicon-refresh" />
										</span>
									)}
								</Button>
							</div>
						) : (
							<div className="mt-4">
								<span className="text-description">{t("error.clickRetry")}</span>
							</div>
						)
					}

					return (
						<p className="m-0 whitespace-pre-wrap text-error wrap-anywhere flex flex-col gap-3">
							<header>
								{providerId && <span className="uppercase">[{providerId}] </span>}
								{errorCode && <span>{errorCode}</span>}
								{errorMessage}
								{requestId && <div>Request ID: {requestId}</div>}
							</header>

							{errorMessage?.toLowerCase()?.includes("powershell") && (
								<div>
									{t("error.powershellIssue")}{" "}
									<a
										className="underline text-inherit"
										href="https://github.com/cline/cline/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22">
										{t("error.troubleshootingGuide")}
									</a>
									.
								</div>
							)}

							{errorMessage !== rawApiError && <div>{rawApiError}</div>}

							<div className="mt-4">
								<span className="text-description">{t("error.clickRetry")}</span>
							</div>
						</p>
					)
				}

				return <p className="m-0 mt-0 whitespace-pre-wrap text-error wrap-anywhere">{message.text}</p>

			case "diff_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>{t("error.diffError")}</div>
					</div>
				)

			case "clineignore_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>
							{t("error.clineignoreError")} <code>{message.text}</code> {t("error.clineignoreBlocked")}{" "}
							<code>.clineignore</code> {t("error.clineignoreFile")}
							file.
						</div>
					</div>
				)

			default:
				return null
		}
	}

	if (errorType === "diff_error" || errorType === "clineignore_error") {
		return renderErrorContent()
	}

	return renderErrorContent()
})

export default ErrorRow

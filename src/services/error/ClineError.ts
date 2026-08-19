import { serializeError } from "serialize-error"
import { CLINE_ACCOUNT_AUTH_ERROR_MESSAGE } from "../../shared/ClineAccount"

export enum ClineErrorType {
	Auth = "auth",
	Network = "network",
	RateLimit = "rateLimit",
	Balance = "balance",
	SpendLimit = "spendLimit",
	QuotaExceeded = "quotaExceeded",
	ModelNotFound = "modelNotFound",
	ContentFiltered = "contentFiltered",
	ServerError = "serverError",
	Timeout = "timeout",
}

interface ErrorDetails {
	status?: number
	request_id?: string
	code?: string
	modelId?: string
	providerId?: string
	message?: string
	details?: any
}

const RATE_LIMIT_PATTERNS = [/status code 429/i, /rate limit/i, /too many requests/i, /quota exceeded/i, /resource exhausted/i]

const MODEL_NOT_FOUND_PATTERNS = [
	/model.{0,20}not found/i,
	/model.{0,20}does not exist/i,
	/invalid.{0,20}model/i,
	/unknown model/i,
	/no such model/i,
	/404.{0,30}model/i,
]

const CONTENT_FILTERED_PATTERNS = [
	/content.{0,20}policy/i,
	/content.{0,20}filter/i,
	/content.{0,20}violation/i,
	/safety.{0,20}block/i,
	/blocked.{0,20}content/i,
	/harmful/i,
	/sensitive.{0,20}content/i,
	/moderation/i,
]

const NETWORK_ERROR_PATTERNS = [
	/econnrefused/i,
	/enotfound/i,
	/etimedout/i,
	/econnreset/i,
	/network.{0,20}error/i,
	/socket hang up/i,
	/failed to fetch/i,
	/request.{0,20}timeout/i,
	/timed out/i,
]

export class ClineError extends Error {
	readonly title = "ClineError"
	readonly _error: ErrorDetails

	constructor(
		raw: any,
		public readonly modelId?: string,
		public readonly providerId?: string,
	) {
		const error = serializeError(raw)
		const message = error.message || error?.response?.message || String(error) || error?.cause?.means
		super(message)

		const status = error.status || error.statusCode || error.response?.status
		this.modelId = modelId || error.modelId
		this.providerId = providerId || error.providerId

		this._error = {
			...error,
			message: raw.message || message,
			status,
			request_id:
				error.error?.request_id ||
				error.request_id ||
				error.response?.request_id ||
				error.response?.headers?.["x-request-id"],
			code: error.code || error?.cause?.code,
			modelId: this.modelId,
			providerId: this.providerId,
			details: error.details || error.error,
			stack: undefined,
		}
	}

	public serialize(): string {
		return JSON.stringify({
			message: this.message,
			status: this._error.status,
			request_id: this._error.request_id,
			code: this._error.code,
			modelId: this.modelId,
			providerId: this.providerId,
			details: this._error.details,
		})
	}

	static parse(errorStr?: string, modelId?: string): ClineError | undefined {
		if (!errorStr || typeof errorStr !== "string") {
			return undefined
		}
		return ClineError.transform(errorStr, modelId)
	}

	static transform(error: any, modelId?: string, providerId?: string): ClineError {
		try {
			if (error instanceof ClineError) {
				return error
			}
			return new ClineError(JSON.parse(error), modelId, providerId)
		} catch {
			return new ClineError(error, modelId, providerId)
		}
	}

	public isErrorType(type: ClineErrorType): boolean {
		return ClineError.getErrorType(this) === type
	}

	static getErrorType(err: ClineError): ClineErrorType | undefined {
		const { code, status, details } = err._error
		const message = (err._error?.message || err.message || JSON.stringify(err._error))?.toLowerCase()

		if (code === "insufficient_credits" && typeof details?.current_balance === "number") {
			return ClineErrorType.Balance
		}

		if (code === "SPEND_LIMIT_EXCEEDED" || details?.code === "SPEND_LIMIT_EXCEEDED") {
			return ClineErrorType.SpendLimit
		}

		if (code === "INFERENCE_CAP_ERROR") {
			return ClineErrorType.QuotaExceeded
		}

		// Server errors (5xx)
		if (status !== undefined && status >= 500 && status < 600) {
			return ClineErrorType.ServerError
		}

		const isAuthStatus = status !== undefined && status >= 400 && status < 429
		if (code === "ERR_BAD_REQUEST" || err instanceof AuthInvalidTokenError || isAuthStatus) {
			return ClineErrorType.Auth
		}

		if (message) {
			const authErrorRegex = [/(?:in)?valid[-_ ]?(?:api )?(?:token|key)/i, /authentication[-_ ]?failed/i, /unauthorized/i]
			if (message?.includes(CLINE_ACCOUNT_AUTH_ERROR_MESSAGE) || authErrorRegex.some((regex) => regex.test(message))) {
				return ClineErrorType.Auth
			}

			if (RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message))) {
				return ClineErrorType.RateLimit
			}

			if (MODEL_NOT_FOUND_PATTERNS.some((pattern) => pattern.test(message))) {
				return ClineErrorType.ModelNotFound
			}

			if (CONTENT_FILTERED_PATTERNS.some((pattern) => pattern.test(message))) {
				return ClineErrorType.ContentFiltered
			}

			if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
				return ClineErrorType.Network
			}

			if (status === 408 || /timeout/i.test(message)) {
				return ClineErrorType.Timeout
			}
		}

		return undefined
	}
}

export class AuthNetworkError extends Error {
	constructor(
		message: string,
		override readonly cause?: Error,
	) {
		super(message)
		this.name = ClineErrorType.Network
	}
}

export class AuthInvalidTokenError extends Error {
	constructor(message: string) {
		super(message)
		this.name = ClineErrorType.Auth
	}
}

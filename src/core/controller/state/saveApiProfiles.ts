import { Empty } from "@shared/proto/cline/common"
import type { ApiProfilesState } from "@shared/proto/cline/state"
import type { Controller } from "../index"

/**
 * Persists API config profiles to extension globalState so they survive
 * extension reinstalls/updates and webview storage clears (unlike the previous
 * webview localStorage implementation).
 */
export async function saveApiProfiles(controller: Controller, request: ApiProfilesState): Promise<Empty> {
	try {
		const parsed = JSON.parse(request.profilesJson || "[]")
		if (!Array.isArray(parsed)) {
			throw new Error("profilesJson must be an array")
		}
		controller.stateManager.setGlobalState("apiProfiles", parsed)
		controller.stateManager.setGlobalState("activeApiProfileId", request.activeProfileId || undefined)
	} catch (error) {
		console.error("Failed to save API profiles:", error)
	}
	return Empty.create()
}

import { EmptyRequest } from "@shared/proto/cline/common"
import { ApiProfilesState } from "@shared/proto/cline/state"
import type { Controller } from "../index"

/**
 * Returns the durable API config profiles persisted in extension globalState
 * (NOT webview localStorage, which is wiped whenever the extension is
 * reinstalled/updated or VSCode clears webview storage).
 */
export async function getApiProfiles(controller: Controller, _request: EmptyRequest): Promise<ApiProfilesState> {
	const profiles = controller.stateManager.getGlobalStateKey("apiProfiles") ?? []
	const activeProfileId = controller.stateManager.getGlobalStateKey("activeApiProfileId")
	return ApiProfilesState.create({
		profilesJson: JSON.stringify(profiles ?? []),
		activeProfileId: activeProfileId,
	})
}

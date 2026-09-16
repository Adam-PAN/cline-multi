import type { ApiProvider } from "../../../src/shared/api"
import { EmptyRequest } from "../../../src/shared/proto/cline/common"
import { ApiProfilesState } from "../../../src/shared/proto/cline/state"
import { StateServiceClient } from "../services/grpc-client"

/**
 * API config profiles persistence.
 *
 * Previously these profiles were stored ONLY in webview localStorage, which is
 * wiped whenever the extension is reinstalled/updated or VSCode clears webview
 * storage — users lost all saved profiles. They are now durably persisted in
 * the extension host's globalState (~/.cline/data/globalState.json) via the
 * StateService.getApiProfiles/saveApiProfiles RPCs. localStorage remains as a
 * synchronous cache and as a one-time migration source for existing users.
 */

const STORAGE_KEY = "cline-multi-api-profiles"
const ACTIVE_PROFILE_KEY = "cline-multi-active-profile-id"

export interface ApiConfigProfile {
	id: string
	name: string
	provider: ApiProvider
	apiKey?: string
	modelId?: string
	baseUrl?: string
	extra?: Record<string, unknown>
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---------------------------------------------------------------------------
// Synchronous cache (localStorage) — keeps existing call sites working
// ---------------------------------------------------------------------------

export function loadProfiles(): ApiConfigProfile[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		return JSON.parse(raw) as ApiConfigProfile[]
	} catch {
		return []
	}
}

export function saveProfiles(profiles: ApiConfigProfile[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
	persistToRemote(profiles, getActiveProfileId())
}

export function getActiveProfileId(): string | undefined {
	const id = localStorage.getItem(ACTIVE_PROFILE_KEY)
	return id ?? undefined
}

export function setActiveProfileId(id: string | undefined): void {
	if (id) {
		localStorage.setItem(ACTIVE_PROFILE_KEY, id)
	} else {
		localStorage.removeItem(ACTIVE_PROFILE_KEY)
	}
	persistToRemote(loadProfiles(), id)
}

// ---------------------------------------------------------------------------
// Durable persistence (extension globalState via RPC)
// ---------------------------------------------------------------------------

async function persistToRemote(profiles: ApiConfigProfile[], activeId: string | undefined): Promise<void> {
	try {
		await StateServiceClient.saveApiProfiles(
			ApiProfilesState.create({
				profilesJson: JSON.stringify(profiles),
				activeProfileId: activeId,
			}),
		)
	} catch (error) {
		console.error("Failed to persist API profiles to extension storage:", error)
	}
}

/**
 * Syncs profiles from the durable extension-side storage:
 * - If the remote store is empty and localStorage still holds legacy profiles,
 *   they are migrated to the remote store (one-time upgrade for existing users).
 * - Otherwise the remote copy (source of truth) refreshes the local cache.
 *
 * Call once on webview startup; returns the resulting profiles + active id so
 * React state can be hydrated, or null when the RPC is unavailable.
 */
export async function syncProfilesFromRemote(): Promise<{ profiles: ApiConfigProfile[]; activeId?: string } | null> {
	try {
		const response: ApiProfilesState = await StateServiceClient.getApiProfiles(EmptyRequest.create({}))
		let remoteProfiles: ApiConfigProfile[] = []
		try {
			remoteProfiles = JSON.parse(response.profilesJson || "[]") as ApiConfigProfile[]
		} catch {
			remoteProfiles = []
		}
		const remoteActiveId = response.activeProfileId || undefined

		if (remoteProfiles.length === 0) {
			// Migration: push legacy localStorage profiles to durable storage
			const legacy = loadProfiles()
			const legacyActiveId = getActiveProfileId()
			if (legacy.length > 0) {
				await persistToRemote(legacy, legacyActiveId)
				return { profiles: legacy, activeId: legacyActiveId }
			}
			return { profiles: [], activeId: undefined }
		}

		// Refresh cache from durable storage
		localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteProfiles))
		if (remoteActiveId) {
			localStorage.setItem(ACTIVE_PROFILE_KEY, remoteActiveId)
		} else {
			localStorage.removeItem(ACTIVE_PROFILE_KEY)
		}
		return { profiles: remoteProfiles, activeId: remoteActiveId }
	} catch (error) {
		console.error("Failed to sync API profiles from extension storage:", error)
		return null
	}
}

// ---------------------------------------------------------------------------
// Mutations (cache + durable persistence via saveProfiles/setActiveProfileId)
// ---------------------------------------------------------------------------

export function addProfile(profile: Omit<ApiConfigProfile, "id">): ApiConfigProfile {
	const profiles = loadProfiles()
	const newProfile: ApiConfigProfile = { ...profile, id: generateId() }
	profiles.push(newProfile)
	saveProfiles(profiles)
	return newProfile
}

export function updateProfile(id: string, updates: Partial<Omit<ApiConfigProfile, "id">>): ApiConfigProfile | undefined {
	const profiles = loadProfiles()
	const idx = profiles.findIndex((p) => p.id === id)
	if (idx === -1) return undefined
	profiles[idx] = { ...profiles[idx], ...updates }
	saveProfiles(profiles)
	return profiles[idx]
}

export function removeProfile(id: string): boolean {
	const profiles = loadProfiles()
	const filtered = profiles.filter((p) => p.id !== id)
	if (filtered.length === profiles.length) return false
	saveProfiles(filtered)
	if (getActiveProfileId() === id) {
		setActiveProfileId(undefined)
	}
	return true
}

export function reorderProfiles(fromIndex: number, toIndex: number): ApiConfigProfile[] {
	const profiles = loadProfiles()
	if (fromIndex < 0 || fromIndex >= profiles.length || toIndex < 0 || toIndex >= profiles.length) return profiles
	const [moved] = profiles.splice(fromIndex, 1)
	profiles.splice(toIndex, 0, moved)
	saveProfiles(profiles)
	return profiles
}

export function getProfileById(id: string): ApiConfigProfile | undefined {
	return loadProfiles().find((p) => p.id === id)
}

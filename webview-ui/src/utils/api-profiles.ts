import type { ApiProvider } from "../../../src/shared/api"

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
}

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

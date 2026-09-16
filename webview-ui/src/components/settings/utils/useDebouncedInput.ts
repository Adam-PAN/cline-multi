import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Grace period (ms) after a local edit during which unrecognized external value updates
 * are deferred, so an unexpected state broadcast can't overwrite text the user just typed.
 * Covers the debounce window plus the backend save round-trip.
 */
const EDIT_GRACE_PERIOD_MS = 1000

/**
 * A custom hook that provides debounced input handling to prevent jumpy text inputs
 * when saving changes directly to backend on every keystroke.
 *
 * The debounced save is echoed back through the extension state as a new `initialValue`.
 * To keep typing stable, this hook:
 * 1. Never saves on mount (the initial value is already persisted) and flushes any
 *    uncommitted edit immediately on unmount, so rapid field/tab switches can't lose text.
 * 2. Ignores echoes of values we committed ourselves (echoing an older value back into
 *    the input mid-typing was garbling/scrambling the text).
 * 3. Defers unrecognized external updates for a short grace period after the last local
 *    edit, then applies the latest one only if the user has no uncommitted changes.
 *
 * @param initialValue - The initial value for the input
 * @param onChange - Callback function to save the value (e.g., to backend)
 * @param debounceMs - Debounce delay in milliseconds (default: 100ms)
 * @returns A tuple of [currentValue, setValue] similar to useState
 */
export function useDebouncedInput<T>(initialValue: T, onChange: (value: T) => void, debounceMs = 100): [T, (value: T) => void] {
	// Local state to prevent jumpy input - initialize once
	const [localValue, setLocalValue] = useState(initialValue)

	// Track previous initialValue to detect external changes
	const prevInitialValueRef = useRef(initialValue)

	// Always-fresh views for use inside timers and the unmount flush
	const latestInitialValueRef = useRef(initialValue)
	latestInitialValueRef.current = initialValue

	const latestLocalValueRef = useRef(localValue)
	latestLocalValueRef.current = localValue

	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	const debounceMsRef = useRef(debounceMs)
	debounceMsRef.current = debounceMs

	// Values committed via the debounced onChange that haven't been echoed back yet.
	// Echoes of our own saves must never be written back into the input.
	const pendingEchoesRef = useRef<Set<T>>(new Set())

	// Last value committed through the debounced save, used to detect uncommitted edits
	const lastCommittedValueRef = useRef(initialValue)

	// Timestamp of the last local edit, used to protect in-flight typing from external overwrites
	const lastEditTimeRef = useRef(0)

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const deferredSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const scheduleSave = useCallback(() => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current)
		}
		saveTimerRef.current = setTimeout(() => {
			saveTimerRef.current = null
			const value = latestLocalValueRef.current
			lastCommittedValueRef.current = value
			pendingEchoesRef.current.add(value)
			onChangeRef.current(value)
		}, debounceMsRef.current)
	}, [])

	const setValue = useCallback(
		(value: T) => {
			lastEditTimeRef.current = Date.now()
			setLocalValue(value)
			scheduleSave()
		},
		[scheduleSave],
	)

	// Sync local state when initialValue changes externally (e.g., when switching Plan/Act tabs)
	useEffect(() => {
		if (prevInitialValueRef.current === initialValue) {
			return
		}
		prevInitialValueRef.current = initialValue

		// Ignore the echo of our own debounced save
		if (pendingEchoesRef.current.has(initialValue)) {
			pendingEchoesRef.current.delete(initialValue)
			return
		}

		// Genuinely external change (e.g. Plan/Act switch, remote config): stale pending
		// echoes are no longer meaningful, and if the user isn't mid-edit we can apply it now.
		pendingEchoesRef.current.clear()

		const sinceEditMs = Date.now() - lastEditTimeRef.current
		if (sinceEditMs >= EDIT_GRACE_PERIOD_MS) {
			lastCommittedValueRef.current = initialValue
			setLocalValue(initialValue)
			return
		}

		// The user just typed: defer applying the external value until the grace period ends
		// so an unexpected broadcast can't clobber in-flight keystrokes.
		deferredSyncTimerRef.current = setTimeout(() => {
			deferredSyncTimerRef.current = null
			const current = latestLocalValueRef.current
			const externalValue = latestInitialValueRef.current
			// Take the latest external value only once the user's edits have settled
			// (i.e. there is no uncommitted edit pending).
			if (current === lastCommittedValueRef.current) {
				lastCommittedValueRef.current = externalValue
				setLocalValue(externalValue)
			}
		}, EDIT_GRACE_PERIOD_MS - sinceEditMs)

		return () => {
			if (deferredSyncTimerRef.current) {
				clearTimeout(deferredSyncTimerRef.current)
				deferredSyncTimerRef.current = null
			}
		}
	}, [initialValue])

	// Flush any uncommitted edit on unmount - the debounce timer alone would silently
	// drop the user's last keystrokes when the field is removed (e.g. switching providers).
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current)
				saveTimerRef.current = null
			}
			if (deferredSyncTimerRef.current) {
				clearTimeout(deferredSyncTimerRef.current)
				deferredSyncTimerRef.current = null
			}
			const value = latestLocalValueRef.current
			if (value !== lastCommittedValueRef.current) {
				onChangeRef.current(value)
			}
		}
	}, [])

	return [localValue, setValue]
}

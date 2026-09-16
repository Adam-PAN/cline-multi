import fsSync from "node:fs"
import os from "node:os"
import path from "node:path"
import type { UsageLogEntry } from "@shared/usage-stats"

/**
 * Durable, append-only usage log.
 *
 * Every completed model call is appended as a single JSON line to
 * `<cline-dir>/data/usage-log.jsonl`. Usage statistics are aggregated from this
 * log instead of task history, so records survive task deletion and stay stable
 * across extension reinstalls.
 *
 * Writes are buffered and flushed to disk on a short debounce to avoid one
 * synchronous write per request, while keeping data loss on crash limited to
 * at most the few entries in the pending buffer.
 */

const FLUSH_INTERVAL_MS = 2000

export class UsageLog {
	private filePath: string
	private buffer: UsageLogEntry[] = []
	private flushTimer: NodeJS.Timeout | null = null

	constructor() {
		const clineDir = process.env.CLINE_DIR || path.join(os.homedir(), ".cline")
		const dataDir = path.join(clineDir, "data")
		this.filePath = path.join(dataDir, "usage-log.jsonl")
		fsSync.mkdirSync(dataDir, { recursive: true })
	}

	/** Override the log file location (used by tests). Creates parent dirs. */
	setFilePath(filePath: string): void {
		this.filePath = filePath
		fsSync.mkdirSync(path.dirname(filePath), { recursive: true })
	}

	getFilePath(): string {
		return this.filePath
	}

	/**
	 * Record one model call. The entry is buffered and flushed to disk within
	 * FLUSH_INTERVAL_MS (or on the next flush()/readAll() call).
	 */
	append(entry: UsageLogEntry): void {
		this.buffer.push(entry)
		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => {
				this.flushTimer = null
				this.flush()
			}, FLUSH_INTERVAL_MS)
			// Never keep the process alive just for a pending flush.
			this.flushTimer.unref?.()
		}
	}

	/** Write all pending entries to disk. Failures keep entries queued for retry. */
	flush(): void {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}
		if (this.buffer.length === 0) {
			return
		}
		const pending = this.buffer
		this.buffer = []
		try {
			const lines = pending.map((entry) => JSON.stringify(entry)).join("\n")
			fsSync.appendFileSync(this.filePath, lines + "\n", "utf8")
		} catch (error) {
			// Put entries back at the front so nothing is lost; the next flush retries.
			this.buffer = [...pending, ...this.buffer]
			console.error("UsageLog: failed to append to usage log:", error)
		}
	}

	/**
	 * Read every logged entry. Flushes pending writes first so callers always
	 * see the complete history. Tolerates torn/corrupt lines (skips them).
	 */
	readAll(): UsageLogEntry[] {
		this.flush()
		let content: string
		try {
			content = fsSync.readFileSync(this.filePath, "utf8")
		} catch {
			// Missing file simply means no usage recorded yet.
			return []
		}
		const entries: UsageLogEntry[] = []
		for (const line of content.split("\n")) {
			const trimmed = line.trim()
			if (!trimmed) {
				continue
			}
			try {
				entries.push(JSON.parse(trimmed) as UsageLogEntry)
			} catch {
				// Torn line (e.g. crash mid-write) — skip rather than fail the read.
			}
		}
		return entries
	}
}

/** Shared singleton used by the task pipeline to record model calls. */
export const usageLog = new UsageLog()

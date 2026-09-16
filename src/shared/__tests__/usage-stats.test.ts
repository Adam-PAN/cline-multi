import { strict as assert } from "node:assert"
import fsSync from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "mocha"
import type { ClineMessage } from "../ExtensionMessage"
import type { HistoryItem } from "../HistoryItem"
import {
	aggregateUsageEntries,
	aggregateUsageStats,
	extractUsageEntries,
	getTimeRangeCutoff,
	normalizeUsageEntries,
	type UsageLogEntry,
} from "../usage-stats"

function makeHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
	return {
		id: "task-1",
		ts: Date.now(),
		task: "test task",
		tokensIn: 0,
		tokensOut: 0,
		totalCost: 0,
		...overrides,
	}
}

function makeApiReqMessage(overrides: {
	ts?: number
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	modelId?: string
}): ClineMessage {
	const { ts = Date.now(), ...data } = overrides
	return {
		ts,
		type: "say",
		say: "api_req_started",
		text: JSON.stringify(data),
	}
}

describe("extractUsageEntries", () => {
	it("collects finalized api_req_started messages with modelId", () => {
		const messages: ClineMessage[] = [
			makeApiReqMessage({ ts: 1000, tokensIn: 10, tokensOut: 20, cost: 0.5, modelId: "model-a" }),
			makeApiReqMessage({ ts: 2000, tokensIn: 5, tokensOut: 8, cost: 0.25, modelId: "model-b" }),
			// placeholder message without usage data should be counted as request but produce no entry
			{ ts: 3000, type: "say", say: "api_req_started", text: JSON.stringify({ request: "hi" }) },
		]

		const { usageEntries, apiRequestCount } = extractUsageEntries(messages)

		assert.equal(apiRequestCount, 3)
		assert.equal(usageEntries.length, 2)
		assert.equal(usageEntries[0].modelId, "model-a")
		assert.equal(usageEntries[0].tokensIn, 10)
		assert.equal(usageEntries[1].modelId, "model-b")
	})

	it("collects per-component cost breakdown from api_req_started", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "api_req_started",
				text: JSON.stringify({
					tokensIn: 100,
					tokensOut: 50,
					cacheWrites: 20,
					cacheReads: 30,
					cost: 0.9,
					inputCost: 0.3,
					outputCost: 0.4,
					cacheWritesCost: 0.15,
					cacheReadsCost: 0.05,
					modelId: "model-a",
				}),
			},
		]

		const { usageEntries } = extractUsageEntries(messages)

		assert.equal(usageEntries.length, 1)
		assert.equal(usageEntries[0].inputCost, 0.3)
		assert.equal(usageEntries[0].outputCost, 0.4)
		assert.equal(usageEntries[0].cacheWritesCost, 0.15)
		assert.equal(usageEntries[0].cacheReadsCost, 0.05)
	})

	it("includes deleted_api_reqs and subagent_usage snapshots", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "deleted_api_reqs",
				text: JSON.stringify({ tokensIn: 100, tokensOut: 50, cost: 1 }),
			},
			{
				ts: 2000,
				type: "say",
				say: "subagent_usage",
				text: JSON.stringify({ source: "subagents", tokensIn: 20, tokensOut: 10, cost: 0.5 }),
			},
		]

		const { usageEntries, apiRequestCount } = extractUsageEntries(messages)

		assert.equal(apiRequestCount, 0)
		assert.equal(usageEntries.length, 2)
		assert.equal(usageEntries[0].tokensIn, 100)
		assert.equal(usageEntries[1].tokensIn, 20)
	})

	it("ignores malformed payloads", () => {
		const messages: ClineMessage[] = [
			{ ts: 1000, type: "say", say: "api_req_started", text: "not-json" },
			{ ts: 2000, type: "say", say: "api_req_started", text: JSON.stringify({ tokensIn: "oops" }) },
		]

		const { usageEntries, apiRequestCount } = extractUsageEntries(messages)

		assert.equal(apiRequestCount, 2)
		assert.equal(usageEntries.length, 0)
	})
})

describe("normalizeUsageEntries", () => {
	it("prefers per-request usageEntries when present", () => {
		const item = makeHistoryItem({
			tokensIn: 999,
			tokensOut: 999,
			totalCost: 9,
			usageEntries: [
				{ ts: 1, tokensIn: 1, tokensOut: 2, cacheWrites: 0, cacheReads: 0, cost: 0.1 },
				{ ts: 2, tokensIn: 3, tokensOut: 4, cacheWrites: 0, cacheReads: 0, cost: 0.2 },
			],
		})

		const entries = normalizeUsageEntries(item)

		assert.equal(entries.length, 2)
		assert.equal(entries[0].tokensIn, 1)
	})

	it("falls back to task-level totals for legacy items", () => {
		const item = makeHistoryItem({ tokensIn: 10, tokensOut: 20, totalCost: 0.5, modelId: "model-a" })

		const entries = normalizeUsageEntries(item)

		assert.equal(entries.length, 1)
		assert.equal(entries[0].tokensIn, 10)
		assert.equal(entries[0].modelId, "model-a")
	})

	it("returns empty for items without usage", () => {
		const entries = normalizeUsageEntries(makeHistoryItem({}))
		assert.equal(entries.length, 0)
	})
})

describe("getTimeRangeCutoff", () => {
	it("today starts at local midnight", () => {
		const now = new Date(2026, 8, 12, 15, 30).getTime() // Sep 12 2026 15:30 local
		const cutoff = getTimeRangeCutoff("today", now)
		assert.equal(cutoff, new Date(2026, 8, 12, 0, 0, 0, 0).getTime())
	})

	it("all covers everything", () => {
		assert.equal(getTimeRangeCutoff("all", Date.now()), 0)
	})
})

describe("aggregateUsageStats", () => {
	it("aggregates across the full history with per-model attribution", () => {
		const now = Date.now()
		const items: HistoryItem[] = [
			makeHistoryItem({
				id: "task-1",
				ts: now - 1000,
				usageEntries: [
					{
						ts: now - 1000,
						tokensIn: 100,
						tokensOut: 200,
						cacheWrites: 10,
						cacheReads: 30,
						cost: 1,
						modelId: "model-a",
					},
					{ ts: now - 500, tokensIn: 50, tokensOut: 25, cacheWrites: 5, cacheReads: 15, cost: 0.5, modelId: "model-b" },
				],
			}),
			makeHistoryItem({
				id: "task-2",
				ts: now - 2000,
				// legacy item without usageEntries
				tokensIn: 10,
				tokensOut: 20,
				totalCost: 0.1,
				modelId: "model-a",
			}),
		]

		const result = aggregateUsageStats(items, "all", now)

		assert.equal(result.totals.requests, 3)
		assert.equal(result.totals.tasks, 2)
		assert.equal(result.totals.tokensIn, 160)
		assert.equal(result.totals.tokensOut, 245)
		assert.deepEqual(result.totals.cost, 1.6)

		const modelA = result.modelStats.get("model-a")!
		assert.equal(modelA.requests, 2)
		assert.equal(modelA.tokensIn, 110)

		const modelB = result.modelStats.get("model-b")!
		assert.equal(modelB.requests, 1)
		assert.equal(modelB.tokensOut, 25)
	})

	it("aggregates the four-component cost breakdown across tasks and models", () => {
		const now = Date.now()
		const items: HistoryItem[] = [
			makeHistoryItem({
				id: "task-1",
				ts: now,
				usageEntries: [
					{
						ts: now,
						tokensIn: 100,
						tokensOut: 50,
						cacheWrites: 20,
						cacheReads: 30,
						cost: 0.9,
						inputCost: 0.3,
						outputCost: 0.4,
						cacheWritesCost: 0.15,
						cacheReadsCost: 0.05,
						modelId: "model-a",
					},
				],
			}),
			makeHistoryItem({
				id: "task-2",
				ts: now - 1000,
				usageEntries: [
					{
						ts: now - 1000,
						tokensIn: 10,
						tokensOut: 5,
						cacheWrites: 2,
						cacheReads: 3,
						cost: 0.1,
						inputCost: 0.04,
						outputCost: 0.04,
						cacheWritesCost: 0.01,
						cacheReadsCost: 0.01,
						modelId: "model-b",
					},
				],
			}),
		]

		const result = aggregateUsageStats(items, "all", now)

		assert.deepEqual(result.totals.inputCost, 0.34)
		assert.deepEqual(result.totals.outputCost, 0.44)
		assert.deepEqual(result.totals.cacheWritesCost, 0.16)
		assert.deepEqual(result.totals.cacheReadsCost, 0.06)

		const modelA = result.modelStats.get("model-a")!
		assert.equal(modelA.inputCost, 0.3)
		assert.equal(modelA.outputCost, 0.4)
		assert.equal(modelA.cacheWritesCost, 0.15)
		assert.equal(modelA.cacheReadsCost, 0.05)

		// trend buckets carry the breakdown too
		const todayBucket = result.trend[result.trend.length - 1]
		assert.deepEqual(todayBucket.inputCost, 0.34)
		assert.deepEqual(todayBucket.cacheReadsCost, 0.06)
	})

	it("respects the time range cutoff", () => {
		const now = Date.now()
		const old = now - 10 * 24 * 60 * 60 * 1000 // 10 days ago
		const items: HistoryItem[] = [
			makeHistoryItem({
				id: "old-task",
				ts: old,
				usageEntries: [{ ts: old, tokensIn: 1000, tokensOut: 1000, cacheWrites: 0, cacheReads: 0, cost: 5 }],
			}),
			makeHistoryItem({
				id: "new-task",
				ts: now,
				usageEntries: [{ ts: now, tokensIn: 1, tokensOut: 2, cacheWrites: 0, cacheReads: 0, cost: 0.01 }],
			}),
		]

		const weekResult = aggregateUsageStats(items, "week", now)
		assert.equal(weekResult.totals.requests, 1)
		assert.equal(weekResult.totals.tokensIn, 1)

		const allResult = aggregateUsageStats(items, "all", now)
		assert.equal(allResult.totals.requests, 2)
	})

	it("zero-fills calendar buckets so the trend aligns to dates", () => {
		const now = new Date(2026, 8, 12, 18, 0).getTime() // Sep 12 2026 18:00 local
		const threeDaysAgo = new Date(2026, 8, 9, 10, 0).getTime()
		const items: HistoryItem[] = [
			makeHistoryItem({
				id: "task-1",
				ts: threeDaysAgo,
				usageEntries: [{ ts: threeDaysAgo, tokensIn: 10, tokensOut: 5, cacheWrites: 0, cacheReads: 0, cost: 0.1 }],
			}),
			makeHistoryItem({
				id: "task-2",
				ts: now,
				usageEntries: [{ ts: now, tokensIn: 20, tokensOut: 8, cacheWrites: 0, cacheReads: 0, cost: 0.2 }],
			}),
		]

		const result = aggregateUsageStats(items, "week", now)

		// Sep 6..12 => 7 day buckets
		assert.equal(result.trend.length, 7)
		assert.equal(result.trend[0].label, "9/6")
		assert.equal(result.trend[6].label, "9/12")
		// gap days are zero-filled; Sep 9 is index 3 (Sep 6 is index 0)
		assert.equal(result.trend[1].tokensIn, 0)
		assert.equal(result.trend[2].tokensIn, 0)
		assert.equal(result.trend[3].tokensIn, 10) // Sep 9 has usage
		assert.equal(result.trend[6].tokensIn, 20) // today
	})

	it("today view buckets usage by hour across the whole day", () => {
		const now = new Date(2026, 8, 12, 18, 30).getTime()
		const morning = new Date(2026, 8, 12, 8, 15).getTime()
		const items: HistoryItem[] = [
			makeHistoryItem({
				id: "task-1",
				ts: morning,
				usageEntries: [{ ts: morning, tokensIn: 10, tokensOut: 5, cacheWrites: 0, cacheReads: 0, cost: 0.1 }],
			}),
			makeHistoryItem({
				id: "task-2",
				ts: now,
				usageEntries: [{ ts: now, tokensIn: 20, tokensOut: 8, cacheWrites: 0, cacheReads: 0, cost: 0.2 }],
			}),
		]

		const result = aggregateUsageStats(items, "today", now)

		assert.equal(result.trend.length, 24)
		assert.equal(result.trend[8].tokensIn, 10)
		assert.equal(result.trend[18].tokensIn, 20)
		assert.equal(result.trend[0].tokensIn, 0)
	})

	it("counts tasks with usage data even when task text is empty", () => {
		const now = Date.now()
		const items: HistoryItem[] = [
			makeHistoryItem({
				id: "image-task",
				ts: now,
				task: "", // e.g. images-only task; previously filtered out of stats
				usageEntries: [{ ts: now, tokensIn: 5, tokensOut: 5, cacheWrites: 0, cacheReads: 0, cost: 0.01 }],
			}),
		]

		const result = aggregateUsageStats(items, "all", now)

		assert.equal(result.totals.tasks, 1)
		assert.equal(result.totals.requests, 1)
		assert.equal(result.totals.tokensIn, 5)
	})
})

function makeLogEntry(overrides: Partial<UsageLogEntry> = {}): UsageLogEntry {
	return {
		ts: Date.now(),
		tokensIn: 0,
		tokensOut: 0,
		cacheWrites: 0,
		cacheReads: 0,
		cost: 0,
		...overrides,
	}
}

describe("aggregateUsageEntries", () => {
	it("aggregates log entries with per-model attribution and task dedup", () => {
		const now = Date.now()
		const entries: UsageLogEntry[] = [
			makeLogEntry({
				ts: now - 2000,
				tokensIn: 100,
				tokensOut: 50,
				cacheWrites: 10,
				cacheReads: 20,
				cost: 0.5,
				inputCost: 0.2,
				outputCost: 0.2,
				cacheWritesCost: 0.05,
				cacheReadsCost: 0.05,
				modelId: "model-a",
				taskId: "task-1",
			}),
			makeLogEntry({
				ts: now - 1000,
				tokensIn: 30,
				tokensOut: 20,
				cost: 0.2,
				modelId: "model-a",
				taskId: "task-1", // same task — deduped in task count
			}),
			makeLogEntry({
				ts: now,
				tokensIn: 10,
				tokensOut: 5,
				cost: 0.1,
				modelId: "model-b",
				taskId: "task-2",
			}),
		]

		const result = aggregateUsageEntries(entries, "all", now)

		assert.equal(result.totals.requests, 3)
		assert.equal(result.totals.tasks, 2) // task-1 counted once despite 2 entries
		assert.equal(result.totals.tokensIn, 140)
		assert.equal(result.totals.tokensOut, 75)
		assert.deepEqual(result.totals.cost, 0.8)
		assert.deepEqual(result.totals.cacheWrites, 10)
		assert.deepEqual(result.totals.cacheReads, 20)

		const modelA = result.modelStats.get("model-a")!
		assert.equal(modelA.requests, 2)
		assert.equal(modelA.tokensIn, 130)
		assert.equal(modelA.tokensOut, 70)

		const modelB = result.modelStats.get("model-b")!
		assert.equal(modelB.requests, 1)
		assert.equal(modelB.tokensIn, 10)

		// trend carries the same totals
		const totalTrendTokensIn = result.trend.reduce((sum, bucket) => sum + bucket.tokensIn, 0)
		assert.equal(totalTrendTokensIn, 140)
	})

	it("entries without taskId still count as requests and one task", () => {
		const now = Date.now()
		const entries: UsageLogEntry[] = [makeLogEntry({ ts: now, tokensIn: 5, tokensOut: 5, cost: 0.01, modelId: "model-a" })]

		const result = aggregateUsageEntries(entries, "all", now)

		assert.equal(result.totals.requests, 1)
		assert.equal(result.totals.tasks, 1)
	})

	it("respects the time range cutoff", () => {
		const now = Date.now()
		const old = now - 10 * 24 * 60 * 60 * 1000 // 10 days ago
		const entries: UsageLogEntry[] = [
			makeLogEntry({ ts: old, tokensIn: 1000, tokensOut: 1000, cost: 5, modelId: "model-a", taskId: "old" }),
			makeLogEntry({ ts: now, tokensIn: 1, tokensOut: 2, cost: 0.01, modelId: "model-a", taskId: "new" }),
		]

		const weekResult = aggregateUsageEntries(entries, "week", now)
		assert.equal(weekResult.totals.requests, 1)
		assert.equal(weekResult.totals.tokensIn, 1)

		const allResult = aggregateUsageEntries(entries, "all", now)
		assert.equal(allResult.totals.requests, 2)
	})
})

describe("UsageLog", () => {
	it("persists entries to disk and reads them back", async () => {
		const { UsageLog } = await import("../../core/storage/usage-log")
		const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "cline-usage-log-"))
		try {
			const log = new UsageLog()
			log.setFilePath(path.join(dir, "usage-log.jsonl"))

			log.append(makeLogEntry({ ts: 1000, tokensIn: 10, tokensOut: 20, cost: 0.5, modelId: "model-a", taskId: "t1" }))
			log.append(makeLogEntry({ ts: 2000, tokensIn: 5, tokensOut: 8, cost: 0.25, modelId: "model-b", taskId: "t2" }))
			// readAll flushes pending writes first
			const entries = log.readAll()

			assert.equal(entries.length, 2)
			assert.equal(entries[0].modelId, "model-a")
			assert.equal(entries[0].tokensIn, 10)
			assert.equal(entries[1].modelId, "model-b")

			// entries survive re-reading with a fresh instance (durable on disk)
			const log2 = new UsageLog()
			log2.setFilePath(path.join(dir, "usage-log.jsonl"))
			assert.equal(log2.readAll().length, 2)
		} finally {
			fsSync.rmSync(dir, { recursive: true, force: true })
		}
	})

	it("tolerates torn lines and missing files", async () => {
		const { UsageLog } = await import("../../core/storage/usage-log")
		const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "cline-usage-log-"))
		try {
			const log = new UsageLog()
			const filePath = path.join(dir, "usage-log.jsonl")

			// missing file reads as empty
			log.setFilePath(filePath)
			assert.equal(log.readAll().length, 0)

			// torn line is skipped, valid lines are kept
			const valid = JSON.stringify(makeLogEntry({ ts: 3000, tokensIn: 1, tokensOut: 2, cost: 0.01 }))
			fsSync.writeFileSync(filePath, `{"ts":1000,"tokensIn":\n${valid}\n`, "utf8")
			const entries = log.readAll()
			assert.equal(entries.length, 1)
			assert.equal(entries[0].ts, 3000)
		} finally {
			fsSync.rmSync(dir, { recursive: true, force: true })
		}
	})
})

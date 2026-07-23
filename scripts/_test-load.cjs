const pl = require("@grpc/proto-loader")
const path = require("path")
const fs = require("fs")

async function main() {
	const protoDir = path.resolve("proto")
	const protoFiles = []
	function walk(dir) {
		for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, f.name)
			if (f.isDirectory()) walk(full)
			else if (f.name.endsWith(".proto")) protoFiles.push(full)
		}
	}
	walk(protoDir)

	const pkg = await pl.load(protoFiles, {
		keepCase: true,
		includeDirs: [protoDir],
		enums: String,
		longs: Number,
		defaults: true,
		oneofs: true,
	})

	// Check services
	let svcCount = 0
	for (const [key, val] of Object.entries(pkg)) {
		if (val && typeof val === "object" && "service" in val) {
			svcCount++
			if (key === "cline.StateService") {
				console.log("StateService methods:", Object.keys(val.service).length)
				const getLatest = val.service.getLatestState
				console.log("getLatestState type:", typeof getLatest)
				console.log("  requestType:", getLatest.requestType?.type?.name)
				console.log("  responseType:", getLatest.responseType?.type?.name)
				console.log("  responseStream:", getLatest.responseStream)
				// Check if the request/response types have .create, .toJSON etc
				const reqType = getLatest.requestType
				console.log(
					"  reqType methods:",
					Object.getOwnPropertyNames(Object.getPrototypeOf(reqType)).filter((k) => typeof reqType[k] === "function"),
				)
			}
		}
	}
	console.log("Total services:", svcCount)
}
main().catch((e) => console.error(e.message))

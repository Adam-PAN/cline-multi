const pl = require("@grpc/proto-loader")
const path = require("path")
const fs = require("fs")
const PROTO_DIR = path.resolve("proto")

async function main() {
	const allProtoFiles = []
	function walk(dir) {
		for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, f.name)
			if (f.isDirectory()) walk(full)
			else if (f.name.endsWith(".proto")) allProtoFiles.push(full)
		}
	}
	walk(PROTO_DIR)

	const pkg = await pl.load(allProtoFiles, {
		keepCase: true,
		includeDirs: [PROTO_DIR],
		enums: String,
		longs: Number,
		defaults: true,
		oneofs: true,
	})

	console.log("=== TOP LEVEL KEYS ===")
	console.log(Object.keys(pkg).join("\n"))

	// Check services
	for (const [key, val] of Object.entries(pkg)) {
		if (val && typeof val === "object" && "service" in val) {
			console.log(`\nSERVICE: ${key}`)
			for (const [rpcName, rpc] of Object.entries(val.service)) {
				const reqName = rpc.requestType?.type?.name || "?"
				const resName = rpc.responseType?.type?.name || "?"
				console.log(`  ${rpcName}(${reqName}) => ${resName} stream=${!!rpc.responseStream}`)
			}
		}
	}

	// Check StringRequest
	const sr = pkg["cline.StringRequest"]
	if (sr) {
		console.log("\n=== StringRequest create test ===")
		const inst = sr.create({ value: "hello" })
		console.log("instance:", JSON.stringify(inst))
		console.log("toJSON:", JSON.stringify(sr.toJSON(inst)))
		const encoded = sr.encode(inst).finish()
		console.log("encode length:", encoded.length)
		const decoded = sr.decode(encoded)
		console.log("decode:", JSON.stringify(decoded))
	}
}
main().catch((e) => console.error(e.message, e.stack))

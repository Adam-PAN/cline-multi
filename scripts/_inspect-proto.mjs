const pl = require("@grpc/proto-loader")
const path = require("path")
const PROTO_DIR = path.resolve("proto")

async function main() {
	const allProtoFiles = []
	const fs = require("fs")
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
	console.log(Object.keys(pkg))

	// Check one service
	for (const [key, val] of Object.entries(pkg)) {
		if (val && typeof val === "object" && "service" in val) {
			console.log(`\n=== SERVICE: ${key} ===`)
			for (const [rpcName, rpc] of Object.entries(val.service)) {
				console.log(
					`  ${rpcName}: req=${rpc.requestType?.type?.name} res=${rpc.responseType?.type?.name} stream=${rpc.responseStream}`,
				)
			}
		}
	}

	// Check one message
	const sr = pkg["cline.StringRequest"]
	if (sr) {
		console.log("\n=== StringRequest ===")
		console.log("  create:", typeof sr.create)
		console.log("  toJSON:", typeof sr.toJSON)
		console.log("  fromJSON:", typeof sr.fromJSON)
		console.log("  encode:", typeof sr.encode)
		console.log("  decode:", typeof sr.decode)
		console.log("  verify:", typeof sr.verify)
	}
}
main().catch((e) => console.error(e))

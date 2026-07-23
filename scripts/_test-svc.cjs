const pl = require("@grpc/proto-loader")
const path = require("path")

async function main() {
	const protoDir = path.resolve("proto")
	const pkg = await pl.load(path.join(protoDir, "cline", "state.proto"), {
		keepCase: true,
		includeDirs: [protoDir],
		enums: String,
		longs: Number,
	})

	console.log("Keys:", Object.keys(pkg))
	const ss = pkg["cline.StateService"]
	if (ss) {
		console.log("StateService found!")
		console.log("  has 'service':", "service" in ss)
		console.log("  methods:", Object.keys(ss.service || {}))
	} else {
		console.log("StateService NOT found")
		// Look at all keys and check for service
		for (const [k, v] of Object.entries(pkg)) {
			console.log(k, typeof v, v && typeof v === "object" ? Object.keys(v).slice(0, 5) : "")
		}
	}
}
main().catch((e) => console.error(e.message))

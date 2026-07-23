const pl = require("@grpc/proto-loader")
const path = require("path")

async function main() {
	const protoDir = path.resolve("proto")
	const pkg = await pl.load(path.join(protoDir, "cline", "state.proto"), {
		keepCase: true,
		includeDirs: [protoDir],
		longs: Number,
	})

	const ss = pkg["cline.StateService"]
	console.log("Keys of StateService:", Object.keys(ss))
	console.log("has service:", "service" in ss)
	console.log("service value:", ss.service)
	console.log("format:", ss.format)
	console.log("type:", ss.type)

	// Try the grpc way
	const grpc = require("@grpc/grpc-js")
	const def = grpc.loadPackageDefinition(pkg)
	console.log("\n=== grpc.loadPackageDefinition ===")
	console.log("cline keys:", Object.keys(def.cline))
	const ssGrpc = def.cline.StateService
	console.log("StateService type:", typeof ssGrpc)
	if (ssGrpc && ssGrpc.service) {
		console.log("service definition methods:", Object.keys(ssGrpc.service))
	}
}
main().catch((e) => console.error(e.message, e.stack))

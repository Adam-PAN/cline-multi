const protobuf = require("protobufjs")
const path = require("path")
const fs = require("fs")

async function main() {
	const root = new protobuf.Root()
	root.resolvePath = (origin, target) => path.resolve("proto", target)

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

	await root.load(protoFiles, { keepCase: true })

	// Generate descriptor
	const descriptor = root.toDescriptor()
	const errMsg = protobuf.verify(descriptor)
	if (errMsg) {
		console.error("Descriptor verification failed:", errMsg)
		return
	}

	// Encode to binary
	const descriptorType = protobuf.reflect.lookup("google.protobuf.FileDescriptorSet")
	const msg = descriptorType.create(descriptor)
	const buffer = descriptorType.encode(msg).finish()

	console.log("Descriptor buffer length:", buffer.length)

	// Write to disk
	const outPath = path.resolve("dist-standalone/proto/descriptor_set.pb")
	fs.mkdirSync(path.dirname(outPath), { recursive: true })
	fs.writeFileSync(outPath, buffer)
	console.log("Written to:", outPath)

	// Test loading with proto-loader
	const pl = require("@grpc/proto-loader")
	const pkg = await pl.loadFileDescriptorSetFromBuffer(buffer, { longs: Number })
	console.log("Loaded via proto-loader, keys:", Object.keys(pkg).slice(0, 10).join(", "))

	// Check if services are preserved
	for (const [key, val] of Object.entries(pkg)) {
		if (val && typeof val === "object" && "service" in val) {
			console.log("  Service:", key, "methods:", Object.keys(val.service).length)
		}
	}
}
main().catch((e) => console.error(e.message, e.stack))

const protobuf = require("protobufjs")
const path = require("path")
const fs = require("fs")

async function main() {
	const root = new protobuf.Root()
	root.resolvePath = (origin, target) => {
		return path.resolve("proto", target)
	}

	// Load all proto files
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

	// Check what a message looks like
	const StringRequest = root.lookupType("cline.StringRequest")
	console.log("=== StringRequest ===")
	console.log("fields:", Object.keys(StringRequest.fields))
	console.log("field details:")
	for (const [name, field] of Object.entries(StringRequest.fields)) {
		console.log(`  ${name}: type=${field.type} id=${field.id} rule=${field.rule || "optional"}`)
	}

	// Check an enum
	const ApiFormat = root.lookupEnum("cline.ApiFormat")
	console.log("\n=== ApiFormat enum ===")
	console.log("values:", JSON.stringify(ApiFormat.values))

	// Check a service
	const StateService = root.lookupService("cline.StateService")
	console.log("\n=== StateService ===")
	for (const [name, method] of Object.entries(StateService.methods)) {
		console.log(`  ${name}: ${method.requestType} => ${method.responseType} stream=${!!method.responseStream}`)
	}

	// Check nested types
	console.log("\n=== All namespaces and types ===")
	let msgCount = 0
	let enumCount = 0
	let svcCount = 0
	root.nestedArray.forEach((item) => {
		if (item instanceof protobuf.Type) {
			msgCount++
		}
		if (item instanceof protobuf.Enum) {
			enumCount++
		}
		if (item instanceof protobuf.Service) {
			svcCount++
		}
		if (item.nestedArray) {
			item.nestedArray.forEach((sub) => {
				if (sub instanceof protobuf.Type) msgCount++
				if (sub instanceof protobuf.Enum) enumCount++
				if (sub instanceof protobuf.Service) svcCount++
			})
		}
	})
	console.log(`Messages: ${msgCount}, Enums: ${enumCount}, Services: ${svcCount}`)
}
main().catch((e) => console.error(e.message, e.stack))

const protobuf = require("protobufjs")
const path = require("path")
const fs = require("fs")
async function main() {
	const root = new protobuf.Root()
	root.resolvePath = (o, t) => path.resolve("proto", t)
	const protoFiles = []
	function walk(dir) {
		for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, f.name)
			if (f.isDirectory()) walk(full)
			else if (f.name.endsWith(".proto")) protoFiles.push(full)
		}
	}
	walk(path.resolve("proto"))
	await root.load(protoFiles, { keepCase: true })

	// Get JSON representation
	const json = root.toJSON()
	// Check one package
	const hostPkg = json.nested?.host
	const ws = hostPkg?.nested?.SearchWorkspaceItemsRequest
	console.log("SearchWorkspaceItemsRequest:", JSON.stringify(ws, null, 2).substring(0, 500))
}
main().catch((e) => console.error(e.message))

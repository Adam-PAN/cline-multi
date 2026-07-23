const path = require("path")
const fs = require("fs")
const PROTO_DIR = path.resolve("proto")
const allFiles = []
function walk(dir) {
	for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, f.name)
		if (f.isDirectory()) walk(full)
		else if (f.name.endsWith(".proto")) allFiles.push(full)
	}
}
walk(PROTO_DIR)

const importedFiles = new Set()
for (const filePath of allFiles) {
	const content = fs.readFileSync(filePath, "utf-8")
	const importRegex = /import\s+"([^"]+)"/g
	let match
	while ((match = importRegex.exec(content)) !== null) {
		importedFiles.add(path.resolve(PROTO_DIR, match[1]))
	}
}
const rootFiles = allFiles.filter((f) => !importedFiles.has(f))
console.log("Total proto files:", allFiles.length)
console.log("Imported files:", importedFiles.size)
console.log("Root files:", rootFiles.length)
for (const f of rootFiles) console.log(" ", path.relative(PROTO_DIR, f))

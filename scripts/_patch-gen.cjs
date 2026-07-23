const fs = require("fs")
const path = require("path")

const f = path.resolve("C:/Users/Administrator/Documents/Cline-Multi/cline-multi/scripts/generate-proto-ts.mjs")
let c = fs.readFileSync(f, "utf-8")

const oldStart = "    // Generate TypeScript for each package"
const oldEnd =
	'        // Write index file\n        await fs.writeFile(path.join(dir, "index.ts"), lines.join("\\n"), "utf-8")\n    }'

const idx1 = c.indexOf(oldStart)
const idx2 = c.indexOf(oldEnd)
if (idx1 === -1 || idx2 === -1) {
	console.log("Markers not found", idx1, idx2)
	process.exit(1)
}

const newSection = fs.readFileSync(
	"C:/Users/Administrator/Documents/Cline-Multi/cline-multi/scripts/_new-gen-section.cjs",
	"utf-8",
)
c = c.substring(0, idx1) + newSection + c.substring(idx2 + oldEnd.length)

fs.writeFileSync(f, c, "utf-8")
console.log("Updated!")

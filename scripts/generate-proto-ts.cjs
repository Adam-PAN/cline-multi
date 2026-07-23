#!/usr/bin/env node
const protobuf = require("protobufjs")
const path = require("path")
const fs = require("fs")

const PROTO_DIR = path.resolve("proto")
const TS_OUT_DIR = path.resolve("src/shared/proto")

// grpc-tools includes the well-known google protobuf types
const GRPC_TOOLS_INCLUDE = path.join(path.dirname(require.resolve("grpc-tools")), "bin")

const SCALAR = {
	double: "number",
	float: "number",
	int32: "number",
	int64: "number",
	uint32: "number",
	uint64: "number",
	sint32: "number",
	sint64: "number",
	fixed32: "number",
	fixed64: "number",
	sfixed32: "number",
	sfixed64: "number",
	bool: "boolean",
	string: "string",
	bytes: "Uint8Array",
}

// Well-known types that need special import handling
const WELL_KNOWN_TYPES = new Set([
	".google.protobuf.Timestamp",
	".google.protobuf.FieldMask",
	".google.protobuf.Duration",
	".google.protobuf.Any",
	".google.protobuf.Struct",
	".google.protobuf.Value",
	".google.protobuf.ListValue",
	".google.protobuf.NullValue",
])

function toCamel(s) {
	return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function tsType(field, ctx) {
	// Handle map fields: map<KeyType, ValueType> -> Record<KeyType, ValueType>
	if (field.map) {
		const keyType = SCALAR[field.keyType] || "any"
		const valType = SCALAR[field.type] || (field.resolvedType ? ctx.resolveRef(field.resolvedType) : "any")
		return "Record<" + keyType + ", " + valType + ">"
	}
	const scalar = SCALAR[field.type]
	if (scalar) return field.repeated ? scalar + "[]" : scalar
	if (!field.resolvedType) return field.repeated ? "any[]" : "any"
	const name = ctx.resolveRef(field.resolvedType)
	return field.repeated ? name + "[]" : name
}

function defVal(field) {
	if (field.repeated) return "[]"
	const s = SCALAR[field.type]
	if (s === "number") return "0"
	if (s === "boolean") return "false"
	if (s === "string") return '""'
	if (s === "Uint8Array") return "new Uint8Array(0)"
	if (field.resolvedType && field.resolvedType.values) {
		const v = Object.values(field.resolvedType.values)
		return String(v[0] ?? 0)
	}
	return "undefined"
}

// Check if a field is explicitly marked optional in the proto source
function isOptionalField(field) {
	return field.options && field.options.proto3_optional === true
}

function genFile(relPath, types, enums, services, ctx) {
	const lines = ["// GENERATED CODE -- DO NOT EDIT!", "", "/* eslint-disable */", ""]

	// Collect imports from other files (including well-known types)
	const imports = {}
	const wellKnownImports = new Set()

	function addImport(resolvedType) {
		if (!resolvedType) return
		const fullName = resolvedType.fullName || ""

		// Check if it's a well-known type (these have filename: null)
		if (WELL_KNOWN_TYPES.has(fullName) || (resolvedType.fullName && resolvedType.fullName.startsWith("google.protobuf."))) {
			wellKnownImports.add(resolvedType.name)
			return
		}

		if (!resolvedType.filename) return
		const fromFile = path.relative(PROTO_DIR, resolvedType.filename).split(path.sep).join("/")
		if (fromFile === relPath) return // same file
		const importPath =
			"./" +
			path
				.relative(path.dirname(relPath), fromFile.replace(/\.proto$/, ""))
				.split(path.sep)
				.join("/")
		if (!imports[importPath]) imports[importPath] = new Set()
		imports[importPath].add(resolvedType.name)
	}

	function scanType(type) {
		for (const f of Object.values(type.fields || {})) {
			if (f.resolvedType) addImport(f.resolvedType)
		}
		for (const n of type.nestedArray || []) {
			if (n instanceof protobuf.Type) scanType(n)
		}
	}
	for (const t of types) scanType(t)
	// Also scan service methods for imports
	for (const s of services) {
		for (const m of Object.values(s.methods || {})) {
			if (m.resolvedRequestType) addImport(m.resolvedRequestType)
			if (m.resolvedResponseType) addImport(m.resolvedResponseType)
		}
	}

	// Import DeepPartial from google/protobuf if we use well-known types, otherwise define locally
	if (wellKnownImports.size > 0) {
		lines.push("import { DeepPartial, " + [...wellKnownImports].join(", ") + ' } from "../google/protobuf"')
	} else {
		lines.push("type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T")
	}
	lines.push("")

	for (const [imp, names] of Object.entries(imports)) {
		lines.push("import { " + [...names].join(", ") + ' } from "' + imp + '"')
	}
	if (Object.keys(imports).length > 0) lines.push("")

	// Generate enums
	for (const e of enums) {
		lines.push(genEnum(e))
		lines.push("")
	}

	// Generate types
	for (const t of types) {
		lines.push(genType(t, ctx, 0))
		lines.push("")
	}

	// Generate services
	for (const s of services) {
		lines.push(genSvc(s, ctx))
		lines.push("")
	}

	return lines.join("\n")
}

function genEnum(e) {
	const lines = ["export enum " + e.name + " {"]
	for (const [n, v] of Object.entries(e.values)) lines.push("\t" + n + " = " + v + ",")
	// Add UNRECOGNIZED value for ts-proto compatibility
	if (!("UNRECOGNIZED" in e.values)) {
		lines.push("\tUNRECOGNIZED = -1,")
	}
	lines.push("}")
	const lo = e.name[0].toLowerCase() + e.name.slice(1)
	lines.push("export function " + lo + "ToJSON(e: " + e.name + "): string { return " + e.name + '[e] ?? ("" + e) }')
	lines.push(
		"export function " +
			lo +
			"FromJSON(s: string): " +
			e.name +
			" { return (s in " +
			e.name +
			") ? (" +
			e.name +
			" as any)[s] : 0 }",
	)
	return lines.join("\n")
}

function genType(type, ctx, depth) {
	const prefix = depth > 0 ? "\t".repeat(depth) : ""
	const lines = []

	// Interface - fields are required unless explicitly marked optional in proto
	lines.push(prefix + (depth === 0 ? "export " : "") + "interface " + type.name + " {")
	for (const [n, f] of Object.entries(type.fields)) {
		const opt = isOptionalField(f) ? "?" : ""
		const ts = tsType(f, ctx)
		// For repeated fields and message fields that are NOT optional, they still need a way to represent absence
		// But ts-proto with useOptionals=none makes them required
		// For message type fields that aren't optional, use the type directly (they'll be initialized)
		const isMsgType = !SCALAR[f.type] && !f.repeated && f.resolvedType && !f.resolvedType.values
		lines.push(prefix + "\t" + toCamel(n) + opt + ": " + ts + (isMsgType ? " | undefined" : ""))
	}
	lines.push(prefix + "}")

	// Nested types
	for (const nested of type.nestedArray || []) {
		if (nested instanceof protobuf.Type) {
			lines.push("")
			const prefixedType = Object.create(nested)
			prefixedType.name = type.name + "_" + nested.name
			lines.push(genType(prefixedType, ctx, depth))
		}
		if (nested instanceof protobuf.Enum) {
			lines.push("")
			const prefixedEnum = Object.create(nested)
			prefixedEnum.name = type.name + "_" + nested.name
			lines.push(
				prefix +
					genEnum(prefixedEnum)
						.split("\n")
						.join("\n" + prefix),
			)
		}
	}

	if (depth === 0) {
		lines.push("")
		const nm = type.name
		lines.push("export const " + nm + " = {")
		lines.push("\tcreate(base?: DeepPartial<" + nm + ">): " + nm + " { return { ...base } as " + nm + " },")
		lines.push("\ttoJSON(m: " + nm + "): unknown {")
		lines.push("\t\tconst o: any = {}")
		for (const [n, f] of Object.entries(type.fields)) {
			if (f.repeated) lines.push("\t\tif (m." + toCamel(n) + "?.length) o." + toCamel(n) + " = m." + toCamel(n))
			else lines.push("\t\tif (m." + toCamel(n) + " !== undefined) o." + toCamel(n) + " = m." + toCamel(n))
		}
		lines.push("\t\treturn o")
		lines.push("\t},")
		lines.push("\tfromJSON(o: any): " + nm + " {")
		lines.push("\t\tconst m = {} as " + nm)
		for (const [n, f] of Object.entries(type.fields)) {
			if (f.repeated) lines.push("\t\tm." + toCamel(n) + " = o." + toCamel(n) + "?.map((e: any) => e) ?? []")
			else lines.push("\t\tm." + toCamel(n) + " = o." + toCamel(n) + " ?? " + defVal(f))
		}
		lines.push("\t\treturn m")
		lines.push("\t},")
		lines.push("\tencode(m: " + nm + ", w: any = {bytes:[]}): any { return w },")
		lines.push("\tdecode(i: any, l?: number): " + nm + " { return {} as " + nm + " },")
		lines.push("\tfromPartial(o: DeepPartial<" + nm + ">): " + nm + " { return { ...o } as " + nm + " },")
		lines.push("}")
	}

	return lines.join("\n")
}

function genSvc(svc, ctx) {
	const lines = ["export interface " + svc.name + " {"]
	for (const [n, m] of Object.entries(svc.methods)) {
		const req = ctx.resolveRef(m.requestType)
		const res = ctx.resolveRef(m.responseType)
		if (m.responseStream) {
			lines.push(
				"\t" +
					n +
					"(request: " +
					req +
					", cb: {onResponse:(r:" +
					res +
					")=>void, onError:(e:Error)=>void, onComplete:()=>void}): ()=>void",
			)
		} else {
			lines.push("\t" + n + "(request: " + req + "): Promise<" + res + ">")
		}
	}
	lines.push("}")
	lines.push("")
	lines.push("export const " + svc.name + "Definition = {")
	lines.push('\tname: "' + svc.name + '",')
	lines.push('\tfullName: "' + svc.fullName.replace(/^\./, "") + '",')
	lines.push("\tmethods: {")
	for (const [n, m] of Object.entries(svc.methods)) {
		const req = ctx.resolveRef(m.resolvedRequestType)
		const res = ctx.resolveRef(m.resolvedResponseType)
		lines.push("\t\t" + n + ": {")
		lines.push('\t\t\tname: "' + n.charAt(0).toUpperCase() + n.slice(1) + '",')
		lines.push("\t\t\trequestStream: " + (m.requestStream ? true : false) + ",")
		lines.push("\t\t\tresponseStream: " + (m.responseStream ? true : false) + ",")
		lines.push("\t\t\trequestType: " + req + ",")
		lines.push("\t\t\tresponseType: " + res + ",")
		lines.push("\t\t\toptions: {},")
		lines.push("\t\t},")
	}
	lines.push("\t},")
	lines.push("}")
	return lines.join("\n")
}

async function main() {
	console.log("Generating TypeScript from proto files...")

	const root = new protobuf.Root()
	// Resolve paths from both our proto dir and grpc-tools include dir
	root.resolvePath = (origin, target) => {
		// Try our proto directory first
		const protoPath = path.resolve(PROTO_DIR, target)
		if (fs.existsSync(protoPath)) return protoPath
		// Try grpc-tools include directory (for google well-known types)
		const grpcPath = path.resolve(GRPC_TOOLS_INCLUDE, target)
		if (fs.existsSync(grpcPath)) return grpcPath
		// Fallback to proto dir
		return protoPath
	}

	// Collect all proto files
	const files = []
	function walk(d) {
		for (const f of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, f.name)
			if (f.isDirectory()) walk(p)
			else if (f.name.endsWith(".proto")) files.push(p)
		}
	}
	walk(PROTO_DIR)

	await root.load(files, { keepCase: true })

	// Build resolution context
	const fileItems = {}
	function addItem(item, kind) {
		if (!item.filename) return
		const rel = path.relative(PROTO_DIR, item.filename).split(path.sep).join("/")
		// Skip files from grpc-tools include (well-known types)
		if (rel.startsWith("..")) return
		if (!fileItems[rel]) fileItems[rel] = { types: [], enums: [], services: [] }
		fileItems[rel][kind].push(item)
	}
	function walkNs(ns) {
		for (const n of ns.nestedArray || []) {
			if (n instanceof protobuf.Type) addItem(n, "types")
			else if (n instanceof protobuf.Enum) addItem(n, "enums")
			else if (n instanceof protobuf.Service) addItem(n, "services")
			else if (n instanceof protobuf.Namespace) walkNs(n)
		}
	}
	walkNs(root)

	const ctx = {
		resolveRef(resolved) {
			if (!resolved) return "any"
			// If the resolved type is nested inside a message type, prefix with parent name
			if (resolved.parent && resolved.parent instanceof protobuf.Type) {
				return resolved.parent.name + "_" + resolved.name
			}
			return resolved.name
		},
	}
	let totalMsg = 0,
		totalEnum = 0,
		totalSvc = 0

	for (const [rel, data] of Object.entries(fileItems)) {
		const tsFile = path.join(TS_OUT_DIR, rel.replace(/\.proto$/, ".ts"))
		fs.mkdirSync(path.dirname(tsFile), { recursive: true })
		const content = genFile(rel, data.types, data.enums, data.services, ctx)
		fs.writeFileSync(tsFile, content, "utf-8")
		totalMsg += data.types.length
		totalEnum += data.enums.length
		totalSvc += data.services.length
	}

	// Generate barrel index files
	const dirs = new Set()
	for (const rel of Object.keys(fileItems)) {
		const parts = path.dirname(rel).split("/")
		for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join("/"))
	}
	for (const d of dirs) {
		const dp = path.join(TS_OUT_DIR, d)
		try {
			const entries = fs.readdirSync(dp, { withFileTypes: true })
			const re = []
			for (const e of entries) {
				if (e.isFile() && e.name.endsWith(".ts") && e.name !== "index.ts")
					re.push('export * from "./' + e.name.replace(/\.ts$/, "") + '"')
			}
			for (const e of entries) {
				if (e.isDirectory()) re.push('export * from "./' + e.name + '"')
			}
			fs.writeFileSync(path.join(dp, "index.ts"), re.join("\n") + "\n", "utf-8")
		} catch {}
	}

	// Generate well-known types stubs in google/protobuf
	const gd = path.join(TS_OUT_DIR, "google", "protobuf")
	fs.mkdirSync(gd, { recursive: true })
	fs.writeFileSync(
		path.join(gd, "index.ts"),
		`// Well-known protobuf types stubs

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

export interface Timestamp { seconds: number; nanos: number }
export const Timestamp = {
\tcreate(base?: DeepPartial<Timestamp>): Timestamp { return { seconds: 0, nanos: 0, ...base } as Timestamp },
\ttoJSON(m: Timestamp): unknown { return m },
\tfromJSON(o: any): Timestamp { return o ?? {seconds:0,nanos:0} },
\tencode(m: any, w: any = {bytes:[]}): any { return w },
\tdecode(i: any): Timestamp { return {seconds:0,nanos:0} },
\tfromPartial(o: any): Timestamp { return o ?? {seconds:0,nanos:0} },
}

export interface FieldMask { paths: string[] }
export const FieldMask = {
\tcreate(base?: DeepPartial<FieldMask>): FieldMask { return { paths: [], ...base } as FieldMask },
\ttoJSON(m: FieldMask): unknown { return m },
\tfromJSON(o: any): FieldMask { return o ?? {paths:[]} },
\tencode(m: any, w: any = {bytes:[]}): any { return w },
\tdecode(i: any): FieldMask { return {paths:[]} },
\tfromPartial(o: any): FieldMask { return o ?? {paths:[]} },
}

export interface Duration { seconds: number; nanos: number }
export const Duration = {
\tcreate(base?: DeepPartial<Duration>): Duration { return { seconds: 0, nanos: 0, ...base } as Duration },
\ttoJSON(m: Duration): unknown { return m },
\tfromJSON(o: any): Duration { return o ?? {seconds:0,nanos:0} },
\tencode(m: any, w: any = {bytes:[]}): any { return w },
\tdecode(i: any): Duration { return {seconds:0,nanos:0} },
\tfromPartial(o: any): Duration { return o ?? {seconds:0,nanos:0} },
}
`,
		"utf-8",
	)

	// Generate root-level barrel files: index.cline.ts, index.host.ts, etc.
	// These re-export everything from their corresponding subdirectory
	const packages = new Set()
	for (const rel of Object.keys(fileItems)) {
		const pkg = path.dirname(rel).split("/")[0]
		if (pkg !== ".") packages.add(pkg)
	}
	for (const pkg of packages) {
		const barrelContent = 'export * from "./' + pkg + '/index"\n'
		fs.writeFileSync(path.join(TS_OUT_DIR, "index." + pkg + ".ts"), barrelContent, "utf-8")
	}

	// Create re-export files for individual well-known types
	const tsFile = path.join(gd, "timestamp.ts")
	fs.writeFileSync(tsFile, 'export { Timestamp } from "./index"\nexport type { DeepPartial } from "./index"\n', "utf-8")
	const fmFile = path.join(gd, "field_mask.ts")
	fs.writeFileSync(fmFile, 'export { FieldMask } from "./index"\nexport type { DeepPartial } from "./index"\n', "utf-8")
	const durFile = path.join(gd, "duration.ts")
	fs.writeFileSync(durFile, 'export { Duration } from "./index"\nexport type { DeepPartial } from "./index"\n', "utf-8")

	// Create root index.ts that re-exports everything
	const rootExports = []
	for (const pkg of packages) {
		rootExports.push("export * as " + pkg + ' from "./' + pkg + '/index"')
	}
	fs.writeFileSync(path.join(TS_OUT_DIR, "index.ts"), rootExports.join("\n") + "\n", "utf-8")

	console.log("Generated " + totalMsg + " messages, " + totalEnum + " enums, " + totalSvc + " services in " + TS_OUT_DIR)
}
main().catch((e) => {
	console.error(e)
	process.exit(1)
})

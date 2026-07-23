#!/usr/bin/env node

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import * as path from "path"

const PROTO_DIR = path.resolve("proto")

const typeNameToFQN = new Map()

function addTypeNameToFqn(name, fqn) {
	if (typeNameToFQN.has(name) && typeNameToFQN.get(name) !== fqn) {
		throw new Error(`Proto type ${name} redefined (${fqn}).`)
	}
	typeNameToFQN.set(name, fqn)
}
// Get the fully qualified name for a proto type, e.g. getFqn('StringRequest') returns 'cline.StringRequest'
export function getFqn(name) {
	if (!typeNameToFQN.has(name)) {
		throw Error(`No FQN for ${name}`)
	}
	return typeNameToFQN.get(name)
}

export async function getPackageDefinition() {
	// Load only entry-point files that transitively import everything else
	// to avoid duplicate type definitions. @grpc/proto-loader resolves imports.
	const entryFiles = [
		path.join(PROTO_DIR, "cline", "state.proto"), // imports common, browser, models
		path.join(PROTO_DIR, "cline", "account.proto"),
		path.join(PROTO_DIR, "cline", "checkpoints.proto"),
		path.join(PROTO_DIR, "cline", "commands.proto"),
		path.join(PROTO_DIR, "cline", "file.proto"),
		path.join(PROTO_DIR, "cline", "hooks.proto"),
		path.join(PROTO_DIR, "cline", "mcp.proto"),
		path.join(PROTO_DIR, "cline", "oca_account.proto"),
		path.join(PROTO_DIR, "cline", "slash.proto"),
		path.join(PROTO_DIR, "cline", "task.proto"),
		path.join(PROTO_DIR, "cline", "ui.proto"),
		path.join(PROTO_DIR, "cline", "web.proto"),
		path.join(PROTO_DIR, "cline", "worktree.proto"),
		path.join(PROTO_DIR, "host", "diff.proto"),
		path.join(PROTO_DIR, "host", "env.proto"),
		path.join(PROTO_DIR, "host", "testing.proto"),
		path.join(PROTO_DIR, "host", "window.proto"),
		path.join(PROTO_DIR, "host", "workspace.proto"),
	]
	const options = { longs: Number, keepCase: true, includeDirs: [PROTO_DIR] }
	return protoLoader.load(entryFiles, options)
}

export async function loadProtoDescriptorSet() {
	const packageDefinition = await getPackageDefinition()
	return grpc.loadPackageDefinition(packageDefinition)
}

export async function loadServicesFromProtoDescriptor() {
	// Load service definitions directly from .proto files via @grpc/proto-loader
	const proto = await loadProtoDescriptorSet()

	// Extract host services and proto messages from the proto definition
	const hostServices = {}
	for (const [name, def] of Object.entries(proto.host)) {
		if (def && "service" in def) {
			hostServices[name] = def
		} else {
			addTypeNameToFqn(name, `proto.host.${name}`)
		}
	}
	const protobusServices = {}
	for (const [name, def] of Object.entries(proto.cline)) {
		if (def && "service" in def) {
			protobusServices[name] = def
		} else {
			addTypeNameToFqn(name, `proto.cline.${name}`)
		}
	}
	return { protobusServices, hostServices }
}

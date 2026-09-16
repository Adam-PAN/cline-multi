import { ApiConfiguration } from "@shared/api"
import { UpdateApiConfigurationRequest } from "@shared/proto/cline/models"
import { convertApiConfigurationToProto } from "@shared/proto-conversions/models/api-configuration-conversion"
import { Mode } from "@shared/storage/types"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient } from "@/services/grpc-client"

/**
 * Serializes configuration saves so rapid successive updates can't race each other.
 * Without this, an older save can resolve after a newer one and overwrite the newer
 * value on the backend, which then echoes the stale value back into the webview
 * (visible as scrambled/garbled text in input fields).
 */
let configSaveQueue: Promise<unknown> = Promise.resolve()

function enqueueConfigSave(save: () => Promise<unknown>): Promise<unknown> {
	const next = configSaveQueue.then(save, save)
	// Keep the chain alive even if a save rejects
	configSaveQueue = next.catch(() => {})
	return next
}

export const useApiConfigurationHandlers = () => {
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()

	/**
	 * Updates a single field in the API configuration.
	 *
	 * Calls are serialized through a queue so rapid successive updates are applied
	 * to the backend in the order they were made. Each save always builds on the
	 * latest config state available at call time.
	 *
	 * @param field - The field key to update
	 * @param value - The new value for the field
	 */
	const handleFieldChange = async <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => {
		await enqueueConfigSave(async () => {
			const updatedConfig = {
				...apiConfiguration,
				[field]: value,
			}

			const protoConfig = convertApiConfigurationToProto(updatedConfig)
			await ModelsServiceClient.updateApiConfigurationProto(
				UpdateApiConfigurationRequest.create({
					apiConfiguration: protoConfig,
				}),
			)
		})
	}

	/**
	 * Updates multiple fields in the API configuration at once.
	 *
	 * This function should be used when updating multiple fields to avoid race conditions
	 * that can occur when calling `handleFieldChange` multiple times in succession.
	 * All updates are applied together as a single operation.
	 *
	 * @param updates - An object containing the fields to update and their new values
	 */
	const handleFieldsChange = async (updates: Partial<ApiConfiguration>) => {
		await enqueueConfigSave(async () => {
			const updatedConfig = {
				...apiConfiguration,
				...updates,
			}

			const protoConfig = convertApiConfigurationToProto(updatedConfig)
			await ModelsServiceClient.updateApiConfigurationProto(
				UpdateApiConfigurationRequest.create({
					apiConfiguration: protoConfig,
				}),
			)
		})
	}

	const handleModeFieldChange = async <PlanK extends keyof ApiConfiguration, ActK extends keyof ApiConfiguration>(
		fieldPair: { plan: PlanK; act: ActK },
		value: ApiConfiguration[PlanK] & ApiConfiguration[ActK], // Intersection ensures value is compatible with both field types
		currentMode: Mode,
	) => {
		if (planActSeparateModelsSetting) {
			const targetField = fieldPair[currentMode]
			await handleFieldChange(targetField, value)
		} else {
			await handleFieldsChange({
				[fieldPair.plan]: value,
				[fieldPair.act]: value,
			})
		}
	}

	/**
	 * Updates multiple mode-specific fields in a single atomic operation.
	 *
	 * This prevents race conditions that can occur when making multiple separate
	 * handleModeFieldChange calls in rapid succession.
	 *
	 * @param fieldPairs - Object mapping keys to plan/act field pairs
	 * @param values - Object with values for each key
	 * @param currentMode - The current mode being targeted
	 */
	const handleModeFieldsChange = async <T extends Record<string, any>>(
		fieldPairs: { [K in keyof T]: { plan: keyof ApiConfiguration; act: keyof ApiConfiguration } },
		values: T,
		currentMode: Mode,
	) => {
		if (planActSeparateModelsSetting) {
			// Update only the current mode's fields
			const updates: Partial<ApiConfiguration> = {}
			Object.entries(fieldPairs).forEach(([key, { plan, act }]) => {
				const targetField = currentMode === "plan" ? plan : act
				updates[targetField] = values[key]
			})
			await handleFieldsChange(updates)
		} else {
			// Update both modes' fields
			const updates: Partial<ApiConfiguration> = {}
			Object.entries(fieldPairs).forEach(([key, { plan, act }]) => {
				updates[plan] = values[key]
				updates[act] = values[key]
			})
			await handleFieldsChange(updates)
		}
	}

	return { handleFieldChange, handleFieldsChange, handleModeFieldChange, handleModeFieldsChange }
}

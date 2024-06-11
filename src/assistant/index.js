import * as bidaraAsst from './bidara'
import { funcCalling as bidaraFuncCalling } from './bidaraFunctions'

const bidara = {
	name: bidaraAsst.NAME,
	config: bidaraAsst.CONFIG,
	history: bidaraAsst.HISTORY,
	funcCalling: bidaraFuncCalling,
	version: bidaraAsst.VERSION,

	tagline: bidaraAsst.TAGLINE,
	description: bidaraAsst.TEXT_DESCRIPTION,
	logo: bidaraAsst.LOGO,
	model: bidaraAsst.MODEL,
	builtInFunctions: bidaraAsst.FUNCTIONS.filter((func) => func.type !== "function"),
	customFunctions: bidaraAsst.FUNCTIONS.filter((func) => func.type === "function"),
}

export const ASSISTANT_OPTIONS = [
	bidara,
]

const testAssistant = ASSISTANT_OPTIONS.find((asst) => asst.name.includes("TEST"));

export const DEFAULT_ASSISTANT = testAssistant ? testAssistant : ASSISTANT_OPTIONS[0];

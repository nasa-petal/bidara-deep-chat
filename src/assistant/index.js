import * as bidaraAsst from './bidara'
import * as reqManagerAsst from './reqManager'
import { funcCalling as bidaraFuncCalling } from './bidaraFunctions'
import { funcCalling as reqManagerFuncCalling } from './reqManagerFunctions'

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

const reqManager = {
	name: reqManagerAsst.NAME,
	config: reqManagerAsst.CONFIG,
	history: reqManagerAsst.HISTORY,
	funcCalling: reqManagerFuncCalling,
	version: reqManagerAsst.VERSION,

	tagline: reqManagerAsst.TAGLINE,
	description: reqManagerAsst.TEXT_DESCRIPTION,
	logo: reqManagerAsst.LOGO,
	model: reqManagerAsst.MODEL,
	builtInFunctions: reqManagerAsst.FUNCTIONS.filter((func) => func.type !== "function"),
	customFunctions: reqManagerAsst.FUNCTIONS.filter((func) => func.type === "function"),
}

export const ASSISTANT_OPTIONS = [
	bidara,
	reqManager
]

const testAssistant = ASSISTANT_OPTIONS.find((asst) => asst.name.includes("TEST"));

export const DEFAULT_ASSISTANT = testAssistant ? testAssistant : ASSISTANT_OPTIONS[0];

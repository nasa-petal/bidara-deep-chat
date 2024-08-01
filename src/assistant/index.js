import * as bidaraAsst from './bidara'
import * as genAsst from './general'
import { funcCalling as bidaraFuncCalling } from './bidaraFunctions'
import { funcCalling as genFuncCalling } from './generalFunctions'

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

const general = {
	name: genAsst.NAME,
	config: genAsst.CONFIG,
	history: genAsst.HISTORY,
	funcCalling: genFuncCalling,
	version: genAsst.VERSION,

	tagline: genAsst.TAGLINE,
	description: genAsst.TEXT_DESCRIPTION,
	logo: genAsst.LOGO,
	model: genAsst.MODEL,
	builtInFunctions: genAsst.FUNCTIONS.filter((func) => func.type !== "function"),
	customFunctions: genAsst.FUNCTIONS.filter((func) => func.type === "function"),
}
export const ASSISTANT_OPTIONS = [
	bidara,
	general
]

const testAssistant = ASSISTANT_OPTIONS.find((asst) => asst.name.includes("TEST"));

export const DEFAULT_ASSISTANT = testAssistant ? testAssistant : ASSISTANT_OPTIONS[0];

import * as bidaraAsst from './bidara'
import { funcCalling as bidaraFuncCalling } from './bidaraFunctions'

import * as knowahAsst from './knowah'

const BIDARA = {
	name: bidaraAsst.NAME,
	config: bidaraAsst.CONFIG,
	initialMessages: bidaraAsst.INITIAL_MESSAGES,
	funcCalling: bidaraFuncCalling,
	version: bidaraAsst.VERSION,

	tagline: bidaraAsst.TAGLINE,
	description: bidaraAsst.TEXT_DESCRIPTION,
	logo: bidaraAsst.LOGO,
	model: bidaraAsst.MODEL,
	builtInFunctions: bidaraAsst.FUNCTIONS.filter((func) => func.type !== "function"),
	customFunctions: bidaraAsst.FUNCTIONS.filter((func) => func.type === "function"),
}

const KNOWAH = {
	name: knowahAsst.NAME,
	config: knowahAsst.CONFIG,
	initialMessages:  knowahAsst.INITIAL_MESSAGES,
	funcCalling: null,
	version: knowahAsst.VERSION,

	tagline: knowahAsst.TAGLINE,
	description: knowahAsst.TEXT_DESCRIPTION,
	logo: knowahAsst.LOGO,
	model: knowahAsst.MODEL,
	builtInFunctions: knowahAsst.FUNCTIONS.filter((func) => func.type !== "function"),
	customFunctions: knowahAsst.FUNCTIONS.filter((func) => func.type === "function"),
}

export { BIDARA, KNOWAH }

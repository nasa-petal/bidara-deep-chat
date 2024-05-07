import * as bidaraAsst from './bidara'
import { funcCalling as bidaraFuncCalling } from './bidaraFunctions'

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

export { BIDARA }

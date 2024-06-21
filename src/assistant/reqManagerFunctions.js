import { suggestFixesToReqs } from "./commonFunctions";

export async function callFunc(functionDetails, context) {
  let tmp = '';
  if (functionDetails.name == "suggest_fixes_to_requirements") {
    tmp = await suggestFixesToReqs(functionDetails.arguments, context);
  }
  return tmp;
}

export async function funcCalling(functionsDetails, context) {
  let tmp = await Promise.all(functionsDetails.map((details) => callFunc(details, context)));
  return tmp;
}

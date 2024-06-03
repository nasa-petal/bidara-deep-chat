import { ssSearch, genImage, imageToText, getFileType, getImagePatterns } from "./commonFunctions";

export async function callFunc(functionDetails, context) {
  let tmp = '';
  if(functionDetails.name == "get_graph_paper_relevance_search") {
    tmp = await ssSearch(functionDetails.arguments);
  }
  else if(functionDetails.name == "text_to_image") {
    if (context?.processImageCallback && context?.lastMessageId) {
      tmp = await genImage(functionDetails.arguments, context);

    } else {
      tmp = "There was an error in retrieving `text_to_image`."

    }
  }
  else if (functionDetails.name == "get_file_type") {
    tmp = await getFileType(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "image_to_text") {
    tmp = await imageToText(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "get_patterns_in_image") {
    tmp = await getImagePatterns(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "patent_search") {
    tmp = await patentSearch(functionDetails.arguments, context);
  }
  return tmp;
}

export async function funcCalling(functionsDetails, context) {
  let tmp = await Promise.all(functionsDetails.map((details) => callFunc(details, context)));
  return tmp;
}

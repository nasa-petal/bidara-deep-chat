import { genImage, imageToText, getFileType, getImagePatterns, paperSearch, patentSearch, webSearch } from "./commonFunctions";

export async function bioSsSearch(params, context) {

  const updatedParams = JSON.parse(params);

  if (updatedParams.fieldsOfStudy) {
    updatedParams.fieldsOfStudy += "Chemistry,Biology,Materials Science,Physics,Engineering,Environmental Science";
  } else {
    updatedParams.fieldsOfStudy = "Chemistry,Biology,Materials Science,Physics,Engineering,Environmental Science";
  }
  const stringUpdateParams = JSON.stringify(updatedParams);

  const papers = await paperSearch(stringUpdateParams, context);

  const resMsg = `Verify the following results to be relevant to the question asked.
    If the results do not match these criteria, or if better results could be achieved through updated terms,
    an additional search should be performed with updated terms.

    <results> 
    ${papers}
    </results>

    The results MUST be related to the question. Otherwise, you MUST search again without asking for confirmation.
    `
  return resMsg;
}

export async function callFunc(functionDetails, context) {
  let tmp = '';
  if (functionDetails.name == "text_to_image") {
    if (context?.processImageCallback && context?.lastMessageId) {
      tmp = await genImage(functionDetails.arguments, context);
    } else {
      tmp = "There was an error in retrieving `text_to_image`."
    }
  }
  else if (functionDetails.name == "image_to_text") {
    tmp = await imageToText(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "get_file_type") {
    tmp = await getFileType(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "get_patterns_in_image") {
    tmp = await getImagePatterns(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "get_graph_paper_relevance_search") {
    tmp = await bioSsSearch(functionDetails.arguments);
  }
  else if (functionDetails.name == "patent_search") {
    tmp = await patentSearch(functionDetails.arguments, context);
  }
  else if (functionDetails.name == "general_web_search_retrieval") {
    tmp = await webSearch(functionDetails.arguments, context);
  }
  return tmp;
}

export async function funcCalling(functionsDetails, context) {
  let tmp = await Promise.all(functionsDetails.map((details) => callFunc(details, context)));
  return tmp;
}

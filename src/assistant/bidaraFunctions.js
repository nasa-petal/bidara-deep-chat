import { ssSearch, genImage, imageToText, getFileType, getImagePatterns } from "./commonFunctions";

export async function bioSsSearch(params, context) {

  const updatedParams = JSON.parse(params);

  if (updatedParams.fieldsOfStudy) {
    updatedParams.fieldsOfStudy += ",Biology";
  } else {
    updatedParams.fieldsOfStudy = "Biology";
  }
  const stringUpdateParams = JSON.stringify(updatedParams);

  const papers = await ssSearch(stringUpdateParams, context);

  const resMsg = `Verify the following results to be relevant to the question asked, and related to Biology.
    If the results do not match these criteria, or if better results could be achieved through updated terms,
    an additional search should be performed with updated terms.

    <results> 
    ${papers}
    </results>

    The results MUST be related to the question AND Biological in nature. Otherwise, you MUST search again without asking for confirmation.
    `

  return resMsg;
}
export async function callFunc(functionDetails, context) {
  let tmp = '';
  if(functionDetails.name == "get_graph_paper_relevance_search") {
    tmp = await bioSsSearch(functionDetails.arguments);
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
  return tmp;
}

export async function funcCalling(functionsDetails, context) {
  let tmp = await Promise.all(functionsDetails.map((details) => callFunc(details, context)));
  return tmp;
}

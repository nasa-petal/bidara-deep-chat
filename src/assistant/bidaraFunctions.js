import { getDalleImageGeneration, getImageToText } from "../utils/openaiUtils";

export async function ssSearch(params) {
  //call api and return results
  let searchParams = JSON.parse(params);
  if ("parameters" in searchParams) {
    searchParams = searchParams.parameters;
  }
  let fields = [];
  if (typeof searchParams.fields === 'string' || searchParams.fields instanceof String) {
    fields = searchParams.fields.split(",");
  }
  fields.push("url","title","year","abstract","authors","venue","openAccessPdf"); // minimum set of fields we want, just in case OpenAI doesn't request them. Which happens alot.
  fields = [...new Set(fields)]; //remove duplicates
  searchParams.fields = fields.join();
  searchParams = new URLSearchParams(searchParams);

  try {
    const response = await fetch("https://api.semanticscholar.org/graph/v1/paper/search?" + searchParams);

    if (response.status === 429 || response.code === 429 || response.statusCode === 429) {
      return "Semantic Scholar is currently having issues with their servers. So, for now, searching for academic papers will not work."
    }
    const papers = await response.json();
    return JSON.stringify(papers);
  } catch (e) {
    console.error('error: ' + e);
    return "Semantic Scholar is currently having issues with their servers. So, for now, searching for academic papers will not work."
  }
}

async function genImage(params, threadId, addMessageCallback) {
  let imageParams = JSON.parse(params);

  if ("parameters" in imageParams) {
    imageParams = imageParams.parameters;
  }

  let imagePrompt = JSON.stringify(imageParams.prompt) + " Realistic depiction of the object and its environment. Stay true to science, engineering, and biology. DO NOT INCLUDE ANY WORDS OR BRANDING."

  const res = await getDalleImageGeneration(imagePrompt);

  if (!res) {
    return "We are having trouble generating images at this time.";
  }

  const imageData = res.data[0].b64_json;
  const imageSrc = "data:image/png;base64," + imageData;

  const message = {role: "ai", files: [ { ref: {}, src: imageSrc, type: "image" } ], _sessionId: threadId};

  await addMessageCallback(message);

  return "The image has been inserted into the chat. Respond with a very short question bring this back into this process. DO NOT REPLY WITH AN IMAGE, MARKDOWN, OR ANYTHING OTHER THAN A SHORT QUESTION.";
}

async function imageToText(params) {
  let imageParams = JSON.parse(params);

  if ("parameters" in imageParams) {
    imageParams = imageParams.parameters;
  }

  let prompt = imageParams.prompt

  let text = await getImageToText(prompt);

  return text;
}

export async function callFunc(functionDetails, context) {
  let tmp = '';
  if(functionDetails.name == "get_graph_paper_relevance_search") {
    tmp = await ssSearch(functionDetails.arguments);
  }
  else if(functionDetails.name == "text_to_image") {
    if (context?.addMessageCallback && context?.lastMessageId) {
      tmp = await genImage(functionDetails.arguments, context.lastMessageId, context.addMessageCallback);

    } else {
      tmp = "There was an error in retrieving `text_to_image`."

    }
  }
  else if (functionDetails.name == "image_to_text") {
    tmp = await imageToText(functionDetails.arguments);
  }
  return tmp;
}

export async function funcCalling(functionsDetails, context) {
  let tmp = await Promise.all(functionsDetails.map((details) => callFunc(details, context)));
  return tmp;
}

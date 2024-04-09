import { getDalleImageGeneration, getImageToText } from "../utils/openaiUtils";
import { getThreadFiles } from "../utils/threadUtils";

const fileTypes = {
  "csv": "csv",
  "xlsx": "excel",
  "pdf": "pdf",
  "txt": "txt",
  "png": "image",
  "jpg": "image",
  "jpeg": "image",
}

export function getCurrentWeather(location) {
  location = location.toLowerCase();
  if (location.includes('tokyo')) {
    return 'Good';
  } else if (location.includes('san francisco')) {
    return 'Mild';
  } else {
    return 'Very Hot';
  }
}

export function getCurrentTime(location) {
  location = location.toLowerCase();
  if (location.includes('tokyo')) {
    return '10p';
  } else if (location.includes('san francisco')) {
    return '6p';
  } else {
    return '12p';
  }
}

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

async function imageToText(params, threadId) {
  let imageParams = JSON.parse(params);

  if ("parameters" in imageParams) {
    imageParams = imageParams.parameters;
  }

  let prompt = imageParams.prompt

  let text = await getImageToText(prompt, threadId);

  return text;
}

function getFileTypeByName(fileName) {
  if (!fileName) {
    return "";
  }

  const extensionMatches = /^.*\.(csv|xlsx|pdf|txt|png|jpg|jpeg)$/gm.exec(fileName);

  // first is whole match, second is capture group. Only one capture group can appear.
  if (!extensionMatches || extensionMatches.length !== 2) {
    return "none";
  }

  const extension = extensionMatches[1];

  const type = fileTypes[extension];

  if (!type) {
    return "none";
  }

  return type;
}

async function getFileType(params) {
  let fileTypeParams = JSON.parse(params);

  if ("parameters" in fileTypeParams) {
    fileTypeParams = fileTypeParams.parameters;
  }

  let files = await getThreadFiles();

  if (files.length < 1) {
    return "No files have been uploaded.";
  }

  let recentFile = files[files.length - 1];

  if (recentFile.type === "image") {
    return "The file is an image. Analyze the image before responding to determine its contents."
  }

  if (recentFile.name !== null) {
    const type = getFileTypeByName(recentFile.name);
    return type;
  }

  return "Unable to determine filetype";
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
  else if (functionDetails.name == "get_file_type") {
    tmp = await getFileType(functionDetails.arguments);
  }
  else if (functionDetails.name == "image_to_text") {
    tmp = await imageToText(functionDetails.arguments, context.lastMessageId);
  }
  return tmp;
}

export async function funcCalling(functionsDetails, context) {
  let tmp = await Promise.all(functionsDetails.map((details) => callFunc(details, context)));
  return tmp;
}

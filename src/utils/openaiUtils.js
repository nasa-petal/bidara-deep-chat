import { getStoredAPIKey, setStoredAPIKey } from "./storageUtils";
import { getActiveThread, getFileByFileId } from "./threadUtils";
import { ASSISTANT_OPTIONS } from "../assistant";
import { ENV } from "process.env";

// todo: test all functions with fetch calls to make sure they still work after the header refactor. (test with public openai, not azure.)
/*
createAssistant
updateAssistant
getFileContent
getFileInfo
uploadFile - works
getChatCompletion - works
getAssistantId - works
getNewThreadId - works
getThreadMessages - works
cancelThreadRun - works
validThread - works
validAssistant - works
validAPIKey -works
getDalleImageGeneration - works
*/

let openaiKey = null;
let apiEndpoint = 'https://api.openai.com/v1';
let apiVersion = '';
let apiVersionMultipleParams = '';

let azureOpenAI = false;

function getAPIHeaders(type = 'default') {
  let retHeader = '';

  if (azureOpenAI) {
    if (type == 'default' || type == 'wooaib') {
      retHeader = {
        'api-key': openaiKey,
        'Content-Type': 'application/json'
      };
    }
    else if (type == 'woct') {
      retHeader = {
        'api-key': openaiKey
      };
    }
  }
  else {
    // OpenAI Headers
    if (type == 'default') {
      retHeader = {
        'Authorization': 'Bearer ' + openaiKey,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      };
    }
    else if (type == 'woct') {
      retHeader = {
        'Authorization': 'Bearer ' + openaiKey,
        'OpenAI-Beta': 'assistants=v2'
      };
    }
    else if (type == 'wooaib') {
      retHeader = {
        'Authorization': 'Bearer ' + openaiKey,
        'Content-Type': 'application/json'
      };
    }
  }
  return retHeader;
}

function getAssistantConfigFromName(asstName) {
  const asst = ASSISTANT_OPTIONS.find((opt) => opt.name === asstName);

  if (!asst) {
    return null;
  }

  return asst.config;
}

export async function validAssistant(id, asstName) {
  if (!id) {
    return false;
  }

  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate assistant.');
  }
  const response = await fetch(apiEndpoint + "/assistants/" + id + apiVersion, {
    method: "GET",
    headers: getAPIHeaders(),
    body: null
  });

  const r = await response.json();

  if (r.hasOwnProperty('error') && r.error.type === 'invalid_request_error') {
    return false;
  }

  if (r.hasOwnProperty('name') && r.name == asstName) {
    return true;
  }
  return false;
}

export async function updateAssistant(id, config) {
  // returns id on successful update, null otherwise.
  if (!openaiKey) {
    throw new Error('openai key not set. cannot update assistant.');
  }
  const response = await fetch(apiEndpoint + "/assistants/" + id + apiVersion, {
    method: "POST",
    headers: getAPIHeaders(),
    body: JSON.stringify(config)
  });

  const r = await response.json();
  if (r.hasOwnProperty('id')) {
    return r.id;
  }
  return null;
}

export async function createAssistant(config) {
  // returns id on successful update, null otherwise.
  if (!openaiKey) {
    throw new Error('openai key not set. cannot update assistant.');
  }
  const response = await fetch(apiEndpoint + "/assistants" + apiVersion, {
    method: "POST",
    headers: getAPIHeaders(),
    body: JSON.stringify(config)
  });

  const r = await response.json();
  if (r.hasOwnProperty('id')) {
    return r.id;
  }
  return null;
}

export async function getAssistantId(asstName, asstVersion, asstConfig) {
  if (!openaiKey) {
    throw new Error('openai key not set. cannot search for bidara assistant.');
  }
  // get assistants
  const response = await fetch(apiEndpoint + "/assistants?limit=50" + apiVersionMultipleParams, {
    method: "GET",
    headers: getAPIHeaders(),
    body: null
  });

  const r = await response.json();

  if (r.hasOwnProperty('data')) {
    // find assistant with name == BIDARAvX.X
    
    const asstRegexp = new RegExp(`^${asstName}v[0-9]+\.[0-9]+$`)
    let foundAsst = r.data.find(item => asstRegexp.test(item.name));
    if(foundAsst && foundAsst.hasOwnProperty('id')) {
      // get version of assistant.
      const version = /^.*v([0-9]+\.[0-9]+)$/.exec(foundAsst.name)[1];
      // if assistant version is up to date, use it.
      if (version == asstVersion) {
        return foundAsst.id;
      }
      else {
        // otherwise update it.
        foundAsst.id = await updateAssistant(foundAsst.id, asstConfig);
        return foundAsst.id;
      }
    } else {
      const newId = await createAssistant(asstConfig);
      return newId;
    }
  }
  return null;
}

export async function validApiKey(key) {
  openaiKey = key;
  const response = await fetch(apiEndpoint + "/models", {
    method: "GET",
    headers: getAPIHeaders(),
    body: null
  });

  const r = await response.json();
  if (r.hasOwnProperty('error') && r.error.code === 'invalid_api_key') {
    return false;
  }
  return true;
}

export async function getOpenAIKey() {

  // if openAIKey has already been validated, return it.
  if (openaiKey) {
    return openaiKey;
  }

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  let localOpenAiKey = urlParams.get('key');

  if (localOpenAiKey === null) {
    localOpenAiKey = getStoredAPIKey();
  }
  if (localOpenAiKey !== null) {
    // validate key. if invalid set openai_key to null
    let isValidApiKey = await validApiKey(localOpenAiKey);
    if (!isValidApiKey) {
      openaiKey = null;
    }
    else {
      openaiKey = localOpenAiKey;
    }
  }
  else {
    openaiKey = null;
  }
  return openaiKey;
}

export function setOpenAIKey(key) {
  // key must have already been validated
  openaiKey = key;
  setStoredAPIKey(openaiKey);
}

export async function getNewAsst(asst, defaultAsst) {
  let asstConfig;
  let name;
  let version;


  if (asst) {
    name = asst.name;
    asstConfig = getAssistantConfigFromName(name);
  }

  if (asstConfig) {
    version = /^.*v([0-9]+\.[0-9]+)$/.exec(asstConfig.name)[1];

  } else {
    asstConfig = defaultAsst.config;
    name = defaultAsst.name;
    version = defaultAsst.version;
  }

  const asstId = await getAssistantId(name, version, asstConfig);

  const newAsst = {
    name: name,
    version: version,
    id: asstId
  }

  return newAsst
}

export async function validThread(thread_id) {
  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  if (!thread_id) {
    return false;
  }

  try {
    const response = await fetch(apiEndpoint + `/threads/${thread_id}` + apiVersion, {
      method: "GET",
      headers: getAPIHeaders(),
      body: null
    });

    if (response.status === 404) {
      console.error("Thread not found.");
      return false;
    }

    const r = await response.json();
    if (r.hasOwnProperty('error')) {
      if (r.error.type === 'invalid_request_error') {
        return false;
      }
    }

    if (r.hasOwnProperty('id')) {
      return true;
    }
    return false;
  } catch (e) {
    console.error("ERROR: " + e);
    return false;
  }
}

export async function getNewThreadId() {
  if (!openaiKey) {
    throw new Error('openai key not set. cannot get new thread.');
  }

  const metadata = {
    "env": ENV,
    "api-key": openaiKey
  }

  const body = {
    metadata
  }
  const response = await fetch(apiEndpoint + "/threads" + apiVersion, {
    method: "POST",
    headers: getAPIHeaders(),
    body: JSON.stringify(body)
  });

  const r = await response.json();
  if (r.hasOwnProperty('error') && r.error.type === 'invalid_request_error') {
    return null;
  }

  if (r.hasOwnProperty('id')) {
    return r.id;
  }
  return null;
}


export async function getKeyAndThread(defaultAsst) {
  let key = await getOpenAIKey();
  if (key === null) {
    return [null, null]
  }

  let thread = await getActiveThread(defaultAsst);

  return [key, thread]
}

export async function getDalleImageGeneration(prompt, image_size = null, image_quality = null, num_images = null, response_format = null) {
  if (!image_size) image_size = "1024x1024";
  if (!image_quality) image_quality = "standard";
  if (!num_images) num_images = 1;
  if (!response_format) response_format = "b64_json";

  try {
    if (!openaiKey) {
      return null;
    }

    const requestURL = apiEndpoint + "/images/generations";
    //todo: update headers for Azure.
    const request = {
      method: "POST",
      headers: {
        'Authorization': 'Bearer ' + openaiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: num_images,
        size: image_size,
        quality: image_quality,
        response_format: response_format
      })
    }

    const response = await fetch(requestURL, request);

    const r = await response.json();
    if (r.error && r.error.type === 'invalid_request_error') {
      return null;
    }

    return r;

  } catch (e) {

    return null;
  }
}

export async function cancelThreadRun(threadId, runId) {
  const url = apiEndpoint + `/threads/${threadId}/runs/${runId}/cancel` + apiVersion;

  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  if (!threadId) {
    return [];
  }

  const method = 'POST';
  const headers = getAPIHeaders('woct');

  const request = {
    method,
    headers
  }

  const response = await fetch(url, request);

  const r = await response.json();
  if (r.error && r.error.type === 'invalid_request_error') {
    console.error(r.error);
    return [];
  }
}

export async function getThreadMessages(threadId, limit) {
  const url = apiEndpoint + `/threads/${threadId}/messages?limit=${limit}` + apiVersionMultipleParams;

  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  if (!threadId) {
    return [];
  }

  const method = 'GET';
  const headers = getAPIHeaders();

  const request = {
    method,
    headers
  }

  const response = await fetch(url, request);

  const r = await response.json();
  if (r.error && r.error.type === 'invalid_request_error') {
    console.error(r.error);
    return [];
  }

  return r.data
}

export async function getFileContent(fileId) {
  //todo update for Azure
  const url = `${apiEndpoint}/files/${fileId}/content`;

  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  const method = 'GET';
  const headers = getAPIHeaders('wooaib');

  const request = {
    method,
    headers
  }

  const response = await fetch(url, request);

  if (!response.ok) {
    console.error("Error with response: ");
    console.error(response);
    return null;
  }

  return response.blob();
}

export async function getFileSrc(fileId) {
  const blob = await getFileContent(fileId);
  if (!blob) {
    return null;
  }

  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = (event) => {
      resolve(event.target.result);
    }
    reader.onerror = (event) => {
      reject("error reading file");
    }
  })

  return src;
}

export async function getFileInfo(fileId) {
  //todo update for Azure
  const url = `${apiEndpoint}/files/${fileId}`;

  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  const method = 'GET';
  const headers = {
    'Authorization': 'Bearer ' + openaiKey,
  };

  const request = {
    method,
    headers
  }

  const response = await fetch(url, request);

  const r = await response.json();
  if (r.error && r.error.type === 'invalid_request_error') {
    console.error(r.error);
    return null;
  }

  return r

}

export async function getChatCompletion(model, messages, tokenLimit) {
  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  const url = apiEndpoint + `/chat/completions`;
  const method = 'POST';
  const headers = getAPIHeaders('wooaib');
  const body = JSON.stringify({
    "model": model,
    "messages": messages,
    "max_tokens": tokenLimit
  })

  const request = {
    method,
    headers,
    body
  }

  const response = await fetch(url, request);

  const r = await response.json();
  if (r.error && r.error.type === 'invalid_request_error') {
    console.error(r.error);
    return null;
  }

  return r;
}
/**
 * 
 * @param {*} b64Data 
 * @param {*} fileName 
 * @param {*} type 
 * @returns 
 */
export async function uploadFile(b64Data, fileName, type) {
  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  const fileRes = await fetch(b64Data);
  const blob = await fileRes.blob();
  const file = new File([blob], fileName, {type: type});

  const form = new FormData();
  form.append('purpose', 'assistants');
  form.append('file', file);

  //todo update for Azure.

  const url = apiEndpoint + `/files`;
  const method = 'POST';
  const headers = {
    'Authorization': 'Bearer ' + openaiKey,
  };
  const body = form;

  const request = {
    method,
    headers,
    body
  }

  const response = await fetch(url, request);

  const r = await response.json();

  if (r.error && r.error.type === 'invalid_request_error') {
    console.error(r.error);
    return null;
  }

  return r;
}

export async function getImageDescription(base64, prompt) {

  if (!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  if (!prompt) {
    prompt = "Give a detailed but concise description of the image. If there are any engineering, biological, or mechanical processes present, include how they're present."
  }

  const model = "gpt-4o-2024-05-13" //todo: update for azure.
  const messages = [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": prompt
        },
        {
          "type": "image_url",
          "image_url": {
            "url": base64
          }
        }
      ]
    }
  ]

  const tokenLimit = 500;

  const res = await getChatCompletion(model, messages, tokenLimit);

  const imageDescription = res.choices[0].message.content;

  return imageDescription;
}

export async function getImageToText(prompt, fileId) {

  let imageFile = await getFileByFileId(fileId)

  if (!imageFile) {
    return "There is no file by the id: " + fileId;
  }

  if (imageFile.type !== "image") {
    return "The file is not an image";
  }

  if (!imageFile.src) {
    return "The image does not contain any source byte data.";
  }

  const description = await getImageDescription(imageFile.src, prompt);
  return description;
}

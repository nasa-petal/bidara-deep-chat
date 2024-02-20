import * as bidara from "../assistant/bidara";

import { getStoredAPIKey, getStoredAsstId, setStoredAPIKey, setStoredAsstId } from "./storageUtils";
import { getThread } from "./threadUtils";

let openaiKey = null;
let openaiAsst = null;

export async function validAssistant(id) {
  if(!openaiKey) {
    throw new Error('openai key not set. cannot validate assistant.');
  }
  const response = await fetch("https://api.openai.com/v1/assistants/"+id, {
    method: "GET",
    headers: {
      Authorization: 'Bearer ' + openaiKey,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    body: null
  });
  
  const r = await response.json();
  if (r.hasOwnProperty('error') && r.error.type === 'invalid_request_error') {
    return false;
  }

  if (r.hasOwnProperty('name') && r.name == "BIDARAv"+bidara.BIDARA_VERSION) {
    return true;
  }
  return false;
}

export async function updateAssistant(id) {
  // returns id on successful update, null otherwise.
  if(!openaiKey) {
    throw new Error('openai key not set. cannot update assistant.');
  }
  const response = await fetch("https://api.openai.com/v1/assistants/"+id, {
    method: "POST",
    headers: {
      Authorization: 'Bearer ' + openaiKey,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    body: JSON.stringify(bidara.BIDARA_CONFIG)
  });
  
  const r = await response.json();
  if (r.hasOwnProperty('id')) {
    return r.id;
  }
  return null;
}

export async function getBidaraAssistant() {
  if(!openaiKey) {
    throw new Error('openai key not set. cannot search for bidara assistant.');
  }
  // get assistants
  const response = await fetch("https://api.openai.com/v1/assistants?limit=50", {
    method: "GET",
    headers: {
      Authorization: 'Bearer ' + openaiKey,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    body: null
  });
  
  const r = await response.json();

  if (r.hasOwnProperty('data')) {
    // find assistant with name == BIDARAvX.X
    
    let bidaraAsst = r.data.find(item => /^BIDARAv[0-9]+\.[0-9]+$/.test(item.name));
    if(bidaraAsst && bidaraAsst.hasOwnProperty('id')) {
      // get version of assistant.
      let bidaraVersion = bidaraAsst.name.substring(7);
      // if assistant version is up to date, use it.
      if (bidaraVersion == bidara.BIDARA_VERSION) {
        return bidaraAsst.id;
      }
      else {
      // otherwise update it.
        bidaraAsst.id = await updateAssistant(bidaraAsst.id);
        return bidaraAsst.id;
      }
    }
  }
  return null;
}

export async function validApiKey(key) {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
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
    if(!isValidApiKey) {
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

export async function getAsst() {
  if(!openaiKey) {
    throw new Error('openai key not set. cannot get assistant.');
  }
  if (openaiAsst) {
    return openaiAsst;
  }

  openaiAsst = getStoredAsstId();

  let isValidAsstId = false;
  if (openaiAsst !== null) {
    isValidAsstId = await validAssistant(openaiAsst);
  }
  
  if(!isValidAsstId) {
    openaiAsst = getBidaraAssistant(); // returns asst_id or null.
  }

  return openaiAsst;
}

export function setAsst(id) {
  // assistant id must have already been validated
  if(id) {
    openaiAsst = id;
    setStoredAsstId(openaiAsst);
  }
}

export async function validThread(thread_id) {
  if(!openaiKey) {
    throw new Error('openai key not set. cannot validate thread.');
  }

  if (!thread_id) {
    return false;
  }

  try {
    const response = await fetch(`https://api.openai.com/v1/threads/${thread_id}`, {
      method: "GET",
      headers: {
        Authorization: 'Bearer ' + openaiKey,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v1'
      },
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
  const response = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      Authorization: 'Bearer ' + openaiKey,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    body: null
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


export async function getKeyAsstAndThread() {
  let key = await getOpenAIKey();
  if (key === null) {
    return [null, null, null]
  }

  let asst = await getAsst();

  let thread = await getThread();

  return [key, asst, thread]
}

export async function getDalleImageGeneration(prompt, image_size = null, image_quality = null, num_images = null) {
  if (!image_size) image_size = "1024x1024";
  if (!image_quality) image_quality = "standard";
  if (!num_images) num_images = 1;

  try {
    if (!openaiKey) {
      return null;
    }

    const requestURL = "https://api.openai.com/v1/images/generations";

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
        quality: image_quality
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

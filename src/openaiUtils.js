import * as bidara from "./bidara";

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
    localOpenAiKey = localStorage.getItem('openai-key');
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
  localStorage.setItem('openai-key', openaiKey);
}

export async function getAsst() {
  if(!openaiKey) {
    throw new Error('openai key not set. cannot get assistant.');
  }
  if (openaiAsst) {
    return openaiAsst;
  }

  openaiAsst = localStorage.getItem('openai-asst-id');

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
  openaiAsst = id;
  localStorage.setItem('openai-asst-id', openaiAsst);
}

export async function getKeyAndAsst() {
  let key = await getOpenAIKey();
  if (key === null) {
    return [null, null]
  }

  let asst = await getAsst();
  return [key, asst]
}
import * as bidara from "./bidara";

export async function validAssistant(id,key) {
  const response = await fetch("https://api.openai.com/v1/assistants/"+id, {
    method: "GET",
    headers: {
      Authorization: 'Bearer ' + key,
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

export async function updateAssistant(id,key) {
  // returns true on successful update, false otherwise.
  const response = await fetch("https://api.openai.com/v1/assistants/"+id, {
    method: "POST",
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v1'
    },
    body: JSON.stringify(bidara.BIDARA_CONFIG)
  });
  
  const r = await response.json();
  if (r.hasOwnProperty('id')) {
    return true;
  }
  return false;
}

export async function getBidaraAssistant(key) {

  // get assistants
  const response = await fetch("https://api.openai.com/v1/assistants?limit=50", {
    method: "GET",
    headers: {
      Authorization: 'Bearer ' + key,
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
        updateAssistant(bidaraAsst.id,key);
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
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  let openai_key = urlParams.get('key');

  if (openai_key === null) {
    openai_key = localStorage.getItem('openai-key');
  }
  if (openai_key !== null) {
    // validate key. if invalid set openai_key to null
    let isValidApiKey = await validApiKey(openai_key);
    if(!isValidApiKey) {
      openai_key = null;
    }
  }
  return openai_key;
}

export async function getAsst(key) {
  let openai_asst_id = localStorage.getItem('openai-asst-id');

  let isValidAsstId = false;
  if (openai_asst_id !== null) {
    isValidAsstId = await validAssistant(openai_asst_id,key);
  }
  
  if(!isValidAsstId) {
    openai_asst_id = getBidaraAssistant(key); // returns asst_id or null.
  }

  return openai_asst_id;
}

export async function getKeyAndAsst() {
  let key = await getOpenAIKey();
  if (key === null) {
    return [null, null]
  }

  let asst = await getAsst(key);
  return [key, asst]
}
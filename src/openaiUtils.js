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
  if (r.error && r.error.type === 'invalid_request_error') {
    return false;
  }
  return true;
}

export async function validApiKey(key) {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: null
  });
  
  const r = await response.json();
  if (r.error && r.error.code === 'invalid_api_key') {
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

  if (openai_asst_id !== null) {
    let isValidAsstId = await validAssistant(openai_asst_id,key);
    if(!isValidAsstId) {
      openai_asst_id = null;
    }
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
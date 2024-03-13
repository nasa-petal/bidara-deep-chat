import * as bidaraDB from './bidaraDB';

let OPENAI_KEY_KEY = 'openai-key';
let OPENAI_ASST_ID_KEY = 'openai-asst-id'

export function getStoredAPIKey() {
  return getStorage(OPENAI_KEY_KEY);
}

export function getStoredAsstId() {
  return getStorage(OPENAI_ASST_ID_KEY);
}

export function setStoredAPIKey(value) {
  return setStorage(OPENAI_KEY_KEY, value);
}

export function setStoredAsstId(value) {
  return setStorage(OPENAI_ASST_ID_KEY, value);
}

function setStorage(key, value) {
  return setLocal(key, value);
}

function setStorageJSON(key, value) {
  const value_str = JSON.stringify(value);

  return setLocal(key, value_str);
}

function getStorage(key) {
  return getLocal(key);
}

function getStorageJSON(key) {
  const value = getLocal(key);

  try {
    if (value) {
      return JSON.parse(value);
    } else {
      return null;
    }
  } catch (e) {
    console.error(`error: attempted to parse value '${value}' from key '${key}'. got error: ${e}`);

    return null;
  }
}

function setLocal(key, value) {
  if (key && value) {
    localStorage.setItem(key, value);

    return true;
  }

  return false;
}

function getLocal(key) {
  if (key) {
    return localStorage.getItem(key);
  }

  return null;
}

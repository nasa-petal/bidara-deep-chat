let OPENAI_KEY_KEY = 'openai-key';
let OPENAI_ASST_ID_KEY = 'openai-asst-id'
let OPENAI_ACTIVE_THREAD_KEY = 'openai-active-thread';
let OPENAI_THREADS_KEY = 'openai-threads';

export function getStoredAPIKey() {
  return getStorage(OPENAI_KEY_KEY);
}

export function getStoredAsstId() {
  return getStorage(OPENAI_ASST_ID_KEY);
}

export function getStoredActiveThread() {
  return getStorageJSON(OPENAI_ACTIVE_THREAD_KEY);
}

export function getStoredThreads() {
  return getStorageJSON(OPENAI_THREADS_KEY);
}

export function setStoredAPIKey(value) {
  return setStorage(OPENAI_KEY_KEY, value);
}

export function setStoredAsstId(value) {
  return setStorage(OPENAI_ASST_ID_KEY, value);
}

export function setStoredActiveThread(value) {
  return setStorageJSON(OPENAI_ACTIVE_THREAD_KEY, value);
}

export function setStoredThreads(value) {
  return setStorageJSON(OPENAI_THREADS_KEY, value);
}

export function filterStoredThreads(thread_filter) {
  const threads = getStoredThreads();
  const updated_threads = threads.filter(thread_filter);

  setStoredThreads(updated_threads);
  return updated_threads;
}

function setStorage(key, value) {
  return setLocal(key, value);
}

function setStorageJSON(key, value) {
  const value_str = JSON.stringify(value);

  return setLocal(key, value_str);
}

function setLocal(key, value) {
  if (key && value) {
    localStorage.setItem(key, value);

    return true;
  }

  return false;
}

function getStorage(key) {
  return getLocal(key);
}

function getStorageJSON(key) {
  const value = getLocal(key);

  try {
    return JSON.parse(value);
  } catch (e) {
    console.error(`error: attempted to parse value '${value}' from key '${key}'. got error: ${e}`);

    return null;
  }
}

function getLocal(key) {
  if (key) {
    return localStorage.getItem(key);
  }

  return null;
}

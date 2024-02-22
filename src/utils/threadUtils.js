import { validThread, getNewThreadId } from "./openaiUtils";
import { getStoredActiveThread, getStoredThreads, setStoredActiveThread, setStoredThreads, getFilteredThreads } from "./storageUtils";

export async function getNewThread() {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";
    return {name: new_name, id: new_id, length:0};
  }

  return null;
}

export async function getThread() {
  var thread = getStoredActiveThread();

  var isValidThreadId = false;
  if (thread !== null) {
    isValidThreadId = await validThread(thread.id);
  }

  while (!isValidThreadId) {
    thread = await getNewThread();

    if (thread !== null) {
      isValidThreadId = await validThread(thread.id);
    }
  }

  return thread;
}

export async function setThread(thread) {
  const current_thread = getStoredActiveThread();
  if (!current_thread || thread != current_thread ) {
    setStoredActiveThread(thread);
  }
}

export function getThreads() {
  var threads = getStoredThreads();

  return threads;
}

export function setThreads(threads) {
  setStoredThreads(threads);
}

export function deleteThreadFromThreads(thread_id) {
  const filteredThreads = getFilteredThreads((thread) => thread.id !== thread_id);
  setThreads(filteredThreads);
  return filteredThreads;
}

export async function setActiveThreadName(name) {
  const active_thread = await getThread();

  const threads = getThreads();

  const new_threads = threads.map(thread => {
    if (thread.id == active_thread.id) {
      thread.name = name;
    }

    return thread;
  })

  active_thread.name = name;

  setThread(active_thread);
  setThreads(new_threads);
}

export function getEmptyThreads() {
  const emptyThreads = getFilteredThreads((thread) => thread.length === 0);
  return emptyThreads;
}

export function floatThreadInThreads(floatThread) {
  const filteredWithoutThread = getFilteredThreads((thread) => thread.id !== floatThread);
  filteredWithoutThread.unshift(floatThread);
  return filteredWithoutThread;
}

export function updateThreadAndThreads(activeThread, threads) {
  const storedThread = getStoredActiveThread();
  const storedThreads = getStoredThreads();

  if (activeThread != storedThread) {
    if (threads) {
      threads = threads.map((thread) => { 
        if (thread.id === activeThread.id) {
          return activeThread;
        }
        return thread;
      });
    }

    setStoredActiveThread(activeThread);
  }


  if (threads != storedThreads) {
    setStoredThreads(threads);
  }
}

import { validThread, getNewThreadId } from "./openaiUtils";
import { getStoredActiveThread, getStoredThreads, setStoredActiveThread, setStoredThreads, filterStoredThreads } from "./storageUtils";

export async function getNewThread() {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";
    return {name: new_name, id: new_id};
  }

  return null;
}

export async function getThread() {
  const thread = getStoredActiveThread();

  let isValidThreadId = false;
  if (thread !== null) {
    isValidThreadId = await validThread(thread.id);
  }

  if (isValidThreadId) {
    return thread;
  }

  if (thread === null) {
    const new_thread = await getNewThread();

    setThreads([new_thread]);
    setThread(new_thread);

    return new_thread;
  }

  return null;
}

export async function setThread(thread) {
  const current_thread = getStoredActiveThread();
  if (!current_thread || thread != current_thread ) {
    setStoredActiveThread(thread);
  }
}

export function getThreads() {
  var threads = getStoredThreads();

  if (threads === null) {
    threads = []
    setThreads(threads);
  }

  return threads;
}

export function setThreads(threads) {
  setStoredThreads(threads);
}

export function deleteThreadFromThreads(thread_id) {
  return filterStoredThreads((thread) => thread.id !== thread_id);
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
  console.log("thread: " + JSON.stringify(active_thread));

  setThread(active_thread);
  setThreads(new_threads);

  return new_threads;
}

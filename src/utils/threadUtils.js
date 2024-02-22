import { validThread, getNewThreadId } from "./openaiUtils";
import { getStoredActiveThread, getStoredThreads, setStoredActiveThread, setStoredThreads, filterStoredThreads } from "./storageUtils";

export async function getNewThread() {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";
    return {name: new_name, id: new_id, length: 0};
  }

  return null;
}

export async function getThread() {
  var thread = getStoredActiveThread();

  console.log("initial thread: ");
  console.dir(thread);

  let isValidThreadId = false;
  if (thread !== null) {
    isValidThreadId = await validThread(thread.id);
  }

  if (thread === null || !isValidThreadId) {
    thread = await getNewThread();

    setThread(thread);
  }

  console.log("thread: ");
  console.dir(thread);

  var threads = getStoredThreads();
  console.log("threads: ");
  console.dir(threads);

  const threadInThreads = threads.filter((t) => t.id == thread.id).length > 0;

  if (threads && !threadInThreads) {
    console.log("thread not in threads");
    threads.unshift(thread);
    setThreads(threads);

  } else if (!threads){
    threads = [thread];
    setThreads(threads);
  }

  console.log(thread);
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

  setThread(active_thread);
  setThreads(new_threads);

  return new_threads;
}

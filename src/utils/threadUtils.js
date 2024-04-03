import { validThread, getNewThreadId } from "./openaiUtils";
import * as bidaraDB from "./bidaraDB";

async function createNewThread() {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";
    return {name: new_name, id: new_id, length: 0, messages: [], active: true};
  }

  return null;
}

export async function getActiveThread() {
  let thread = await bidaraDB.getActiveThread();

  let isValidThreadId = false;
  if (thread !== null) {
    isValidThreadId = await validThread(thread.id);
  }

  if (thread === null || !isValidThreadId) {
    thread = await getNewThread();
    await setActiveThread(thread.id);
  }

  return thread;
}

export async function getNewThread() {
  const thread = await createNewThread();
  await bidaraDB.setThread(thread);

  return thread;
}

export async function getRecentThread() {
  return await bidaraDB.getMostRecentlyUpdatedThread();
}

export async function getThreads() {
  const threads = await bidaraDB.getAllThreads();

  return threads;
}

export async function getEmptyThread() {
  return await bidaraDB.getEmptyThread();
}

export async function getThreadImages() {
  let files = await getThreadFiles();

  let imageFiles = files.filter(file => file.type === "image")

  let imageSources = imageFiles.map(file => { return file.src })

  return imageSources 
}

export async function getThreadFiles() {
  let thread = await bidaraDB.getActiveThread();

  let messagesWithFiles = thread.messages.filter(msg => { return msg?.files && msg.files.length > 0 })

  let files = messagesWithFiles.map(msg => { return msg.files }).flat()

  return files
}

export async function setActiveThread(threadId) {
  const currentActiveThread = await bidaraDB.getActiveThread();
  if (currentActiveThread) {
    await bidaraDB.setActiveStatusById(currentActiveThread.id, false);
  }
  await bidaraDB.setActiveStatusById(threadId, true);
}

export async function setThreadName(id, name) {
  await bidaraDB.setNameById(id, name);
}

export async function setThreadMessages(threadId, messages) {
  await bidaraDB.setMessagesById(threadId, messages);
  await bidaraDB.setLengthById(threadId, messages.length);
}

export async function updateThread(thread) {
  await bidaraDB.setThread(thread);
}

export async function deleteThread(threadId) {
  await bidaraDB.deleteThreadById(threadId);
}


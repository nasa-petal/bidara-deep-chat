import { validThread, getNewThreadId, getThreadMessages } from "./openaiUtils";
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

export async function getEmptyThread(emptyLength) {
  const smallestThread = await bidaraDB.getSmallestThread();

  if (smallestThread.length <= emptyLength) {
    return smallestThread;
  }
  return null;
}

export async function getThreadImages() {
  let thread = await bidaraDB.getActiveThread();

  let messagesWithFiles = thread.messages.filter(msg => { return msg?.files && msg.files.length > 0 })

  let files = messagesWithFiles.map(msg => { return msg.files }).flat()

  let imageFiles = files.filter(file => file.type === "image")

  let imageSources = imageFiles.map(file => { return file.src })

  return imageSources 
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

export async function pushMessageToThread(threadId, message) {
  if (!message?.role || (!message?.text && !message?.files) || !message?._sessionId) {
    throw new Error("Invalid message attempted to push to thread in db.")
  }

  await bidaraDB.pushMessageToId(threadId, message)
}

function convertThreadMessagesToMessages(threadMessages) {
  const messages = threadMessages
    .map(msg => {
      return msg.content.map(d => {
        if (msg.role === "assistant") {
          msg.role = "ai";
        }

        const isText = d.type === 'text';

        return {
          role: msg.role,
          text: isText ? d.text.value : null,
        }
      })
    })
    .flat()
    .reverse()

  return messages;
}

async function getNewMessages(messages, threadMessages) {
  if (messages.length === 0) {
    return threadMessages;
  }
  
  let mI = messages.length - 1;
  let tI = threadMessages.length - 1;


  // 1. Find most recent assistant local message
  while (mI >= 0 && messages[mI].role === "user") {
    mI--;
  }

  // 1.a. no assistant messages in local
  if (mI === -1) {
    return [];
  }

  // 2. Find matching message in thread messages
  while (tI >= 0) {
    if (threadMessages[tI].role !== "user" && threadMessages[tI]?.text === messages[mI]?.text) {
      break;
    }
    tI--;
  }

  tI++; // disclude matching message, 
  // 3. Now disclude user messages (local will always have these)
  while (tI < threadMessages.length && threadMessages[tI].role === "user") {
    tI++;
  }

  if (tI < 0 && tI >= threadMessages.length) {
    return [];
  }

  const newMessages = threadMessages.slice(tI);
  return newMessages;
}

export async function syncMessagesWithThread(messages, threadId) {
  const limit = 100; // limit for number of messages returned for thread (max 100)
  const rawThreadMessages = await getThreadMessages(threadId, limit);
  const threadMessages = convertThreadMessagesToMessages(rawThreadMessages);

  if (messages.length === 0 && threadMessages.length === 0) {
    return messages
  }
  const newMessages = await getNewMessages(messages, threadMessages);

  const updatedMessages = messages.concat(newMessages);

  return updatedMessages;
}

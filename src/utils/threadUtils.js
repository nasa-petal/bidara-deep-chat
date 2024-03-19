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

export async function getEmptyThread() {
  return await bidaraDB.getEmptyThread();
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

function getLastSyncedIndex(messages, threadMessages) {
  let i = 0;
  while (i < threadMessages.length) {
    if (threadMessages[i]?.role === "ai") {
      break;
    }

    i++;
  }

  let j = 0;
  while (j < messages.length) {
    if (messages[j].role != "ai") {
      j++;
      continue;
    }

    if (messages[j].text != threadMessages[i]?.text) {
      j++;
      continue;
    }

    return {
      threadIndex: i,
      messageIndex: j
    }
  }

  return null
}

function syncInterval(messagesOnInterval, threadMessagesOnInterval, threadId) {
  // Case 1
  //  messages are the same as thread
  // Case 2
  //   messages contains image not present in thread
  // Case 3
  //   thread contains text not present in messages


  let updatedMessages = [];
  let threadIndex = 0;
  let messageIndex = 0;

  while (threadIndex < threadMessagesOnInterval.length) {
    const threadMsg = threadMessagesOnInterval[threadIndex];

    // Reached end of messages, but thread has new messages
    if (messageIndex >= messagesOnInterval.length) {
      updatedMessages.push({...threadMsg, _sessionId: threadId});
      threadIndex++;

      continue;
    } 

    const msg = messagesOnInterval[messageIndex];

    // Message contains file 
    // If message contains text, then the thread will also have that text
    if (msg?.files) {
      updatedMessages.push(msg);
      messageIndex++;

      if (msg?.text === threadMsg?.text) {
        threadIndex++;
      } 

      continue;
    } 

    // messages don't match
    // which means the thread contains a message that local doesn't have
    if (msg.role !== threadMsg.role && msg.text !== threadMsg.text) {
      updatedMessages.push({...threadMsg, _sessionId: threadId});
      threadIndex++;

      continue;
    } 

    updatedMessages.push(msg);

    messageIndex++;
    threadIndex++;
  }

  return updatedMessages;
}

function areSynced(messages, threadMessages) {

  let i = 1;
  while (i < messages.length && messages[messages.length - i].role != "ai") {
    console.log(i)
    i++;
  }

  const lastAIMessage = messages[messages.length - i];
  const lastAIThreadMessage = threadMessages[threadMessages.length - i];

  return lastAIMessage?.text === lastAIThreadMessage?.text
}

function prependMessages(originalMessages, updatedMessages, index) {
  if (index != 0) {
    updatedMessages = originalMessages.slice(0, index - 1).concat(updatedMessages);
  }

  return updatedMessages;
}

export async function syncMessagesWithThread(messages, threadId) {
  const limit = 100; // limit for number of messages returned for thread (max 100)
  const rawThreadMessages = await getThreadMessages(threadId, limit);
  const threadMessages = convertThreadMessagesToMessages(rawThreadMessages);

  if (messages.length === 0 && threadMessages.length === 0) {
    return messages
  }

  if (areSynced(messages, threadMessages)) {
    return messages;
  }

  // Did not hit limit, so no special handling
  if (rawThreadMessages.length < limit) {
    const updatedMessages = syncInterval(messages, threadMessages, threadId);
    return updatedMessages
  }

  const syncedIndices = getLastSyncedIndex(messages, threadMessages);

  // No sync found, default to local to preserve images/files
  if (!syncedIndices) { 
    return messages;
  } 

  // Limit of thread messages, so should sync the slices that should be matching
  const messagesInterval = messages.slice(syncedIndices.messageIndex);
  const threadInterval = threadMessages.slice(syncedIndices.threadIndex);

  let updatedMessages = syncInterval(messagesInterval, threadInterval, threadId);

  // Add back the local messages that weren't included in the sync
  updatedMessages = prependMessages(messages, updatedMessages, syncedIndices.messageIndex);

  return updatedMessages;
}

import { validThread, getNewThreadId, getThreadMessages } from "./openaiUtils";
import * as bidaraDB from "./bidaraDB";

async function createNewThread() {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";
    return {name: new_name, id: new_id, length: 0, files: [], active: true};
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
  return await bidaraDB.getEmptyThread(emptyLength);
}

export async function getThreadImages() {
  let files = await getThreadFiles();

  let imageFiles = files.filter(file => file.type === "image")

  let imageSources = imageFiles.map(file => { return file.src })

  return imageSources 
}

export async function getThreadFiles() {
  let thread = await bidaraDB.getActiveThread();

  return thread.files;
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

export async function updateThread(thread) {
  await bidaraDB.setThread(thread);
}

export async function setThreadLength(id, length) {
  await bidaraDB.setLengthById(id, length);
}

export async function deleteThread(threadId) {
  await bidaraDB.deleteThreadById(threadId);
}

export async function pushFile(threadId, file) {
  await bidaraDB.pushFileToId(threadId, file);
}

export async function pushFiles(threadId, files) {
  await files.forEach(async ( file ) => {
    await pushFile(threadId, file);
  })
}

export async function syncThreadFiles(threadId, messages) {
  const files = await bidaraDB.getThreadFiles(threadId);

  if (files.length <= 0) {
    return messages;
  }

  const attachedFiles = files.filter(file => file.attached);
  const insertedFiles = files.filter(file => !file.attached);

  insertedFiles.forEach(file => {
    const fileInsert = { src: file.src, type: file.type, ref: {} }
    if (file.name) {
      fileInsert.name = file.name
    }

    const msg = { role: file.role, files: [ fileInsert ], _sessionId: threadId }
    messages.splice(file.index, 0, msg)
  })

  attachedFiles.forEach(file => {
    const fileInsert = { src: file.src, type: file.type, ref: {} }
    if (file.name) {
      fileInsert.name = file.name
    }

    while (file.text && !equivalentMessages(file?.text, messages[file.index]?.text)) {
      file.index += 1;
    }

    if (file.text) {
      messages[file.index].text = file.text;
    }

    if (messages[file.index].files) {
      messages[file.index].files.push(fileInsert);
    } else {
      messages[file.index].files = [fileInsert];
    }
  })

  return messages;
}

function equivalentMessages(message, threadMessage) {
  const msgFileLinkRegEx = /\]\(data:[\S]+\)/igm;
  const threadFileLinkRegEx = /\]\(sandbox:[\S]+\)/igm;

  const messagesMsg = findReplaceListRegEx(message, [msgFileLinkRegEx, threadFileLinkRegEx], [']()',']()'])
  const threadsMsg = findReplaceListRegEx(threadMessage, [msgFileLinkRegEx, threadFileLinkRegEx], [']()',']()'])

  return messagesMsg === threadsMsg;
}

function findReplaceListRegEx(string, regexs, replacements) {
  if (regexs.length != replacements.length) {
    throw new Error("Number of replacements must match number of matches (findReplaceListRegEx)");
  }

  for (let i = 0; i < regexs.length; i++) {
    string = findReplaceRegEx(string, regexs[i], replacements[i]);
  }

  return string;
}

function findReplaceRegEx(string, regex, replacement) {
  if (!string) {
    return string;
  }

  const matches = (string.match(regex) || [])

  matches.forEach(match => {
    string = string.replace(match, replacement)
  })

  return string
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

function clearNullChats(messages) {
  return messages.filter(msg => msg.text !== null || msg.files );
}

export async function syncMessages(threadId, initialMessages) {
  const rawThreadMessages = await getThreadMessages(threadId, 100);
  const threadMessages = convertThreadMessagesToMessages(rawThreadMessages);
  const fullMessages = initialMessages.concat(threadMessages);

  const messages = clearNullChats(fullMessages);

  const syncedMessages = await syncThreadFiles(threadId, messages);

  return syncedMessages;
}

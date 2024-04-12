import { validThread, getNewThreadId, getThreadMessages, getFileSrc } from "./openaiUtils";
import * as bidaraDB from "./bidaraDB";

async function createNewThread() {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";
    return {name: new_name, id: new_id, length: 0, active: true};
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

export async function getThreadImages(id) {
  let files = await getThreadFiles(id);

  let imageFiles = files.filter(file => file.type === "image")

  let imageSources = imageFiles.map(file => { return file.src })

  return imageSources 
}

export async function getThreadFiles(id) {
  const files = await bidaraDB.getThreadFiles(id);

  return files;
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

export async function syncThreadFiles(threadId, messages, files) {
  if (files.length <= 0) {
    return messages;
  }

  const attachedFiles = files.filter(file => file.attached);
  const insertedFiles = files.filter(file => !file.attached);

  insertedFiles.forEach(file => {
    if (!file.index || file.index === -1) {
      return;
    }

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
      file.index = file.index + 1;
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

  const regEx = [ msgFileLinkRegEx, threadFileLinkRegEx ];
  const replacements = [ ']()', ']()'];

  const messagesMsg = findReplaceListRegEx(message, regEx, replacements)
  const threadsMsg = findReplaceListRegEx(threadMessage, regEx, replacements)

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
    string = string.replaceAll(match, replacement)
  })

  return string
}

function getFileNameFromLink(link) {
  const regex = /^sandbox:\/mnt\/data\/(.*)$/;

  const matches = (link.match(regex) || []);

  if (matches.length >= 2) {
    return matches[1];
  }

  return "";
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

async function replaceThreadFiles(threadId, threadMessages, files) {
  const replaceFiles = files.filter(file => file.thread_id === threadId && files.replaceText !== null);

  const withFiles = await Promise.all(threadMessages.map(async (message) => {
    const content = await Promise.all(message.content.map(async (content) => {
      if (content.type !== "text") {
        return content;
      }

      if (!content.text?.annotations || content.text?.annotations?.length < 1) {
        return content;
      }
      const newFiles = [];

      const replacements = await Promise.all(content.text.annotations.map(async (annotation) => {
        if (annotation.type !== "file_path" || !annotation?.file_path?.file_id || annotation.text.substring(0,7) !== "sandbox") {
          return {};
        }

        const existingReplacement = replaceFiles.filter(file => file.replaceText === annotation.text);

        if (existingReplacement.length > 0 && existingReplacement[0].src) {
          return { link: annotation.text, src: existingReplacement[0].src };
        }

        const fileSrc = await getFileSrc(annotation.file_path.file_id);

        const fileName = getFileNameFromLink(annotation.text);

        const newFile = {
          thread_id: threadId,
          type: "any",
          name: fileName,
          src: fileSrc,
          index: null,
          attached: false,
          role: message.role,
          text: null,
          replaceText: annotation.text,
        }

        newFiles.push(newFile);

        return { link: annotation.text, src: fileSrc };
      }));

      replacements.forEach((replacement) => {
        content.text.value = content.text.value.replaceAll(replacement.link, replacement.src);
      })

      newFiles.forEach(async (newFile) => {
        if (content.text.value) {
          newFile.text = content.text.value;
        }

        await pushFile(threadId, newFile);
      });

      return content;
    }));
    message.content = content;
    return message;
  }));

  return withFiles;
}

export async function syncMessages(threadId, initialMessages) {
  const rawThreadMessages = await getThreadMessages(threadId, 100);
  const files = await bidaraDB.getThreadFiles(threadId);

  const threadMessagesWithFiles = await replaceThreadFiles(threadId, rawThreadMessages, files);

  const threadMessages = convertThreadMessagesToMessages(threadMessagesWithFiles);
  const fullMessages = initialMessages.concat(threadMessages);

  const messages = clearNullChats(fullMessages);

  const syncedMessages = await syncThreadFiles(threadId, messages, files);

  return syncedMessages;
}

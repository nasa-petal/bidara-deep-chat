import { validThread, getNewThreadId, getThreadMessages, getFileSrc, getFileInfo, validAssistant, getNewAsst } from "./openaiUtils";
import * as bidaraDB from "./bidaraDB";

async function createNewThread(asst) {
  const new_id = await getNewThreadId();

  if (new_id) {
    const new_name = "New Chat";

    return {
      name: new_name,
      id: new_id,
      asst: asst,
      length: 0,
      active: 1
    };
  }

  return null;
}

export async function getActiveThread(defaultAsst) {
 
  const thread = await bidaraDB.getActiveThread();
  if (thread === null) { // thread doesn't exist, so everything new
    const asst = await getNewAsst(null, defaultAsst);
    const newThread = await createNewThread(asst);
    await bidaraDB.setThread(newThread);
    return newThread;
  }

  const isValidThreadId = await validThread(thread.id);
  if (!isValidThreadId) { // thread is invalid, so new thread with same asst
    await bidaraDB.deleteThreadById(thread.id);
    const recentThread = await getRecentThread();

    if (recentThread === null) {
      const asst = await getNewAsst(null, defaultAsst);
      const newThread = await createNewThread(asst);
      await bidaraDB.setThread(newThread);
      return newThread;
    }

    await setActiveThread(null, recentThread.id);
    return await getActiveThread(defaultAsst);
  }
  
  let asst = thread.asst;
  if (!asst) { 
    asst = await getNewAsst(null, defaultAsst);
    await setThreadAsst(thread, asst);
    thread.asst = asst;

  } else if  (asst && !(await validAssistant(asst.id, asst.name+'v'+asst.version))) { // asst doesn't exist, or is invalid
    asst = await getNewAsst(asst, defaultAsst);
    await setThreadAsst(thread, asst);
    thread.asst = asst;
  }

  return thread;
}

export async function getNewThread(asst) {
  const thread = await createNewThread(asst);
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

export async function getFileByFileId(id) {
  const file = await bidaraDB.getFileById(id);
  return file
}

export async function setActiveThread(prevThreadId, threadId) {
  if (prevThreadId) {
    await bidaraDB.setActiveStatusById(prevThreadId, false);
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

export async function setThreadAsst(thread, asst) {
  if (!thread.hasOwnProperty("asst")) {
    thread.asst = asst;
    await bidaraDB.setThread(thread);

  } else {
    await bidaraDB.setAsstById(thread.id, asst);
  }
}

export async function deleteThread(threadId) {
  await bidaraDB.deleteThreadById(threadId);
}

export async function pushFile(file) {
  await bidaraDB.pushFile(file);
}

export async function pushFiles(files) {
  await files.forEach(async ( file ) => {
    await pushFile(file);
  })
}

async function retrieveStoredFiles(threadId) {
  const files = await getThreadFiles(threadId);

  const filesMap = new Map();
  files.forEach((file) => {
    filesMap.set(file.fileId, file);
  })

  return {
    list: files,
    map: filesMap
  };
}

export async function retrieveFile(threadId, fileId) {
  const fileInfo = await getFileInfo(fileId);
  if (!fileInfo) {
    return { fileId, threadId, src: "", name: "[ Deleted File ]", type: "any" };
  }

  const fileSrc = await getFileSrc(fileId);
  if (!fileSrc) {
    return { fileId, threadId, src: "", name: "[ Deleted File ]", type: "any" };
  }

  let fileName;
  if (fileInfo.filename.startsWith("/mnt/data/")) {
    fileName = fileInfo.filename.substring(10);
  } else {
    fileName = fileInfo.filename;
  }

  const fileType = getFileTypeByName(fileName) === "image" ? "image" : "any";

  const file = { fileId, threadId, src:fileSrc, name:fileName, type:fileType};

  return file;
}

export async function retrieveFiles(threadId, fileIds) {
  const filesMap = new Map();

  const promises = fileIds.map(async (fileId) => {
    const file = await retrieveFile(threadId, fileId)
    filesMap.set(fileId, file);

    return file;
  });

  const files = await Promise.all(promises);

  return {
    list: files,
    map: filesMap
  };
}

async function retrieveNewFiles(threadId, messages, storedFiles) {
  const newFileIds = messages.map((message) => {
    const fileIds = message.attachments.map(attachment => attachment.file_id);

    const newFileIds = fileIds.filter( (fileId) => message.role !== "user" && !storedFiles.get(fileId));
    return newFileIds;
  })
  .flat();

  const files = await retrieveFiles(threadId, newFileIds);

  return {
    list: files.list,
    map: files.map
  };
}

export function getFileTypeByName(fileName) {
  const fileTypes = {
    "csv": "csv",
    "xlsx": "excel",
    "pdf": "pdf",
    "txt": "txt",
    "pptx": "powerpoint",
    "docx": "word",
    "doc": "word",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "webp": "image",
    "gif": "image"
  }

  if (!fileName) {
    return "";
  }

  const extensionMatches = /^.*\.(csv|xlsx|pdf|txt|pptx|docx|doc|png|jpg|jpeg|webp|gif)$/gm.exec(fileName);

  // first is whole match, second is capture group. Only one capture group can appear.
  if (!extensionMatches || extensionMatches.length !== 2) {
    return "none";
  }

  const extension = extensionMatches[1];

  const type = fileTypes[extension];

  if (!type) {
    return "none";
  }

  return type;
}

export async function loadMessages(threadId) {
  const rawThreadMessages = await getThreadMessages(threadId, 100);

  const messages = await convertThreadMessagesToMessages(threadId, rawThreadMessages);

  return messages;
}

async function convertThreadMessagesToMessages(threadId, threadMessages) {
  const storedFiles = await retrieveStoredFiles(threadId);

  const newFiles = await retrieveNewFiles(threadId, threadMessages, storedFiles.map);

  const annotatedFiles = storedFiles.list.filter((file) => !!file?.annotation);

  const messages = threadMessages.map(message => {
    const role = message.role === "assistant" ? "ai" : message.role;

    const content = message.content;
    const fileIds = message.attachments.map(attachment => attachment.file_id);

    const files = handleAttachments(fileIds, storedFiles.map, newFiles.map);

    const text = handleAnnotations(content, storedFiles.map, newFiles.map, annotatedFiles)

    return {
      role,
      text,
      files,
      _sessionId: threadId
    }
  })
  .flat()
  .reverse()

  return messages;
}

function handleAttachments(fileIds, storedFiles, newFiles) {
  return fileIds.map((fileId) => {
    const storedFile = storedFiles.get(fileId);

    if (storedFile) {
      return { src: storedFile.src, type: storedFile.type, name: storedFile.name };
    }

    const newFile = newFiles.get(fileId);
    if (newFile) {
      return { src: newFile.src, type: "any", name: "" };
    }

    return { src: "", type: "any", name: "[ Deleted File ]" }
  });
}

function handleAnnotations(content, storedFiles, newFiles, annotatedFiles) {
  const textContents = content.filter((msg) => msg.type === 'text');

  const texts = textContents.map(msg => {
    let msgText = msg.text.value;
    const annotations = msg.text.annotations;

    annotations.forEach((annotation) => {
      const fileId = annotation.file_citation.file_id;
      const replacement = annotation.text;
      const storedFile = storedFiles.get(fileId);
      const newFile = newFiles.get(fileId);

      if (storedFile) {
        msgText = msgText.replaceAll(replacement, storedFile.src ? storedFile.src : "");

      } else if (newFile) {
        msgText = msgText.replaceAll(replacement, newFile.src ? newFile.src : "");

      } else {
        msgText = msgText.replaceAll(replacement, "[ Deleted File ]")
      }

      
    })

    annotatedFiles.forEach((file) => {
      msgText = msgText.replaceAll(file.annotation, file.src);
    })

    return msgText;
  });

  if (texts.length > 0) {
    return texts[0];
  }

  return "";
}


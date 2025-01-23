<script>
  import { DeepChat } from 'deep-chat-dev';
  import { setOpenAIKey, cancelThreadRun } from '../utils/openaiUtils';
  import * as threadUtils from '../utils/threadUtils';
  import logger from '../utils/logger.js'; 


  export let key = null;
  export let thread = null;
  export let asst = null;

  export let loginHandler;

  export let onLoadComplete;
  export let renameThread = null;

  export let width = "100%";
  export let height = "100%";

  const threadId = thread?.id;
  const asstId = thread?.asst?.id;
  const asstConfig = asst?.config;
  

  // vars for callbacks
  let lastMessageId;
  let currRunId = null;
  let newFileUploads = [];
  let newFileIds = [];
  let shouldProcessImages = false;
  let imagesToProcess = [];

  let deepChatRef;
  let loadedMessages = false;

  async function onError(error) {
    console.error(error);

    if (threadId && currRunId) {
      console.log("Cancelling thread run due to error.");
      await cancelThreadRun(threadId, currRunId);
    }
  }

  async function loadMessages(threadToLoad) {
    if (loadedMessages || !threadToLoad || !threadToLoad?.id) {
      return;
    }
    loadedMessages = true;

    const messagesToLoad = await threadUtils.loadMessages(threadToLoad.id);
    messagesToLoad.forEach(( msg ) => { deepChatRef.addMessage(msg)});

    onLoadComplete();
  }

  async function updateMessages() {
    const messages = deepChatRef.getMessages();
    if (messages.length > 0) {
      thread.length = messages.length;
      await threadUtils.setThreadLength(threadId, thread.length);
    }
  }

  async function onMessage(message) { 
    if (!deepChatRef || message.isInitial) {
      return
    }
    
    if (thread.length === 0 || thread.length === asst.history + 1) {
      const maxCharLen = 50;
      let words = message.message.text?.split(/\s+/);
      if(!words) {
        // first user message is a file upload.
        words = message.message.files?.[0]?.name?.split(/\s+/);
      }
      if(!words) {
        // first user message is an image upload.
        words = message.message.files?.[0]?.ref?.name?.split(/\s+/);
      }

      let name = "";

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (i !== 0) {
          name += " ";
        }

        if (name.length + word.length <= maxCharLen) {
          name += word;
        } else {
          name += word.slice(0, maxCharLen - name.length);
          break;
        }
      }

      await renameThread(name);
    }

    await updateMessages();

    // for funcCalling context
    if (message.message.role === "user") {
      lastMessageId = message.message._sessionId;

      if (message.message?.files?.length > 0) {
        newFileUploads = message.message.files;
      }
    } else if (message.message.role === "ai") {
      if (newFileIds.length > 0) {
        newFileUploads = message.message.files;

        handleFileUploads(newFileIds, newFileUploads);
      }
    }
  }

  async function onComponentRender() {
    deepChatRef = document.getElementById("chat-element");

    if (deepChatRef) {
      setDeepChatKeyboardSupport();
    }
    // save key to localStorage.
    // The event occurs before key is set, and again, after key is set.
    if (!key && this._activeService.key) {
      // if key set through UI or in URL variable, save it to localStorage.
      setOpenAIKey(this._activeService.key);
      await loginHandler();
    }

    await loadMessages(thread)
  }

  async function processImageCallback(imageFile) {
    shouldProcessImages = true;
    imagesToProcess.push(imageFile);
  }

  function fileTools(fileNames) {
    let fileTool = "code_interpreter";
    if (Array.isArray(fileNames) && fileNames.length > 0) {
      let fileType = threadUtils.getFileTypeByName(fileNames[0]);
      if (fileType == "image") {
        fileTool = "images";
      }
      else if (["txt","powerpoint","pdf","word"].indexOf(fileType) !== -1) {
        fileTool = "file_search";
      }
    }
    return fileTool;
  }

  async function handleFuncCalling(functionDetails) {
    let context = {
      lastMessageId,
      processImageCallback
    }

    return await asst.funcCalling(functionDetails, context);
  }

  async function handleFileUploads(fileIds, fileUploads) {
    let newFiles;

    if (!fileUploads || fileUploads.length < 1) {
      const files = await threadUtils.retrieveFiles(lastMessageId, fileIds);
      newFiles = files.list;

    } else {
      newFiles = fileUploads.map((file, i) => {
        const fileId = fileIds[i];
        const name = file.ref?.name ? file.ref.name : file.name;
        const newFile = {
          fileId: fileId,
          threadId: lastMessageId, 
          name,
          type: file.type,
          src: file.src
        }

        return newFile;
      })
    }

    await threadUtils.pushFiles(newFiles);

    newFileUploads = [];
    newFileIds = [];
  }

  async function responseInterceptor(response) {
    if (response.id && response.object === "thread.run") {
        currRunId = response.id;
    }
    if (response.object === "list") {
      if (response.data[0].attachments.length > 0) {
        newFileIds = response.data[0].attachments.map(attachment => attachment.file_id);
      }

      if (shouldProcessImages) {
        imagesToProcess.forEach((imageToProcess) => {
          const updatedContent = response.data[0].content.map((content) => {
            if (content.type === "text") {
              content.text.value = content.text.value.replaceAll(imageToProcess.annotation, imageToProcess.src);
            }
            return content;
          })

          response.data[0].content = updatedContent;
        });

        shouldProcessImages = false;
        imagesToProcess = [];
      }
    }
    
    return response;
  }

  async function requestInterceptor(request) {
    const body = request.body;

    // logger.debug("Original Request Body:", JSON.stringify(body, null, 2));
    // console.log("Original Request Body:", JSON.stringify(body, null, 2));
    
    
    // Ensure placeholder text is added for file-only requests, or requests with empty message text.
    const fileMsg = {
      type: "text", 
      text: 
        "I just uploaded a file. Ask me what I'd like you to do with it."
    }

    if ( // an image was uploaded. todo: handle multiple images uploaded at once.
      'content' in body &&
      Array.isArray(body.content) &&
      body.content.length > 0 &&
      'image_file' in body.content[0]
    ) {
      if(body.content.length > 1) { // user included a message with the image
        fileMsg.text = "The file_id is: " + body.content[0].image_file.file_id;
      }
      else { //user did not include a message with the image
        fileMsg.text += " The file_id is: " + body.content[0].image_file.file_id;
      }
      body.content.push(fileMsg);
    }

    else if ( // just a file was uploaded with no text message.
      'attachments' in body && 
      Array.isArray(body.attachments) && 
      body.attachments.length > 0 && 
      (
        !('content' in body) || 
        !Array.isArray(body.content) || 
        body.content.length === 0 || 
        !('text' in body.content[0]) || 
        !(typeof body.content[0].text === 'string') || 
        body.content[0].text.trim().length === 0
      )
    ) {
      // logger.info("Adding placeholder text for file-only request.");
      body.content = [fileMsg];
    } else {
        // logger.warn("Request body does not contain a valid content structure.");
    }

    // Transform attachments to include file_id
    if (newFileUploads.length > 0) {
      if('attachments' in body && Array.isArray(body.attachments) && body.attachments.length > 0) {
        newFileIds = request.body.attachments.map(attachment => attachment.file_id);
        handleFileUploads(newFileIds, newFileUploads);
      }
      else if(Array.isArray(request.body?.content) && request.body?.content.length > 0) {
        //image uploaded
        newFileIds = request.body.content.map(attachment => attachment.image_file?.file_id);
        newFileIds = newFileIds.filter(item => item !== undefined); // an undefined array entry is created if an image is uploaded alongside a text message. This line removes that undefined array entry.
        handleFileUploads(newFileIds, newFileUploads);
      }
    }

    // Debug modified request
    // logger.debug("Final Request Body Sent to API:", JSON.stringify(body, null, 2));

    return request;
  }


  function setDeepChatKeyboardSupport() {
    const shadowRoot = deepChatRef.shadowRoot;
    const input = shadowRoot.getElementById("input");

    if (!input) {
      return;
    }

    const inputButtons = input.getElementsByClassName("input-button");
    if (!inputButtons) { return };

    for (let i = 0; i < inputButtons.length; i++) {
      const button = inputButtons[i];
      const buttonClickEventListener = button.onclick;

      if (!buttonClickEventListener) {
        return
      }

      button.tabIndex = 0;
      button.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') buttonClickEventListener(e); });
    }
  }
</script>

<deep-chat
  id="chat-element"
  directConnection={{
    //azure: {
    openAI: {
      key: key,
      validateKeyProperty: key ? false : true, // if apiKey is not null it has already been validated.
      //openAI: {
        assistant: key ? {
          assistant_id: asstId,
          new_assistant: asstConfig,
          thread_id: threadId,
          load_thread_history: false,
          files_tool_type: fileTools,
          function_handler: handleFuncCalling
        } : null
    }
  }}
  history={asst?.history}
  errorMessages={{
    displayServiceErrorMessages: true
  }}
  onError={onError}
  onMessage={onMessage}
  onComponentRender={onComponentRender}
  responseInterceptor={responseInterceptor}
  requestInterceptor={requestInterceptor}
  _insertKeyViewStyles={{displayCautionText: false}}
  demo={false}
  displayLoadingBubble={true}
  speechToText={{
    webSpeech: "true",
    commands: {
      submit: "dude"
    },
    settings: {
      substrings: "false"
    },
    button: {
      default: {
        container: {
          default: {
            width: "1em",
            height: "1em",
            bottom: ".7em",
            borderRadius: "100vmax",
            padding: "0.5em",
            backgroundColor: "var(--nav-color)",
            left: "calc(11px - 0.25em)"
          }
        },
        svg: {
          styles: {
            default: {
              bottom: "0.35em",
              left: "0.4em"
            }
          }
        }
      },
      position: "outside-right"
    }
  }}
  mixedFiles={{
    button: {
      styles: {
        container: {
          default: {
            width: "1em",
            height: "1em",
            right: "calc(10% + 0.4em)",
            bottom: ".7em",
            borderRadius: "100vmax",
            padding: "0.5em",
            backgroundColor: "var(--nav-color)"
          }
        },
        svg: {
          styles: {
            default: {
              bottom: "0.35em",
              left: "0.4em"
            }
          }
        }
      },
      position: "outside-left"
    }
  }}
  attachmentContainerStyle={{
    backgroundColor: "var(--translucent-nav-color)",
    borderRadius: "5px 5px 0 0",
    border: "1px solid var(--border-color)",
    top: "-2.55em",
    height: "4em",
    width: "calc(100% - 6.2em - 2px)"
  }}
  textInput={{
    styles: {
      container: {
        width: "calc(100% - 6em)",
        boxShadow: "none",
        borderRadius: "1em",
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--chat-background-color)",
        color: "var(--text-primary-color)",
      },
      text: {
        padding: "0.4em 2.5em 0.4em 0.8em",
      }
    },
    placeholder:{text: "How might we..."}
  }}
  chatStyle={{
    display: "block",
    width: width,
    height: height,
    backgroundColor: "var(--chat-background-color)",
    border: "none",
    fontSize: "17px",
    fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
  }}
  messageStyles={{
    default: {
      shared: {
        bubble: {
          maxWidth: "75%",
          borderRadius: "1em",
          padding: ".42em .7em"
        }
      },
      ai: {
        bubble: {
          color: "var(--text-primary-color)",
          backgroundColor: "var(--ai-message-background-color)",
        }
      },
      user: {
        bubble: {
          color: "white",
          backgroundColor: "var(--user-message-background-color)",
        }
      }
    },
    loading: {
      message: {
        styles: {
          bubble: {
            color: "var(--text-primary-color)",
            backgroundColor: "var(--ai-message-background-color)",
            padding: '0.6em 0.75em 0.6em 1.3em'
          }
        }
      }
    }
  }}
  submitButtonStyles={{
    submit: {
      container: {
        default: {
          width: "1em",
          height: "1em",
          right: "calc(10% + 0.3em)",
          bottom: ".87em",
          borderRadius: "100vmax",
          padding: "0.3em",
          backgroundColor: "var(--user-message-background-color)"
        }
      },
      svg: {
        content: '<svg viewBox="2 2 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C12.2652 3 12.5196 3.10536 12.7071 3.29289L19.7071 10.2929C20.0976 10.6834 20.0976 11.3166 19.7071 11.7071C19.3166 12.0976 18.6834 12.0976 18.2929 11.7071L13 6.41421V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V6.41421L5.70711 11.7071C5.31658 12.0976 4.68342 12.0976 4.29289 11.7071C3.90237 11.3166 3.90237 10.6834 4.29289 10.2929L11.2929 3.29289C11.4804 3.10536 11.7348 3 12 3Z" fill="#ffffff" stroke="white" stroke-width="1"/></svg>'
      }
    },
    loading: {
      container: {
        default: {
          backgroundColor: "var(--chat-background-color)",
        }
      },
      svg: {
        content: '<svg viewBox="2 2 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C12.2652 3 12.5196 3.10536 12.7071 3.29289L19.7071 10.2929C20.0976 10.6834 20.0976 11.3166 19.7071 11.7071C19.3166 12.0976 18.6834 12.0976 18.2929 11.7071L13 6.41421V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V6.41421L5.70711 11.7071C5.31658 12.0976 4.68342 12.0976 4.29289 11.7071C3.90237 11.3166 3.90237 10.6834 4.29289 10.2929L11.2929 3.29289C11.4804 3.10536 11.7348 3 12 3Z" fill="#b1b1b1" stroke="#b1b1b1" stroke-width="1"/></svg>'
      }
    }
  }}
  auxiliaryStyle={`
    a {
    color: var(--link-color);
    }
    a:visited {
    color: var(--link-visited-color);
    }
    img {
      max-width: 100%;
    }
    button:focus-visible {
      outline: 5px auto -webkit-focus-ring-color; 
    }
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-thumb {
      background-color: var(--border-off-color);
      border-radius: 5px;
    }
    ::-webkit-scrollbar-track {
      background-color: var(--chat-background-color);
    }`
  }
/>

<style>
</style>

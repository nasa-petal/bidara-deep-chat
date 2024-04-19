<script>
  import { DeepChat } from 'deep-chat';
  import { setOpenAIKey, cancelThreadRun } from '../utils/openaiUtils';
  import * as threadUtils from '../utils/threadUtils';

  export let key = null;
  export let asstId = null;
  export let asstConfig = null;
  export let thread = null;
  export let initialMessages = null;
  export let funcCalling = null;

  export let loginHandler;
  export let loadedMessages;

  export let loading = true;
  export let width = "100%";
  export let height = "100%";

  let lastMessageId;
  let threadId = thread?.id; 
  let currRunId = null;
  let newFileUploads = [];
  let newFileIds = [];
  let shouldProcessImage = false;
  let imageToProcess = null;

  let deepChatRef;

  async function onError(error) {
    console.error(error);

    if (threadId && currRunId) {
      console.log("Cancelling thread run due to error.");
      await cancelThreadRun(threadId, currRunId);
    }
  }

  async function loadMessages(threadToLoad) {
    loadedMessages = true;

    if (!threadToLoad || !threadToLoad?.id) {
      return;
    }

    const updatedMessages = await threadUtils.syncMessages(threadToLoad.id, initialMessages);
    const messagesToLoad = updatedMessages.slice(initialMessages.length);
    messagesToLoad.forEach(msg => deepChatRef._addMessage(msg));
  }

  async function updateMessages() {
    const messages = deepChatRef.getMessages();
    if (messages.length > 0) {
      thread.length = messages.length;
      await threadUtils.setThreadLength(thread.id, thread.length);
    }
  }

  async function onNewMessage(message) { 
    if (!deepChatRef || message.isInitial) {
      return
    }

    updateMessages();

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
    setDeepChatKeyboardSupport();
    // save key to localStorage.
    // The event occurs before key is set, and again, after key is set.
    if (!key && this._activeService.key) {
      // if key set through UI or in URL variable, save it to localStorage.
      setOpenAIKey(this._activeService.key);
      await loginHandler();
    }

    if (!loadedMessages) {
      await loadMessages(thread)
    }


    setTimeout(()=> loading = false, 400);
  }

  async function processImageCallback(imageFile) {
    shouldProcessImage = true;
    imageToProcess = imageFile;
  }

  async function handleFuncCalling(functionDetails) {
    let context = {
      lastMessageId,
      processImageCallback
    }

    return await funcCalling(functionDetails, context);
  }

  async function handleFileUploads(fileIds, fileUploads) {
    const formattedFiles = fileUploads.map((file, i) => {
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

    await threadUtils.pushFiles(formattedFiles);

    newFileUploads = [];
    newFileIds = [];
  }

  async function responseInterceptor(response) {
    if (response.id && response.object === "thread.run") {
        currRunId = response.id;
    }
    if (response.object === "list") {
      if (response.data[0].file_ids.length > 0) {
        newFileIds = response.data[0].file_ids;
      }

      if (shouldProcessImage) {
        response.data[0].file_ids.push(imageToProcess.file_id);
        const updatedContent = response.data[0].content.map((content) => {
          if (content.type === "text") {
            content.text.value = content.text.value.replaceAll(imageToProcess.annotation, imageToProcess.src);
          }
          return content;
        })

        shouldProcessImage = false;
        imageToProcess = null;
        response.data[0].content = updatedContent;
      }
    }
    
    return response;
  }

  async function requestInterceptor(request) {
    if (newFileUploads.length > 0) {
      newFileIds = request.body.file_ids;

      handleFileUploads(newFileIds, newFileUploads);
    }

    return request;
  }

  function setDeepChatKeyboardSupport() {
    const shadowRoot = deepChatRef.shadowRoot;
    const input = shadowRoot.getElementById("input");
    const inputButtons = input.getElementsByClassName("input-button");
    inputButtons.forEach(button => {
      const buttonClickEventListener = button.onclick;

      if (!buttonClickEventListener) {
        return
      }

      button.tabIndex = 0;
      button.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') buttonClickEventListener(e); });
    });
  }
</script>

<deep-chat
  id="chat-element"
  directConnection={{
    openAI: {
      key: key,
      validateKeyProperty: key ? false : true, // if apiKey is not null it has already been validated.
      assistant: {
        assistant_id: asstId,
        new_assistant: asstConfig,
        thread_id: threadId,
        load_thread_history: false,
        function_handler: handleFuncCalling
      }
    }
  }}
  errorMessages={{
    displayServiceErrorMessages: true
  }}
  onError={onError}
  onNewMessage={onNewMessage}
  onComponentRender={onComponentRender}
  responseInterceptor={responseInterceptor}
  requestInterceptor={requestInterceptor}
  _insertKeyViewStyles={{displayCautionText: false}}
  demo={false}
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
  initialMessages={initialMessages}
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
      shared: {
        bubble: {
          padding: "0.6em 0.75em 0.6em 1.3em"
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

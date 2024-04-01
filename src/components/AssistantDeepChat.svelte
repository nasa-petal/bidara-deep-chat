<script>
  import { DeepChat } from 'deep-chat';
  import { setOpenAIKey } from '../utils/openaiUtils';
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

  let deepChatRef;

  function onError(error) {
    console.log(error);
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

  async function updateFiles(message) {
    const files = message.message?.files;
    if (!files || files.length <= 0) {
      return;
    }

    const index = thread.length - 1;
    let attached = false;
    if (message.message?.text?.length > 0) {
      attached = true;
    }
    
    const role = message.message.role;

    const text = message.message.text;

    const formattedFiles = files.map(file => {
      let type = file.type;
      let src = file.src;
      let name = file?.name ? file.name : "";

      return {
        type,
        name,
        src,
        index,
        attached,
        role,
        text,
      }
    });

    await threadUtils.pushFiles(threadId, formattedFiles);
  }

  async function onNewMessage(message) { 
    if (!deepChatRef || message.isInitial) {
      return
    }

    updateMessages();
    updateFiles(message);

    // for funcCalling context
    if (message.message.role === "user") {
      lastMessageId = message.message._sessionId;
    }
  }

  async function onComponentRender() {
    deepChatRef = document.getElementById("chat-element");
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


  async function addMessageCallback(message) {
    deepChatRef._addMessage(message);

    await updateMessages();
    await updateFiles({ message });
  }

  async function handleFuncCalling(functionDetails) {
    let context = {
      lastMessageId,
      addMessageCallback
    }

    return funcCalling(functionDetails, context)
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
            backgroundColor: "rgba(0, 0, 0, 0.1)",
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
            backgroundColor: "rgba(0, 0, 0, 0.1)"
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
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: "5px 5px 0 0",
    border: "1px solid rgba(0,0,0,0.2)",
    top: "-2.55em",
    height: "4em",
    width: "calc(100% - 6.2em)"
  }}
  textInput={{
    styles: {
      container: {
        width: "calc(100% - 6em)",
        boxShadow: "none",
        borderRadius: "1em",
        border: "1px solid rgba(0,0,0,0.2)"
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
    backgroundColor: "white",
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
          backgroundColor: "rgb(0, 132, 255)"
        }
      },
      svg: {
        content: '<svg viewBox="2 2 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C12.2652 3 12.5196 3.10536 12.7071 3.29289L19.7071 10.2929C20.0976 10.6834 20.0976 11.3166 19.7071 11.7071C19.3166 12.0976 18.6834 12.0976 18.2929 11.7071L13 6.41421V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V6.41421L5.70711 11.7071C5.31658 12.0976 4.68342 12.0976 4.29289 11.7071C3.90237 11.3166 3.90237 10.6834 4.29289 10.2929L11.2929 3.29289C11.4804 3.10536 11.7348 3 12 3Z" fill="#ffffff" stroke="white" stroke-width="1"/></svg>'
      }
    }
  }}
/>

<style>
</style>

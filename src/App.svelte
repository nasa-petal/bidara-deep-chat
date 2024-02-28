<script>
  import { Navbar, Sidebar, AssistantDeepChat, Login } from './components';
  import { BIDARA_CONFIG, BIDARA_INITIAL_MESSAGES } from './assistant/bidara';
  import { funcCalling } from './assistant/bidaraFunctions';
  import { getKeyAsstAndThread  } from './utils/openaiUtils';
  import { setThread, getThread, deleteThreadFromThreads, getNewThread, getThreads, setThreads, setActiveThreadName, updateThreadAndThreads, getEmptyThreads } from './utils/threadUtils';
  import hljs from "highlight.js";
  window.hljs = hljs;

  let activeKey = null;
  let activeThread = null;
  let activeAsstId = null;
  let activeAsstConfig = null;
  let activeFuncCalling = null;
  let activeInitialMessages = null;
  let threads = null;

  let loading = true;
  let loggedIn = false;
  let open = false;

  async function initKeyAsstAndThreads() {
    const keyAsstAndThread = await getKeyAsstAndThread();

    if (!keyAsstAndThread[0]) {
      return;
    }

    activeKey = keyAsstAndThread[0];
    activeAsstId = keyAsstAndThread[1];
    activeThread = keyAsstAndThread[2];

    activeInitialMessages = BIDARA_INITIAL_MESSAGES;
    activeAsstConfig = BIDARA_CONFIG;
    activeFuncCalling = funcCalling;

    threads = getThreads();

    loggedIn = true;
  }

  async function newThreadAndSwitch() {
    // If the thread is already "new", stay on it
    if (activeThread && activeThread.length <= 0) {
      if (activeThread.name != "New Chat") {
        await renameActiveThread("New Chat");
      }
      return true;
    } 

    // If an empty thead is already created, prevents creating a new one
    const emptyThreads = getEmptyThreads();
    if (emptyThreads && emptyThreads.length >= 1) {

      const emptyThread = emptyThreads[0];
      switchActiveThread(emptyThread);

      return true;
    }

    const thread = await getNewThread();
    threads.unshift(thread);

    setThreads(threads);

    await switchActiveThread(thread);
    
    return true;
  }

  async function deleteThreadAndSwitch(thread) {

    threads = deleteThreadFromThreads(thread.id);

    if (thread.id === activeThread.id) {
      activeThread = {};
      if (threads && threads.length > 0) {
        switchActiveThread(threads[0]);
      } else {
        await newThreadAndSwitch();
      }
    }

    return true;
  }

  
  async function switchActiveThread(thread) {
    if (thread.id === activeThread.id) {
      return;
    }
    loading = true;

    await setThread(thread);
    const keyAsstAndThread = await getKeyAsstAndThread();
    activeThread = keyAsstAndThread[2];

    return true;
  }

  async function renameActiveThread(name) {
    await setActiveThreadName(name);

    threads = getThreads();
    activeThread = await getThread();

    return true;
  }

  async function updateThread(thread) {
    updateThreadAndThreads(thread, threads);
  }
</script>

<main class="flex">
  <div class="w-full h-full flex flex-col justify-between">
    {#await initKeyAsstAndThreads() then}
    {#if !loggedIn}
      <Login loginHandler={initKeyAsstAndThreads} />

    {:else}
      <Navbar bind:chat_name={activeThread.name} bind:sidebar={open} handleRename={renameActiveThread}/>   

      <div id="content-container" class="flex justify-between w-full h-full flex-1" class:open>
        <div>
          <Sidebar handleChatSelect={switchActiveThread} handleChatDelete={deleteThreadAndSwitch} handleChatNew={newThreadAndSwitch} bind:threads bind:open bind:selectedThreadId={activeThread.id}/>
        </div>

        {#key activeThread}
        <div id="chat-container" class="w-full" class:loading>
          <AssistantDeepChat
            key={activeKey}
            asstId={activeAsstId}
            asstConfig={activeAsstConfig}
            thread={activeThread}
            funcCalling={activeFuncCalling}
            initialMessages={activeInitialMessages}
            updateThread={updateThread}
            loginHandler={null}
            bind:loading

            width="100%"
            height="100%"
            />
        </div>
        {/key}
      </div>
    {/if}
    {/await}
  </div>
</main>


<style>
  #content-container {
    overflow-y: hidden;
  }

  #chat-container {
    transition: width 0.3s ease, filter 0.3s ease-out;
  }
  
  .open #chat-container {
    width: 80%;
  }

  @media only screen and (max-width: 1400px) {
    .open #chat-container {
      width: 70%;
    }
  }

  @media only screen and (max-width: 1000px) {
    .open #chat-container {
      width: 60%;
    }
  }

  @media only screen and (max-width: 700px) {
    .open #chat-container {
      width: 100%;
    }
  }

  main {
    font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    width: 100%;
    height: calc(100% + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .loading {
    filter: blur(2px);
    pointer-events: none;
  }
</style>


<script>
  import { onMount, onDestroy } from 'svelte';
  import { Navbar, Sidebar, AssistantDeepChat, Login } from './components';
  import { BIDARA_CONFIG, BIDARA_INITIAL_MESSAGES } from './assistant/bidara';
  import { funcCalling } from './assistant/bidaraFunctions';
  import * as threadUtils from './utils/threadUtils';
  import { getKeyAsstAndThread } from './utils/openaiUtils';
  import { createBidaraDB, closeBidaraDB } from "./utils/bidaraDB";
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

  let loadedMessages = false;

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

    threads = await threadUtils.getThreads();
    loggedIn = true;
  }

  onMount(async () => {
    await createBidaraDB();
  });

  onDestroy(async () => {
    await closeBidaraDB();
  })

  async function newThreadAndSwitch() {
    // If the thread is already "new", stay on it
    if (activeThread && activeThread.length <= activeInitialMessages.length) {
     if (activeThread.name != "New Chat") {
       await threadUtils.setThreadName(activeThread.id, "New Chat");
     }
     return;
    } 

    // If an empty thead is already created, prevents creating a new one
    const emptyThread = await threadUtils.getEmptyThread();
    if (emptyThread) {
      await switchActiveThread(emptyThread);

      return;
    }

    const thread = await threadUtils.getNewThread();
    await switchActiveThread(thread);
    threads = await threadUtils.getThreads();
  }

  async function deleteThreadAndSwitch(thread) {

    await threadUtils.deleteThread(thread.id);
    threads = await threadUtils.getThreads();

    if (thread.id !== activeThread.id) {
      return;
    }

    if (threads && threads.length > 0) {
      const thread = await threadUtils.getRecentThread();
      await switchActiveThread(thread);

    } else {
      // temporary fix stops newThreadAndSwitch from not giving new thread on empty delete
      // this won't be written to storage
      activeThread.length = 1; 
      await newThreadAndSwitch();
    }
  }


  async function switchActiveThread(thread) {
    if (activeThread && thread.id === activeThread.id) {
      return;
    }

    loadedMessages = false;
    loading = true;

    await threadUtils.setActiveThread(thread.id);

    activeThread = await threadUtils.getActiveThread();
  }

  async function renameActiveThread(name) {
    await threadUtils.setThreadName(activeThread.id, name);

    threads = await threadUtils.getThreads();
    loadedMessages = false;
    activeThread = await threadUtils.getActiveThread();
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
            loginHandler={null}
            bind:loading
            bind:loadedMessages

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
    height: calc(100% - 3rem);
    padding-right: env(safe-area-inset-right);
    padding-left: env(safe-area-inset-left);
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


<script>
  import { onMount, onDestroy } from 'svelte';
  import { Navbar, Sidebar, AssistantDeepChat, Login } from './components';
  import { BIDARA } from "./assistant";
  import { getKeyAndThread, getNewAsst } from './utils/openaiUtils';
  import { createBidaraDB, closeBidaraDB } from "./utils/bidaraDB";
  import * as threadUtils from './utils/threadUtils';
  import hljs from "highlight.js";
  window.hljs = hljs;

  let activeKey = null;
  let activeThread = null;
  const defaultAsst = BIDARA;
  let activeAsst = defaultAsst;
  let threads = null;

  let loading = true;
  let loggedIn = false;
  let open = false;

  async function initKeyAsstAndThreads() {

    const keyAsstAndThread = await getKeyAndThread(defaultAsst);

    if (!keyAsstAndThread[0]) {
      return;
    }

    activeKey = keyAsstAndThread[0];
    activeThread = keyAsstAndThread[1];

    activeAsst = getAssistant(activeThread.asst.name);

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
    if (activeThread && activeThread.length <= 0) {
     if (activeThread.name != "New Chat") {
       await threadUtils.setThreadName(activeThread.id, "New Chat");
     }
     return;
    } 

    // If an empty thead is already created, prevents creating a new one
    const emptyThread = await threadUtils.getEmptyThread(activeAsst.initialMessages.length);
    if (emptyThread) {
      await switchActiveThread(emptyThread);

      return;
    }

    const thread = await threadUtils.getNewThread(activeThread.asst);
    threads = await threadUtils.getThreads();
    await switchActiveThread(thread);
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

    loading = true;

    await threadUtils.setActiveThread(thread.id);


    const asst = getAssistant(thread.asst.name);

    activeThread = await threadUtils.getActiveThread(asst);
    activeAsst = asst;
  }

  async function renameActiveThread(name) {
    await threadUtils.setThreadName(activeThread.id, name);

    threads = await threadUtils.getThreads();
    activeThread.name = name;
  }

  function getAssistant(asstName) {
    if (asstName === BIDARA.name) {
      return BIDARA;
    }
  }

  async function changeAssistants(newAsst) {

    const threadAsst = await getNewAsst(null, newAsst);

    const thread = await threadUtils.getNewThread(threadAsst);
    threads = await threadUtils.getThreads();

    await switchActiveThread(thread);
  }

  function onLoadComplete() {
    loading = false;
  }

</script>

<main class="flex">
  <div class="w-full h-full flex flex-col justify-between">
    {#await initKeyAsstAndThreads() then}
    {#if !loggedIn}
      <Login loginHandler={initKeyAsstAndThreads} />

    {:else}
      <Navbar 
        bind:chatName={activeThread.name} 
        bind:sidebar={open} 
        bind:currAsst={activeAsst}
        assistantOptions={[BIDARA]}
        handleRename={renameActiveThread} 
        changeAssistant={changeAssistants}
        />   

      <div id="content-container" class="flex justify-between w-full h-full flex-1" class:open>
        <div>
          <Sidebar handleChatSelect={switchActiveThread} handleChatDelete={deleteThreadAndSwitch} handleChatNew={newThreadAndSwitch} bind:threads bind:open bind:selectedThreadId={activeThread.id}/>
        </div>

        <div id="chat-container" class="w-full" class:loading>
          {#key activeThread.id}
          <AssistantDeepChat
            key={activeKey}
            asst={activeAsst}
            thread={activeThread}
            loginHandler={null}
            onLoadComplete={onLoadComplete}

            width="100%"
            height="100%"
            />
            {/key}
        </div>
      </div>
    {/if}
    {/await}
  </div>
</main>


<style>
  #content-container {
    height: calc(100% - 3rem);
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
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  .loading {
    filter: blur(2px);
    pointer-events: none;
  }
</style>


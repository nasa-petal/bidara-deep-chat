<script>
  import { onMount, onDestroy } from 'svelte';
  import { Navbar, Sidebar, AssistantDeepChat, Login } from './components';
  import { ASSISTANT_OPTIONS, DEFAULT_ASSISTANT } from "./assistant";
  import { getKeyAndThread, getNewAsst } from './utils/openaiUtils';
  import * as threadUtils from './utils/threadUtils';
  import hljs from "highlight.js";
  window.hljs = hljs;

  let activeKey = null;
  let activeThread = null;

  let activeAsst = DEFAULT_ASSISTANT;
  let threads = null;

  let loading = true;
  let loggedIn = false;
  let open = false;

  async function initKeyAsstAndThreads() {

    const keyAsstAndThread = await getKeyAndThread(DEFAULT_ASSISTANT);
    threads = await threadUtils.getThreads();

    if (!keyAsstAndThread[0]) {
      return;
    }

    activeKey = keyAsstAndThread[0];

    if (!keyAsstAndThread[1]) {
      if (threads.length > 0) {
        activeThread = await threadUtils.getRecentThread();
      } else {
        const newAsst = await getNewAsst(DEFAULT_ASSISTANT);
        activeThread = await threadUtils.getNewThread(newAsst);
      }

      await threadUtils.setActiveThread(null, activeThread.id)

    } else {
      activeThread = keyAsstAndThread[1];
    }

    activeAsst = getAssistant(activeThread.asst.name);

    loggedIn = true;
  }

  async function newThreadAndSwitch() {
    // If the thread is already "new", stay on it
    if (activeThread && activeThread.length <= 0) {
     if (activeThread.name != "New Chat") {
       await threadUtils.setThreadName(activeThread.id, "New Chat");
     }
     return;
    } 

    // If an empty thead is already created, prevents creating a new one
    const emptyThread = await threadUtils.getEmptyThread(activeAsst.history.length);
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

    activeThread.id = null;

    if (threads && threads.length > 0) {
      const recentThread = await threadUtils.getRecentThread();
      await switchActiveThread(recentThread);

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

    await threadUtils.setActiveThread(activeThread.id, thread.id);


    const asst = getAssistant(thread.asst.name);

    const newActiveThread = await threadUtils.getActiveThread(asst);

    if (!newActiveThread) {
      if (threads.length > 0) {
        threads = await threadUtils.getThreads();
        await threadUtils.setActiveThread(null, activeThread.id);
        loading = false;

      } else {
        await newThreadAndSwitch();
      }

      return;
    }

    if (newActiveThread.id !== thread.id) {
      await threadUtils.setActiveThread(null, newActiveThread.id);
      threads = await threadUtils.getThreads();
    }

    if (newActiveThread.id === activeThread.id) {
      loading = false;
      return;
    }

    activeThread = newActiveThread;
    activeAsst = asst;
  }

  async function renameActiveThread(name) {
    await threadUtils.setThreadName(activeThread.id, name);

    threads = await threadUtils.getThreads();
    activeThread.name = name;
  }

  function getAssistant(asstName) {
    return ASSISTANT_OPTIONS.find((opt) => opt.name === asstName);
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

<main class="flex w-full h-full">
  <div class="w-full h-full flex flex-col justify-between">
    {#await initKeyAsstAndThreads() then}
    {#if !loggedIn}
      <Login loginHandler={initKeyAsstAndThreads} />

    {:else}
      <Navbar 
        bind:chatName={activeThread.name} 
        bind:sidebar={open} 
        bind:currAsst={activeAsst}
        assistantOptions={ASSISTANT_OPTIONS}
        handleRename={renameActiveThread} 
        changeAssistant={changeAssistants}
        />   

      <div class="content-container flex justify-between w-full h-full" class:open>

        <div class="sidebar-container w-0 h-full">
          <Sidebar 
            bind:threads
            bind:open
            bind:selectedThreadId={activeThread.id}
            handleChatSelect={switchActiveThread}
            handleChatDelete={deleteThreadAndSwitch}
            handleChatNew={newThreadAndSwitch}
            />
        </div>

        {#key activeThread.id}
        <div class="chat-container w-full" class:loading>
          <AssistantDeepChat
            key={activeKey}
            asst={activeAsst}
            thread={activeThread}
            loginHandler={null}
            onLoadComplete={onLoadComplete}
            renameThread={renameActiveThread}

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
  main {
    font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    width: 100%;
    height: calc(100% + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
  }

  .content-container {
    height: calc(100% - 3rem);
    width: 100%;
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  .loading {
    filter: blur(2px);
    pointer-events: none;
  }

  .chat-container {
    transition: width 0.3s ease;
  }
  .sidebar-container {
    transition: width 0.3s ease;
  }

  .open > .sidebar-container {
    width: 300px;
  }

  .open > .chat-container {
    width: calc(100% - 300px);
  }

  @media only screen and (max-width: 700px) {
    .open > .sidebar-container {
      width: 0;
    }

    .open > .chat-container {
      width: 100%;
    }
  }
</style>


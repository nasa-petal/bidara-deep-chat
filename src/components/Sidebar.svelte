<script>
  import {onMount} from 'svelte';

  export let open = false
  export let threads = null;
  export let handleChatSelect = null;
  export let handleChatDelete = null
  export let handleChatNew = null;
  export let selectedThreadId = true;

  import Chat from './Chat.svelte'

  function isSmallScreen() {
    return window.innerWidth < 700;
  }

  onMount(() => {
    if (!isSmallScreen()) {
      open = true;
    }
  });

  async function handleButtonClick(event) {
    event.target.style.transition = 'background-color 0.2s ease color 0.2s ease';
    event.target.style.backgroundColor = 'rgb(209,209,214)';

    handleChatNew();

    setTimeout(() => {
      event.target.style.backgroundColor = 'rgb(242, 242, 247)';
    }, 200);

    if (isSmallScreen()) {
      open = false;
    }
  }

  async function handleChatClick(thread) {
    handleChatSelect(thread);

    if (isSmallScreen()) {
      open = false;
    }
  }

  async function handleChatSwipe(thread) {
    handleChatDelete(thread);
  }

</script>

  <aside class="absolute shadow-lg flex flex-col" class:open>
    <button tabindex="0" class="focus:outline-none new-thread rounded-full m-2 text-base font-sans p-2" disabled={!open} on:click={handleButtonClick}>New Thread</button>
    <nav class="w-full divide-y">
      {#if threads !== null}
        {#each threads as thread}
          <Chat handleSelect={() => handleChatClick(thread)} handleDelete={() => handleChatSwipe(thread)} selected={thread.id === selectedThreadId} bind:thread/>
        {/each}
      {/if}
    </nav>
  </aside>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

  aside {
    z-index: 20;
    width: 20%;
    height: calc(100% - 3em);
    left: -20%;
    background-color: rgb(229, 229, 234);
    border-right: 1px solid rgb(180, 180, 180);
    transition: left ease 0.3s, width ease 0.3s, visibility 0.3s 0s;
    overflow-y: auto;
    visibility: hidden;
  }

  button {
    transition: background-color 0.3s ease;
  }
	
  .open {
    left: 0;
    visibility: visible
  }

  .new-thread {
    line-height: 1em;
    background-color: white;
    border: 1px solid rgb(180, 180, 180);
    color: rgb(0, 122, 255);
    font-weight: bold;
  }

  @media only screen and (max-width: 1400px) {
    aside {
      width: 30%;
      left: -30%;
    }
  }

  @media only screen and (max-width: 1000px) {
    aside {
      width: 40%;
      left: -40%;
    }
  }

  @media only screen and (max-width: 700px) {
    aside {
      width: 100%;
      left: -100%;
      border-right: none;
    }
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-thumb {
    background-color: #d0d0d0;
    border-radius: 5px;
  }

  ::-webkit-scrollbar-track {
    background-color: #f2f2f2;
  }
</style>

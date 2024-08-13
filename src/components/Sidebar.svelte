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
    //console.log("screen size:", window.innerWidth)
    return window.innerWidth < 700;
  }

  onMount(() => {
    if (!isSmallScreen()) {
      open = true;
    }
  });

  async function handleButtonClick(event) {
    event.target.style.transition = 'background-color 0.2s ease color 0.2s ease';
    event.target.style.backgroundColor = 'var(--nav-color)';

    handleChatNew();

    setTimeout(() => {
      event.target.style.backgroundColor = 'var(--nav-off-color)';
      event.target.style.transition = 'none';
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

<aside class:open>
  <div class="side-container w-full h-full flex flex-col">
  <button tabindex="0" class="focus:outline-none new-thread rounded-full text-base font-sans p-2" disabled={!open} on:click={handleButtonClick}>New Thread</button>
  <nav class="w-full">
    <div class="w-full h-full">
      {#if threads !== null}
        {#each threads as thread}
          <Chat handleSelect={handleChatClick} handleDelete={handleChatSwipe} selected={thread.id === selectedThreadId} bind:thread/>
        {/each}
      {/if}
    </div>
  </nav>
  </div>
</aside>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

  nav {
    padding-bottom: calc(2 * env(safe-area-inset-bottom));
  }

  button {
    margin: 0.5em;
    margin-left: calc(0.5em + env(safe-area-inset-left));
  }

  .side-container {
    border-right: 1px solid var(--border-color);
  }

  aside {
    position: absolute;
    z-index: 20;
    width: calc(300px + env(safe-area-inset-left));
    height: calc(100dvh - 3em);
    background-color: var(--nav-color);
    transition: left 0.3s ease, visibility 0.3s ease, width 0.3s ease;
    left: calc(-300px - env(safe-area-inset-left));
  }

  button {
    transition: background-color 0.3s ease;
  }
	
  .open {
    visibility: visible;
    left: 0;
  }

  .new-thread {
    line-height: 1em;
    background-color: var(--nav-off-color);
    border: 1px solid var(--border-color);
    color: var(--text-important-color);
    font-weight: bold;
  }

  @media only screen and (max-width: 700px) {
    aside {
      width: 100%;
      left: -100%;
    }
    button {
      margin-left: env(safe-area-inset-left);
    }
    .side-container {
      border-right: none;
    }
    ::-webkit-scrollbar-track {
      background-color: var(--nav-color);
    }
  }
</style>

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

<div>
  <aside class="absolute flex flex-col" class:open>
    <button tabindex="0" class="focus:outline-none new-thread rounded-full m-2 text-base font-sans p-2" disabled={!open} on:click={handleButtonClick}>New Thread</button>
    <nav class="w-full">
      <div class="w-full h-full">
        {#if threads !== null}
          {#each threads as thread}
            <Chat handleSelect={handleChatClick} handleDelete={handleChatSwipe} selected={thread.id === selectedThreadId} bind:thread/>
          {/each}
        {/if}
      </div>
    </nav>
  </aside>
</div>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

  nav {
    padding-bottom: calc(2 * env(safe-area-inset-bottom));
  }

  aside {
    z-index: 20;
    width: 20%;
    height: calc(100% - 3em);
    left: -20%;
    background-color: var(--nav-color);
    border-right: 1px solid var(--border-color);
    transition: left ease 0.3s, width ease 0.3s, visibility 0.3s 0s;
    overflow-y: scroll;
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
    background-color: var(--nav-off-color);
    border: 1px solid var(--border-color);
    color: var(--text-important-color);
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
</style>

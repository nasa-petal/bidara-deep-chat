<script>
	export let open = false
  export let threads = null;
  export let handleChatSelect = null;
  export let handleChatDelete = null
  export let handleChatNew = null;

  import Chat from './Chat.svelte'

</script>

<sidebar class:open>
  <aside class="absolute full shadow-lg flex flex-col justify-between" class:open>
    <nav class="px-2 w-full">
      {#if threads !== null}
        {#each threads as thread}
          <Chat handleClick={handleChatSelect} handleDelete={handleChatDelete} bind:thread/>
        {/each}
      {/if}
    </nav>
    <button class="new-thread text-base font-sans bg-gray-400 p-2 focus:outline-none" on:click={handleChatNew}>New Thread</button>
  </aside>
</sidebar>

<style>
	sidebar {
    z-index: -1;
	}

  aside {
    width: 16.6%;
    height: calc(100dvh - 3em);
		left: -16.7%;
    transition: ease-out 0.3s;
    background-color: rgba(229, 229, 234);
    border-right: 1px solid rgb(209, 209, 214);
    padding: 0.22em;
  }
	
	.open {
    left: 0;
    z-index: 20;
	}

  .new-thread {
    line-height: 1em;
    border-radius: 1em;
    background-color: rgb(242, 242, 247);
    margin-bottom: 1em;
  }

  @media only screen and (max-width: 700px) {
    .open {
      z-index: 20;
      width: 100%;
    }
  }
</style>

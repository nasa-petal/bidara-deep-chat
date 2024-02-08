<script>
	export let open = false
  export let threads = null;
  export let handleChatSelect = null;
  export let handleChatDelete = null
  export let handleChatNew = null;

  import Chat from './Chat.svelte'

</script>

  <aside class="absolute full shadow-lg flex flex-col justify-between" class:open>
    <nav class="w-full">
      {#if threads !== null}
        {#each threads as thread}
          <Chat handleClick={handleChatSelect} handleDelete={handleChatDelete} bind:thread/>
        {/each}
      {/if}
    </nav>
    <button class="new-thread text-base font-sans bg-gray-400 p-2 focus:outline-none" on:click={handleChatNew}>New Thread</button>
  </aside>

<style>

  aside {
    z-index: 20;
    width: 20%;
    height: calc(100dvh - 3em);
    left: -20%;
    margin-top: -1px;
    transition: ease 0.3s;
    background-color: rgba(229, 229, 234);
    border-right: 1px solid rgb(209, 209, 214);
  }
	
  .open {
    left: 0;
  }

  .new-thread {
    line-height: 1em;
    border-radius: 1em;
    background-color: rgb(242, 242, 247);
    margin-bottom: 1em;
  }

  @media only screen and (max-width: 1000px) {
    .open {
      width: 30%;
    }
  }

  @media only screen and (max-width: 900px) {
    .open {
      width: 40%;
    }
  }

  @media only screen and (max-width: 700px) {
    .open {
      width: 100%;
    }
  }
</style>

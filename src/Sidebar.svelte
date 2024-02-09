<script>
	export let open = false
  export let threads = null;
  export let handleChatSelect = null;
  export let handleChatDelete = null
  export let handleChatNew = null;
  export let selectedThreadId = true;

  import Chat from './Chat.svelte'

  async function handleButtonClick(event) {
    event.target.style.transition = 'background-color 0.2s ease color 0.2s ease';
    event.target.style.backgroundColor = 'rgb(209,209,214)';

    handleChatNew();

    setTimeout(() => {
      event.target.style.backgroundColor = 'rgb(242, 242, 247)';
    }, 200);
  }

  console.log("end script");
</script>

  <aside class="absolute full shadow-lg flex flex-col justify-between" class:open>
    <nav class="w-full">
      {#if threads !== null}
        {#each threads as thread}
          <Chat handleClick={handleChatSelect} handleDelete={handleChatDelete} bind:thread selected={thread.id === selectedThreadId}/>
        {/each}
      {/if}
    </nav>
    <button class="new-thread mx-2 text-base font-sans p-2 focus:outline-none" on:click={handleButtonClick}>New Thread</button>
  </aside>

<style>

  aside {
    z-index: 20;
    width: 20%;
    height: calc(100dvh - 3.1em);
    left: -20%;
    transition: ease 0.3s;
    transition: background-color 0.3s ease;
    background-color: rgb(229, 229, 234);
    border-right: 1px solid rgb(199, 199, 204);
  }


  button {
    transition: background-color 0.3s ease;
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
    aside {
      border-right: none;
    }
  }
</style>

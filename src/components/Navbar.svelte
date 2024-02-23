<script>
    import Logo from './Logo.svelte'
    import Hamburger from './Hamburger.svelte'
	
    export let sidebar = false
    export let chat_name;
    export let handleRename;
    
    let editing_name = false;
    let editing_input;

    if (!chat_name) {
      chat_name = "";
    }

    function handleButtonClick() {
      editing_name = true;
    }

    function handleInputLeave() {
      editing_name = false;
    }

    async function handleInputKeyDown(event) {
      if (event.key === 'Enter') {
        const new_chat_name = event.target.value;

        if (new_chat_name) {
          chat_name = new_chat_name;
          await handleRename(chat_name);
        }

        editing_name = false;
      } else if (event.key === 'Escape') { 
        editing_input.blur()

      } else if (event.key === ' '){
        event.preventDefault();
        document.execCommand('insertText', false, ' ');
      }

    }

    $: {
      if (editing_name && editing_input) {
        editing_input.focus();
      }
    }
</script>

<header class="flex py-2 justify-between items-center text-gray-600">
  <nav class="flex mx-2">
    <Hamburger bind:open={sidebar}/>
  </nav>

  {#if editing_name}
    <input type="text" bind:this={editing_input} class="px-3 py-1 rounded-full" on:blur={handleInputLeave} on:keydown={handleInputKeyDown}/>
  {:else}
    <button tabindex="0" class="focus:no-outline px-3 py-1 rounded-full" on:click={handleButtonClick}>{chat_name}</button>
  {/if}
  <Logo/>	
</header>

<style>
  header {
    background-color: rgb(229, 229, 234);
    z-index: 10;
    border-bottom: 1px solid rgb(180, 180, 180);
    height: 3rem;
  }
  button {
    width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: rgb(229, 229, 234);
  }

</style>

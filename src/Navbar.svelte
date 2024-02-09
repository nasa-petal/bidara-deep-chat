<script>
    import Logo from './Logo.svelte'
    import Hamburger from './Hamburger.svelte'
	
    export let sidebar = false
    export let chat_name;
    export let handleRename;
    
    let editing_name = false;
    let editing_button;

    function handleButtonClick() {
      editing_name = true;
    }

    function handleButtonLeave() {
      editing_name = false;
    }

    async function handleButtonKeyDown(event) {
      if (event.key === 'Enter') {
        const new_chat_name = event.target.textContent;

        if (new_chat_name) {
          chat_name = new_chat_name;
          await handleRename(chat_name);
        }

        editing_name = false;

      } else if (event.key === ' '){
        event.preventDefault();
        document.execCommand('insertText', false, ' ');
      }

    }

    $: {
      if (editing_name && editing_button) {
        editing_button.focus();
      }
    }

</script>

<header class="flex justify-between p-2 items-center text-gray-600">
  <nav class="flex">
    <Hamburger bind:open={sidebar}/>
  </nav>

  {#if editing_name}
    <button bind:this={editing_button} class="focus:no-outline" on:blur={handleButtonLeave} on:keydown={handleButtonKeyDown} contenteditable></button>
  {:else}
    <button class="focus:no-outline" on:click={handleButtonClick}>{chat_name}</button>
  {/if}
  <Logo/>	
</header>

<style>
  header {
    z-index: 10;
    border-bottom: 1px solid rgb(229, 229, 234);
    padding: 0.5em;
  }

</style>

<script>
    import Hamburger from './Hamburger.svelte'
    import Menu from './Menu.svelte';
    import MenuItem from './MenuItem.svelte';
    import ThemeSwitcher from './ThemeSwitcher.svelte';
    import ExportMarkdown from './ExportMarkdown.svelte';
    import ExportPdf from './ExportPdf.svelte';
	
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
  <Menu>
    <div class="function-container">
      <MenuItem><ExportPdf bind:chatName={chat_name}/></MenuItem>
      <MenuItem><ExportMarkdown bind:chatName={chat_name}/></MenuItem>
      <MenuItem><ThemeSwitcher/></MenuItem>
    </div>
    <div class="info-container">
      <MenuItem><a class="w-full h-full p-1" tabindex="0" href="https://forms.gle/xDEixG5UJrFBwDKv5" target="_blank" rel="noopener">Send Feedback</a></MenuItem>
      <MenuItem><a class="w-full h-full p-1" tabindex="0" href="https://www1.grc.nasa.gov/research-and-engineering/vine/petal/" target="_blank" rel="noopener">Vist PeTaL</a></MenuItem>
    </div>
  </Menu>
</header>

<style>
  .function-container {
    border-bottom: 1px solid var(--light-border-color);
  }

  header {
    background-color: var(--nav-color);
    z-index: 30;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary-color);
    width: 100%;
    height: 10em;
    margin-top: -7em;
    padding: 7.5em env(safe-area-inset-right) 0.5em env(safe-area-inset-left);
  }
  button {
    width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: var(--nav-color);
    color: var(--text-primary-color);
  }
  input {
    background-color: var(--nav-off-color);
  }
</style>

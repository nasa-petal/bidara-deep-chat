<script>
    import Hamburger from './Hamburger.svelte'
    import NavMenu from './NavMenu.svelte';
    import AssistantSelectModal from './AssistantSelectModal.svelte'
	
    export let sidebar = false
    export let chatName;
    export let handleRename;
    export let changeAssistant;
    export let currAsst;
    export let assistantOptions;
    
    let editingName = false;
    let editingInput;
    let navMenuOpen = false;

    let assistantModalOpen = false;

    if (!chatName) {
      chatName = "";
    }

    function handleButtonClick() {
      editingName = true;
    }

    function handleInputLeave() {
      editingName = false;
    }

    async function handleInputKeyDown(event) {
      if (event.key === 'Enter') {
        const new_chat_name = event.target.value;

        if (new_chat_name) {
          chatName = new_chat_name;
          await handleRename(chatName);
        }

        editingName = false;
      } else if (event.key === 'Escape') { 
        editingInput.blur()

      } else if (event.key === ' '){
        event.preventDefault();
        document.execCommand('insertText', false, ' ');
      }

    }

    $: {
      if (editingName && editingInput) {
        editingInput.focus();
      }
    }

    function handleModalOpen(modalId) {
      navMenuOpen = false;
      assistantModalOpen = true;
    }

    function handleModalClose(modalId) {
      assistantModalOpen = false;
    }

    async function handleAssistantChange(asst) {
      await changeAssistant(asst);
      currAsst = asst;
    }
</script>

<header class="flex py-2 justify-between items-center text-gray-600">
  <nav class="sidebar-toggle flex">
    <Hamburger bind:open={sidebar}/>
  </nav>

  {#if editingName}
    <input type="text" bind:this={editingInput} class="px-3 py-1 rounded-full" on:blur={handleInputLeave} on:keydown={handleInputKeyDown}/>
  {:else}
    <button tabindex="0" class="focus:no-outline px-3 py-1 rounded-full" on:click={handleButtonClick}>{chatName}</button>
  {/if}
  <div class="menu-toggle">
    <NavMenu bind:chatName={chatName} bind:open={navMenuOpen} handleModalOpen={handleModalOpen}/>
  </div>

</header>

<AssistantSelectModal bind:open={assistantModalOpen} handleClose={handleModalClose} handleAssistantChange={handleAssistantChange} bind:currAsst options={assistantOptions} />

<style>
  header {
    background-color: var(--nav-color);
    z-index: 30;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary-color);
    width: 100%;
    height: 10em;
    margin-top: -7em;
    padding: 7.5em 0.75em 0.5em 0.75em;
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

  .sidebar-toggle {
    margin-left: env(safe-area-inset-left);
  }

  .menu-toggle {
    margin-right: env(safe-area-inset-left);
  }

</style>

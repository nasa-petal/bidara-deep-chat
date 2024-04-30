<script>
    import Menu from './Menu.svelte';
    import MenuItem from './MenuItem.svelte';
    import ThemeSwitcher from './ThemeSwitcher.svelte';
    import ExportMarkdown from './ExportMarkdown.svelte';
    import ExportPdf from './ExportPdf.svelte';
    import AssistantSwitcher from './AssistantSwitcher.svelte';

		export let chatName;
		export let handleModalOpen;
		export let open;

		function handleAssistantChange() {
			handleModalOpen("assistant-select");
		}

</script>

<Menu bind:open>
	<div class="function-container">
		<MenuItem><AssistantSwitcher openAssistantSelectMenu={handleAssistantChange}/></MenuItem>
		<MenuItem><ExportPdf bind:chatName={chatName}/></MenuItem>
		<MenuItem><ExportMarkdown bind:chatName={chatName}/></MenuItem>
		<MenuItem><ThemeSwitcher/></MenuItem>
	</div>
	<div class="info-container">
		<MenuItem><a class="w-full h-full p-1" tabindex="0" href="https://forms.gle/xDEixG5UJrFBwDKv5" target="_blank" rel="noopener">Send Feedback</a></MenuItem>
		<MenuItem><a class="w-full h-full p-1" tabindex="0" href="https://www1.grc.nasa.gov/research-and-engineering/vine/petal/" target="_blank" rel="noopener">Visit PeTaL</a></MenuItem>
	</div>
</Menu>

<style>
  .function-container {
    border-bottom: 1px solid var(--light-border-color);
  }

  a {
    color: white !important;
  }
  a:visited {
    color: white !important;
  }
</style>

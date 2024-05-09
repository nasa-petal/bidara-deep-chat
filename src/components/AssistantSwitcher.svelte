<script>
	export let openAssistantSelectMenu;

	async function handleClick() {
		openAssistantSelectMenu();
	}
</script>

<button class="w-full h-full p-1 flex justify-between items-center focus:outline-none" on:click={handleClick}>
	<p>View Assistants</p>
</button>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

</style>

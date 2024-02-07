<script>
	export let open = false;
	export let thread;
	export let handleClick = null;
	export let handleDelete = null;

</script>

<div class="flex">
	<button class="flex justify-between py-2 text-base font-sans block w-full focus:outline-none" class:open on:click={() => handleClick(thread)}>{thread.name} </button>
	<button class="trash text-base font-sans bg-gray-400 p-2" on:click={() => handleDelete(thread)}>Delete</button>
</div>

<style>
	button {
    border-bottom: 1px solid rgb(209, 209, 214);
	}

  .trash {
    line-height: 1em;
    border-radius: 1em;
    background-color: rgb(242, 242, 247);
  }

</style>

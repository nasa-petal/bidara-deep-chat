<script>
	import BackdropClose from "./BackdropClose.svelte";
	export let open = false;
	let blur = false;

	function handleClose(event) {
		event.preventDefault();
		open = false;
	}
</script>

<div class="container">
	<button tabindex="0" class="focus:outline-none menu-button w-full h-full" class:open on:click={() => {open = !open;}}>
		<img class="menu-image m-auto" src="ellipsis-vertical-blue.svg" alt="menu"/>
	</button>
	<div class="menu-container bg-gray-600 focus:no-outline" class:open>
		<menu class="p-1"><slot /></menu>
	</div>
	<BackdropClose bind:blur bind:open handleClick={handleClose}/>
</div>

<style>
	button {
		padding: 3px;
	}

	button:focus-visible {
		outline: 5px auto -webkit-focus-ring-color;
	}

	.container {
		width: 2em;
		height: 2em;

		z-index: 35;
	}

	.menu-button:hover {
		cursor: pointer;
	}

	.menu-image {
		width: 15px;
		height: 15px;
	}

	.menu-container {
		border: 0.5px solid black;
		border-radius: 0.5em;
		color: white;
		width: 15em;
		box-shadow: 0 0 1rem 0 var(--box-shadow-color);

		position: absolute;
		right: calc(1% + env(safe-area-inset-left));
		visibility: hidden;
		overflow: hidden;

		z-index: 39;
	}

	menu {
		border: 1px solid var(--gray);
		border-radius: 0.5em;
		margin: 0;
	}

	.open {
		visibility: visible;
	}
</style>

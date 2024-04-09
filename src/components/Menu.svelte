<script>
	let openMenu = false;

	function handleClose(event) {
		event.preventDefault();
		openMenu = false;
	}
</script>

<div class="container p-2">
		<button tabindex="0" class="focus:outline-none menu-button" class:open on:click={() => {openMenu = !openMenu;}}>
			<img class="menu-image" src="ellipsis-vertical-blue.svg" alt="menu"/>
    </button>
		<div class="menu-container bg-gray-600 focus:no-outline" class:openMenu>
			<menu class="p-1"><slot /></menu>
		</div>
		<button tabindex="0" class="clickoff w-full h-full" class:openMenu on:click={handleClose}>
		</button>
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
		display: none;
		visibility: hidden;
		right: 1%;
		overflow: hidden;

		z-index: 39;
	}

	.clickoff {
		outline: none !important;
		background-color: transparent !important;
		display: none;
		visibility: hidden;
		position: fixed;
		left: 0;
		top: 0;

		z-index: 38;
	}

	menu {
		border: 1px solid var(--gray);
		border-radius: 0.5em;
		margin: 0;
	}

	.openMenu {
		display: block;
		visibility: visible;
	}
</style>

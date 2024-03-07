<script>
	let openMenu = false;
</script>

<div class="container p-2">
	<button tabindex="0" class="focus:outline-none menu-button" class:open on:click={() => {console.log("clicked menu"); openMenu = !openMenu;}} on:blur={() => setTimeout(() => openMenu = false, 100)}>
			<img class="menu-image" src="ellipsis-vertical-blue.svg" alt="menu"/>
    </button>
		<div class="menu-container bg-gray-700 backdrop-blur-sm" class:openMenu>
			<menu class="p-1"><slot /></menu>
		</div>
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
		width: 15em;
		position: absolute;
		display: none;
		color: white;
		visibility: hidden;
		right: 1%;
		overflow: hidden;

	}

	menu {
		border: 1px solid rgb(142, 142, 147);
		border-radius: 0.5em;
		margin: 0;
	}

	.openMenu {
		display: block;
		visibility: visible;
	}
</style>

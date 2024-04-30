<script>
	export let open;
	export let blur;
	export let handleClick
</script>

<button tabindex="0" class="clickoff w-full h-full" class:blur class:open on:click={handleClick}>
</button>

<style>
	.clickoff {
		outline: none !important;
		background-color: transparent !important;
		cursor: default;
		visibility: hidden;
		position: fixed;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;

		transition: backdrop-filter ease 0.3s, -webkit-backdrop-filter ease 0.3s !important;

		z-index: 30;
	}

	.blur {
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
	}

	.open {
		visibility: visible;
	}
</style>


<li>
	<div class="item-container flex items-center justify-left w-full h-full px-2">
		<slot />
	</div>
</li>

<style>
	li {
		display: block;
	}
	.item-container { 
		position: relative;
		display: flex;
		font-size: 0.75em;
		height: 2.5em;
		border-radius: 0.5em;
	}

	.item-container:hover,
	.item-container:focus {
		background-color: var(--blue);
		cursor: pointer;
	}
</style>


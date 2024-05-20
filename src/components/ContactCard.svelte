<script>
	export let tagline;
	export let description;
	export let model;
	export let builtInFunctions;
	export let customFunctions;

	$: {
		tagline;
		descriptionExpanded = false;
		builtInExpanded = false;
		customExpanded = false;
	}

	let descriptionExpanded = false;
	let builtInExpanded = false;
	let customExpanded = false;

	function expandDescription() {
		descriptionExpanded = !descriptionExpanded;
	}

	function expandBuiltIn() {
		builtInExpanded = !builtInExpanded;
	}

	function expandCustom() {
		customExpanded = !customExpanded;
	}

</script>

<div>
	<!-- Tagline -->
	<div class="field my-2 py-1 px-2">
		<h2>Tagline</h2>
		<p>{tagline}</p>
	</div>
	<!-- Description -->
	<button class="field expandable focus:outline-none my-2" type="button" on:click={expandDescription} class:descriptionExpanded>
		<h2>Description</h2>
		<p>{description}</p>
		<img class="expand-image mx-auto" src="chevron-right-blue.svg" alt="close"/>
	</button>
	<!-- Model -->
	<div class="field my-2">
		<h2>Model</h2>
		<p>{model}</p>
	</div>
	<!-- Built-In Functions -->
	<button class="field expandable focus:outline-none my-2" type="button" on:click={expandBuiltIn} class:builtInExpanded>
		<h2>Built-In Functions</h2>
		<ul>
		{#each builtInFunctions as func}
			<li>{func.type}</li>
		{/each}
		</ul>
		<img class="expand-image mx-auto" src="chevron-right-blue.svg" alt="close"/>
	</button>
	<!-- Custom Functions -->
	<button class="field expandable focus:outline-none my-2" type="button" on:click={expandCustom} class:customExpanded>
		<h2>Custom Functions</h2>
		<ul>
			{#each customFunctions as func}
				<li>{func.function.name}</li>
			{/each}
		</ul>
		<img class="expand-image mx-auto" src="chevron-right-blue.svg" alt="close"/>
	</button>
</div>

<style>
	button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

	.field {
		border-radius: 0.5em;
		background-color: var(--nav-color);
		min-height: 4em;
		max-height: 8em;
		width: 100%;
		padding: 0.75em 1em 0.75em 1em;

		text-align: start;
	}

	.field h2 {
		font-size: 1em;
	}

	.field p {
		font-size: 0.75em;
		height: 90%;
		margin: 0.5em 0 0.5em 0;
	}

	li {
		font-size: 0.75em;
		text-overflow: ellipsis;
		margin-left: 2em;
		list-style-type: circle;
	}

	.expandable {
		max-height: 9em;
	}
	.expandable h2 {
		color: var(--text-important-color);
	}

	.expandable p,
	.expandable ul {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.expandable p {
		-webkit-line-clamp: 4;
	}
	.expandable ul {
		-webkit-line-clamp: 3;
	}

	.descriptionExpanded,
	.builtInExpanded,
	.customExpanded
	{
		max-height: 100%;
	}

	.expand-image {
		width: 15px;
		height: 15px;

		transform: rotate(90deg);
	}

	.descriptionExpanded .expand-image,
	.builtInExpanded .expand-image,
	.customExpanded .expand-image
	{
		transform: rotate(-90deg);
	}

	.descriptionExpanded p,
	.builtInExpanded ul,
	.customExpanded ul
	{
		display: block;
	}
</style>

<script>
</script>

<div class="centeredModal w-full h-full p-4 md:p-8">
	<slot/>
</div>

<style>
	.centeredModal {
		background-color: var(--nav-color);
		border: 1px solid var(--border-color);
		box-shadow: 0 0 1rem 0 var(--box-shadow-color);
		color: var(--text-primary-color);

		border-radius: 1em;
	}
</style>

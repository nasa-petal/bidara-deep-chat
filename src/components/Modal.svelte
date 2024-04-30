<script>
</script>

<div class="centeredModal">
	<slot/>
</div>

<style>
	.centeredModal {
		background-color: var(--nav-color);
		border: 1px solid var(--border-color);
		box-shadow: 0 0 1rem 0 var(--box-shadow-color);
		color: var(--text-primary-color);
		width: 100%;
		height: 100%;

		border-radius: 1em;
		padding: 2em;
	}
</style>

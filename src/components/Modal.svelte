<script>
</script>

<div class="modal w-full h-full p-4 md:p-8">
	<slot/>
</div>

<style>
	.modal {
		background-color: var(--chat-background-color);
		border: 1px solid var(--border-color);
		box-shadow: 0 0 1rem 0 var(--box-shadow-color);
		color: var(--text-primary-color);

		border-radius: 1em;
	}

  @media only screen and (max-width: 768px) {
    .modal {
			border-radius: 0;
			border: none;
			box-shadow: none;
    }
  }
</style>

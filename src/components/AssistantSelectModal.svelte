<script>
	import Modal from "./Modal.svelte";
	import BackdropClose from "./BackdropClose.svelte"
	import * as bidara from "../assistant/bidara"
	import * as knowah from "../assistant/knowah"

	export let open;
	export let handleClose;

	let selected;
	let submitButton;
	let selectField;

	let options = [
		{
			name: bidara.NAME,
			option: `${bidara.NAME}: ${bidara.TAGLINE}`,
			description: bidara.TEXT_DESCRIPTION,
			logo: bidara.LOGO
		}, 
		{
			name: knowah.NAME,
			option: `${knowah.NAME}: ${knowah.TAGLINE}`,
			description: knowah.TEXT_DESCRIPTION,
			logo: knowah.LOGO
		}, 
	]

	function closeAssistantSelect() {
		handleClose("assistant-select")
	}

	function handleAssistantSelect() {
		console.log("selected: ", selected);
	}

</script>

<div class="select-container flex w-full h-full" class:open>
	<div class="modal" class:openModal={open}>
		<Modal>
			<form on:submit|preventDefault={handleAssistantSelect} class="w-full h-full flex flex-col p-0">
				<select bind:this={selectField} bind:value={selected} on:selectstart={()=>selectField.blur()} class="w-full h-10 mx-auto p-2">
					{#each options as asst}
						<option value={asst.name}>
						{asst.option}
						</option>
					{/each}
				</select>

				{#each options as asst}
					{#if asst.name === selected}
						<div class="my-auto">
							<p>{asst.description}</p>
						</div>
					{/if}
				{/each}

				<button bind:this={submitButton} class="submit w-full h-10 mx-auto focus:outline-none" type="submit"><strong>Select</strong></button>
			</form>
		</Modal>
	</div>
	<BackdropClose bind:blur={open} bind:open handleClick={closeAssistantSelect}/>
</div>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

	button:active {
		background-color: var(--nav-color);
	}

	button {
		color: var(--text-important-color);
	}

	select {
		background-color: transparent;
		border-radius: 2em;
		cursor: pointer;
		text-overflow: ellipsis;
	}

	option {
		text-align: center;
		text-overflow: ellipsis;
		width: 50%;
	}

	.submit {
		background-color: var(--chat-background-color);
		border: 1px solid var(--border-color);
		border-radius: 2em;
	}

	.select-container {
		position: fixed;
		top: 0;
		left: 0;

		visibility: hidden;

		z-index: 1000;
	}

	.modal {
		opacity: 0;
		transition: opacity ease 0.3s, width ease 0.3s, height ease 0.3s;
		display: block;
		width: 50%;
		height: 40%;
		margin: auto;
		z-index: 100;
	}

	.openModal {
		opacity: 1;
	}

	.open {
		visibility: visible;
	}

  @media only screen and (max-width: 1400px) {
    .modal {
      width: 60%;
			height: calc(50% - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
  }

  @media only screen and (max-width: 1000px) {
    .modal {
      width: 80%;
			height: calc(65% - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
  }

  @media only screen and (max-width: 700px) {
    .modal {
      width: 80%;
			height: calc(90% - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
  }
</style>

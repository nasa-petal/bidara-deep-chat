<script>
	import Modal from "./Modal.svelte";
	import BackdropClose from "./BackdropClose.svelte"
	import * as bidara from "../assistant/bidara"
	import * as knowah from "../assistant/knowah"

	export let open;
	export let handleClose;

	let options = [
		{
			name: bidara.NAME,
			tagline: bidara.TAGLINE,
			description: bidara.TEXT_DESCRIPTION,
			logo: bidara.LOGO
		}, 
		{
			name: knowah.NAME,
			tagline: knowah.TAGLINE,
			description: knowah.TEXT_DESCRIPTION,
			logo: knowah.LOGO
		}
	]

	let selected = options[0].name;
	let prevSelected;

	function closeAssistantSelect() {
		handleClose("assistant-select")
	}

	function handleAssistantSelect() {
		console.log("selected: ", selected);
	}

	function onChangeSelect(e) {
		selected = e.currentTarget.value;
	}

	// close modal with escape
	document.addEventListener("keydown", (e) => { if (open && e.key === "Escape") { closeAssistantSelect() }  });
</script>

<div class="select-container flex w-full h-full" class:open>
	<div id="assistant-modal" class="modal" class:openModal={open}>
		<Modal>
			<div class="w-full h-full flex flex-col">
				<div id="options" class="options h-full flex flex-col">
					{#each options as asst}
						<label id={`option-${asst.name}`} class="option mb-4 flex flex-col w-full h-12 md:h-18 p-2 px-4" class:selected={asst.name === selected}>
							<div class="mb-4 mx-auto">
								<input class="opacity-0 w-0 p-0 m-0 h-0" type="radio" name="assistant" id={asst.name} value={asst.name} on:change={onChangeSelect} checked={asst.name === selected}/>
								<label class="mx-auto md:mx-0" for={asst.name}><strong>{asst.name}</strong></label>
							</div>

							<div>
								<h1 class="mb-2 mx-auto">{asst.tagline}</h1>
								<p>{asst.description}</p>
							</div>
						</label>
					{/each}
				</div>

				<button class="submit w-fit h-10 px-16 mx-auto focus:outline-none" on:click={handleAssistantSelect}><strong>Confirm</strong></button>
			<div>
		</Modal>
	</div>
	<BackdropClose bind:blur={open} bind:open handleClick={closeAssistantSelect}/>
</div>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

	button:active {
		background-color: var(--translucent-nav-color);
	}

	button {
		color: var(--text-important-color);
	}

	.option {
		background-color: var(--translucent-nav-color);
		border: 1px solid var(--border-color);
		border-radius: 1em;
		transition: height ease 0.7s, background-color ease 0.7s;

		overflow: hidden;
	}

	.submit {
		background-color: var(--chat-background-color);
		border: 1px solid var(--border-color);
		border-radius: 0.75em;
	}

	.select-container {
		position: fixed;
		top: 0;
		left: 0;

		visibility: hidden;

		z-index: 1000;
	}

	.selected {
		height: 100%;
	}

	.modal {
		opacity: 0;
		transition: opacity ease 0.3s, width ease 0.3s, height ease 0.3s;
		display: block;
		width: 900px;
		height: 600px;
		margin: auto;
		z-index: 100;
	}

	.openModal {
		opacity: 1;
	}

	.open {
		visibility: visible;
	}

  @media only screen and (max-width: 1000px) {
    .modal {
      width: 700px;
			height: 700px;
    }
  }

  @media only screen and (max-width: 768px) {
    .modal {
      width: 80%;
			height: calc(90% - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    }
  }

	.options::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.options::-webkit-scrollbar-thumb {
		background-color: var(--border-off-color);
		border-radius: 5px;
	}

	.options::-webkit-scrollbar-track {
		background-color: var(--nav-color);
	}
</style>

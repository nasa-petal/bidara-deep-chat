<script>
	import Modal from "./Modal.svelte";
	import BackdropClose from "./BackdropClose.svelte"
	import ContactCard from "./ContactCard.svelte";
	import Hamburger from "./Hamburger.svelte";

	export let open;
	export let handleClose;
	export let handleAssistantChange;
	export let currAsst;
	export let options;


	let selectedDetails = currAsst;
	let selected = currAsst.name;


	function closeAssistantSelect() {
		handleClose("assistant-select")
	}

	async function handleAssistantSelect() {
		closeAssistantSelect();

		if (selected !== currAsst.name) {
			await handleAssistantChange(selectedDetails);
		}
	}

	function onChangeSelect(e) {
		selected = e.currentTarget.value;
		selectedDetails = options.find((opt) => opt.name === selected);
	}

	// close modal with escape
	document.addEventListener("keydown", (e) => { if (open && e.key === "Escape") { closeAssistantSelect() }  });
</script>

<div class="select-container flex w-full h-full" class:open>
	<div id="assistant-modal" class="modal m-auto" class:open>
		<Modal>
			<div class="buttons flex justify-between">
				<button tabindex="0" class="close-button focus:outline-none" on:click={closeAssistantSelect}>
					<img class="close-image" src="chevron-right-blue.svg" alt="close"/>
				</button>
				<button tabindex="0" class="compose-button focus:outline-none" on:click={handleAssistantSelect}>
					<img class="compose-image" src="compose-blue.svg" alt="close"/>
				</button>
			</div>

			<form on:submit|preventDefault={handleAssistantSelect} class="w-full h-full flex flex-col focus:outline-none">
				<div>
					{#key selected}
					{#if selectedDetails.logo !== ""}
						<img class="contact-img w-20 h-20 mx-auto p-0" src={selectedDetails.logo} alt="" />
					{:else}
						<div class="backup-img w-20 h-20 flex justify-center items-center mx-auto">
							<p class="w-fit h-fit">{selectedDetails.name[0]}</p>
						</div>
					{/if}
					{/key}
					<div>

						<div class="flex justify-center items-center">
							<select bind:value={selected} class="selecter my-3 text-center w-fit focus:outline-none" on:change={onChangeSelect}>
								{#each options as asst}
									<option class="option focus:outline-none" value={asst.name}>
									{asst.name}
									</option>
								{/each}
							</select>
							<img class="dropdown-image ml-2 mr-0" src="chevron-right-blue.svg" alt="close"/>
						</div>

						<ContactCard 
						      bind:tagline={selectedDetails.tagline}
						      bind:description={selectedDetails.description}
						      bind:model={selectedDetails.model}
						      bind:builtInFunctions={selectedDetails.builtInFunctions}
						      bind:customFunctions={selectedDetails.customFunctions} />
			</form>
		</Modal>
	</div>
	<BackdropClose bind:blur={open} bind:open handleClick={closeAssistantSelect}/>
</div>

<style>
	button:focus-visible,
	select:focus-visible {
		outline: 5px auto -webkit-focus-ring-color; 
	}

	form {
		overflow-y: scroll;
	}

	.backup-img {
		border-radius: 50%;
		background-color: var(--nav-color);
		font-size: 2em;
	}

	.contact-img {
		border-radius: 50%;
	}

	.selecter {
		background-color: transparent;
		color: var(--text-important-color);
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}

	.option {
		color: var(--text-important-color);
		cursor: pointer;
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
		transition: opacity ease 0.3s, width ease 0.3s, height ease 0.3s, left ease 0.3s, visibility 0.3s 0s;
		display: block;
		width: 900px;
		height: 700px;
		z-index: 100;
	}

	.open {
		opacity: 1;
		visibility: visible;
	}

	.close-image {
		width: 15px;
		height: 15px;
		transform: rotate(180deg);
	}
	
	.compose-image {
		width: 15px;
		height: 15px;
	}

	.dropdown-image {
		width: 10px;
		height: 10px;
		transform: rotate(90deg);
	}

	@media only screen and (max-width: 1000px) {
		.modal {
			width: 700px;
			height: 700px;
		}
	}

	@media only screen and (max-width: 768px) {
		.modal {
			width: 100%;
			height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom));

			position: fixed;
			opacity: 1;
			left: 100%;
			top: env(safe-area-inset-top);
		}

		.close-image {
			transform: none;
		}

		.open {
			opacity: 1;
			left: 0;
		}
	}
</style>

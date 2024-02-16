<script>
    export let handleClickRevealed;
    export let handleClick;

    export let selected = false;

		export let revealedButtonFocusImage;
		export let revealedButtonUnfocusImage;
		export let revealedButtonFocusBgColor;
		export let revealedButtonUnfocusBgColor;
		export let buttonBgColor;
		export let buttonText;

</script>
<div class="button-reveal-container">
	<div 
			class="button-box flex justify-between items-center py-0" 
			class:selected
			style="background-color: {buttonBgColor};"
			on:click={handleClick}
			>

			<p class="button-text my-0 font-sans block focus:outline-none" >{buttonText}</p>
			<a class="revealed-button" on:click={handleClickRevealed}>
				<img class="revealed-image unfocused" src={revealedButtonUnfocusImage}  alt="revealed unfocused select"/>
					<img class="revealed-image focused" src={revealedButtonFocusImage}  alt="revealed focused select"/>
			</a>
	</div>
</div>

<style>
    .button-reveal-container {
				width: 100%;
				height: 100%;
				transition: background-color 0.3s ease;
    }

    .button-box {
				padding: 1em;
        width: 100%;
        height: 100%;
        border-bottom: 1px solid rgb(199, 199, 204);
    }

    .button-text {
        font-size: 1em;
        overflow: hidden;
        margin-right: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }

    .selected {
        transition: background-color 0.3s ease;
        background-color: rgb(0, 122, 255) !important;
        color: rgb(242, 242, 247) !important;
    }

    .unfocused {
        opacity: 100%;
        display: block;
        transition: opacity 0.5s ease display ease 0.5s;
    }

    .focused {
        opacity: 0%;
        display: none;
        transition: opacity 0.5s ease display ease 0.5s;
    }

    .revealed-image {
        width: 1em;
        height: 1em;
    }

    .revealed-button {
        border-radius: 2em;
				padding: 0.5em;
        background-color: white;
        transition: background-color 0.3s ease;
    }

    .revealed-button:hover .unfocused{
        opacity: 0%;
        display: none;
    }

    .revealed-button:hover .focused{
        opacity: 100%;
        display: block;
    }

    .revealed-button:hover {
        cursor: pointer;
        background-color: rgb(255, 59, 48)
    }
</style>

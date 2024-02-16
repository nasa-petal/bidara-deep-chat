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
        <a class="revealed-button flex-shrink-0" on:click={handleClickRevealed}>
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
        border-bottom: 1px solid rgb(180, 180, 180);
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

    .selected .revealed-button .unfocused {
        display: none;
    }

    .selected .revealed-button .focused {
        display: block;
        opacity: 100%;
    }

    .selected .revealed-button:hover .focused {
        opacity: 100%;
    }

    .unfocused {
        opacity: 100%;
        transition: opacity 0.3s ease;
        position: absolute;
        left: 25%;
        top: 25%;
    }

    .focused {
        opacity: 0%;
        transition: opacity 0.3s ease;
        position: absolute;
        left: 25%;
        top: 25%;
    }

    .revealed-image {
        width: 1em;
        height: 1em;
    }

    .revealed-button {
        border-radius: 2em;
        position: relative;
        padding: 1em;
        transition: background-color 0.3s ease, border 0.3s ease;
        border: 1px solid rgba(180, 180, 180,0);
    }

    .revealed-button:hover .unfocused{
        opacity: 0%;
    }

    .revealed-button:hover .focused{
        opacity: 100%;
    }

    .revealed-button:hover {
        cursor: pointer;
        background-color: rgb(255, 59, 48);
        border: 1px solid rgb(180, 180, 180);
    }
</style>

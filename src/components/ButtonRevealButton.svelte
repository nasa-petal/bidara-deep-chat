<script>
    export let handleClickRevealed;
    export let handleClick;

    export let selected = false;

    export let revealedButtonFocusImage;
    export let revealedButtonUnfocusImage;
    export let buttonBgColor;
    export let buttonText;

    async function callWithoutProp(e, callback) {
        e.stopPropagation();
        await callback(e);
    }

</script>
<div class="button-reveal-container">
    <button 
        tabindex="0"
        class="button-box flex justify-between items-center py-0 focus:outline-none" 
        class:selected
        style="background-color: {buttonBgColor};"
        on:click={handleClick}
        >

        <p class="button-text my-0 font-sans block" >{buttonText}</p>
        <button tabindex="0" class="revealed-button flex-shrink-0 focus:outline-none" on:click={(e) => callWithoutProp(e, handleClickRevealed)}>
            <img draggable="false" class="revealed-image unfocused" src={revealedButtonUnfocusImage}  alt="revealed unfocused select"/>
            <img draggable="false" class="revealed-image focused" src={revealedButtonFocusImage}  alt="revealed focused select"/>
        </button>
    </button>
</div>

<style>
    button:focus-visible {
        outline: 5px auto -webkit-focus-ring-color;
    }

    .button-reveal-container {
        width: 100%;
        height: 100%;
        transition: background-color 0.3s ease;
    }

    .button-box {
        padding: 1em;
        width: 100%;
        height: 100%;
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
        background-color: var(--user-message-background-color) !important;
        color: var(--white)
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
        border: 1px solid var(--transparent-gray);
    }

    .revealed-button:hover .unfocused{
        opacity: 0%;
    }

    .revealed-button:hover .focused{
        opacity: 100%;
    }

    .revealed-button:hover {
        cursor: pointer;
        background-color: var(--red);
        border: 1px solid var(--border-color);
    }
</style>

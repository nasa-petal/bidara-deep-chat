<script>
    import SlideButtonReveal from './SlideButtonReveal.svelte';
    import ButtonRevealButton from './ButtonRevealButton.svelte';

    export let thread;
    export let handleDelete;
    export let handleSelect;

    export let selected = false;

    const chatId = "chat-"+thread.id;
    const trashId = "trash-"+thread.id;
    const sliderImage = "grip-lines-vertical-gray.svg";
    const trashImageWhite = "trash-can-white.svg";
    const trashImageRed = "trash-can-red.svg";
    const chatBgColor = 'var(--nav-color)';
    const trashBgColor = 'var(--red)';

    async function handleSelectThread() {
        handleSelect(thread);
    }

    async function handleDeleteThread() {
        handleDelete(thread);

        // Make visual cue that weren't allowed to delete thread;
    }

    function isMobile() {
        const userAgent = navigator.userAgent;
        const isMobile = /iPad|iPhone|iPod|Android|Windows|mobile/i.test(userAgent) 
            || (/MacIntel|Mac/i.test(userAgent) && navigator.maxTouchPoints > 1); // ipad
        return isMobile;
    }

</script>

<div class="chat-button-container">
        {#if isMobile()}
        <div class="chat-slider"> 
            <SlideButtonReveal 
                handleClick={handleSelectThread} 
                handleSlide={handleDeleteThread}
                sliderText={thread.name}
                sliderId={chatId}
                sliderImage={sliderImage}
                slideBgColor={chatBgColor}
                revealId={trashId}
                revealImage={trashImageWhite}
                revealBgColor={trashBgColor}
                bind:selected
            />
        </div>
        {:else}
        <div class="chat-button">
            <ButtonRevealButton
                buttonText={thread.name}
                handleClick={handleSelectThread}
                handleClickRevealed={handleDeleteThread}
                revealedButtonFocusImage={trashImageWhite}
                revealedButtonUnfocusImage={trashImageRed}
                buttonBgColor={chatBgColor}
                bind:selected
            />
        </div>
        {/if}
</div>

<style>
    .chat-button-container {
        height: 3em;
        width: 100%;
        color: var(--text-primary-color);
        border-bottom: 1px solid var(--border-color);
    }

    .chat-button {
        height: 100%;
        width: 100%;
    }

    .chat-slider {
        height: 100%;
        width: 100%;
    }
</style>

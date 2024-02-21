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
    const chatBgColor = 'rgb(229, 229, 234)';
    const trashBgColor = 'rgb(255, 59, 48)';

    async function handleSelectThread() {
        handleSelect();
    }

    async function handleDeleteThread() {
        const success = handleDelete();

        // Make visual cue that weren't allowed to delete thread;
    }
</script>

<div class="chat-button-container">
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
        <div class="chat-button">
            <ButtonRevealButton
                buttonText={thread.name}
                handleClick={handleSelectThread}
                handleClickRevealed={handleDeleteThread}
                revealedButtonFocusImage={trashImageWhite}
                revealedButtonUnfocusImage={trashImageRed}
                buttonBgColor={chatBgColor}
                revealedButtonFocusBgColor={trashBgColor}
                revealedButtonUnfocusBgColor="white"
                bind:selected
            />
        </div>
</div>

<style>
    .chat-button-container {
        height: 3em;
    }

    .chat-button {
        height: 100%;
        width: 100%;
        display: block;
    }

    .chat-slider {
        height: 100%;
        width: 100%;
        display: none;
    }

    @media only screen and (min-width: 701px) {
        .chat-button {
             display: block;
        }

        .chat-slider {
             display: none;
        }
    }

    @media only screen and (max-width: 700px) {
        .chat-button {
             display: none;
        }

        .chat-slider {
             display: block;
        }
    }
</style>

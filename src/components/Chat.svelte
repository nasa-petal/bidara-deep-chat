<script>
    import SlideButtonReveal from './SlideButtonReveal.svelte';
    export let thread;
    export let handleDelete;
    export let handleSelect;

    export let selected = false;

    const chatId = "chat-"+thread.id;
    const trashId = "trash-"+thread.id;
    const sliderImage = "grip-lines-vertical-gray.svg";
    const trashImage = "trash-can-white.svg";
    const chatBgColor = 'rgb(229, 229, 234)';
    const trashBgColor = 'rgb(255, 59, 48)';

    async function handleSelectThread() {
        handleSelect(thread);
    }

    async function handleDeleteThread() {
        const success = handleDelete(thread);

        // Make visual cue that weren't allowed to delete thread;
    }

</script>

<div
    class="chat-slider-button"
>
    <SlideButtonReveal 
        handleClick={handleSelectThread} 
        handleSlide={handleDeleteThread}
        sliderText={thread.name}
        sliderId={chatId}
        sliderImage={sliderImage}
        slideBgColor={chatBgColor}
        revealId={trashId}
        revealImage={trashImage}
        revealBgColor={trashBgColor}
        bind:selected
    />
</div>

<style>
    .chat-slider-button {
        height: 4em;
    }
</style>

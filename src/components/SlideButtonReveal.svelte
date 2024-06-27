<script>
    import { onMount } from 'svelte';

    export let handleClick;
    export let handleSlide;

    export let sliderId;
    export let sliderText;
    export let sliderImage;
    export let slideBgColor = 'var(--light-gray)';

    export let revealId;
    export let revealImage;
    export let revealBgColor = 'var(--red)';

    export let slideThresh = (1/3);
    export let maxSlide = (3/4);

    export let selected = false;

    let maxDragWidth;
    let slideThreshWidth;
    let width;
    const scrollThresh = 10;
    const movingThresh = 5;


    let rendered = false;

    let sliderElement;
    let revealElement;
    let moving = false;
    let scrolling = false;
    let left = 0;
    let movementY = 0;

    // not a great solution, but forces '.slide-button' to render before '.reveal' to prevent flickering
    onMount(() => {
        setTimeout(() => {
            rendered = true;
        }, 1);
    })

    function onMouseDown (e) { 
        width = sliderElement.clientWidth;
        slideThreshWidth = width  * slideThresh;
        maxDragWidth = width * maxSlide;
        sliderElement.style.transition = "none";
    }

    function onMouseMove(e) {
        left += e.movementX;
        movementY += Math.abs(e.movementY);
        if (!moving && movementY > scrollThresh) {
            scrolling = true;
            return;
        } 

        scrolling = false;

        if (!moving && left < -movingThresh) {
            moving = true;
            e.preventDefault();
        }
        
        if (!moving) {
            return;
        }

        if (left < -maxDragWidth) {
            return;
        }

        if (left > 0) {
            left = 0;
            sliderElement.style.left = left + "px";
            return;
        }

        if (left < -slideThreshWidth) {
            revealElement.style.marginRight = slideThreshWidth + "px";
        } else {
            revealElement.style.marginRight = "1em";
        }

        sliderElement.style.left = left + "px";
    }

    async function onMouseUp(e) {
        movementY = 0;
        sliderElement.style.transition = "left 0.5s ease";

        if (scrolling) {
            scrolling = false;
            left = 0;
            sliderElement.style.left = left + "px";
            return;
        }

        if (!moving) {
            await handleClick();
            return;
        } 

        moving = false;

        if (left <= -slideThreshWidth) {
            left = 0;
            sliderElement.style.left = left + "px";
            await handleSlide();
            return;
        } 

        left = 0;
        sliderElement.style.left = left + "px";
    }

    let prevTouch;
    let firstTouch;
    let touching = false;

    function onTouchStart(e) {
        touching = true;
        firstTouch = e.touches[0];
        prevTouch = firstTouch;
        onMouseDown(e);
    }

    function onTouchMove(e) {
        const newTouch = e.touches[0];
        e.movementX = newTouch.pageX - prevTouch.pageX;
        e.movementY = newTouch.pageY - prevTouch.pageY;
        e.totalX = newTouch.pageX - firstTouch.pageX;
        e.totalY = newTouch.pageY - firstTouch.pageY;

        onMouseMove(e);

        prevTouch = newTouch;
    }

    function onTouchEnd(e) {
        onMouseUp(e);

        touching = false;
    }
</script>

<div class="slider-button-reveal-container" class:selected>
    <div 
        id={sliderId}
        role="button"
        bind:this={sliderElement}
        tabindex="-1"
        class="slider-button flex justify-between items-center py-0" 
        on:mousedown={onMouseDown}
        on:mousemove={onMouseMove}
        on:mouseup={onMouseUp}
        on:touchstart={onTouchStart}
        on:touchmove={onTouchMove}
        on:touchend={onTouchEnd}
        on:touchcancel={onTouchEnd}
        style="background-color: {slideBgColor};"
        >
        <p class="slider-button-text my-0 font-sans block w-full focus:outline-none" >{sliderText}</p>
        <img class="slider-image" src={sliderImage} alt="Dragger" draggable="false" />
    </div>
    <div 
        class="reveal flex justify-end items-center"
        style="background-color: {revealBgColor};"
        >
        <img bind:this={revealElement} id={revealId} class="reveal-image" src={revealImage} alt="Revealed"/>
    </div>
</div>

<style>
    .slider-button-reveal-container {
        height: 100%;
        width: 100%;
        position: relative;
        cursor: pointer;
        transition: margin-right 0.3s ease;
        padding-left: env(safe-area-inset-left);
    }

    .slider-button {
        overflow: hidden;
        whitespace: nowrap;
        height: 100%;
        width: 100%;
        position: absolute;
        left: 0;
        top: 0;
        padding: 1em;
        z-index: 25 !important;
    }

    .slider-button-text {
        font-size: 1em;
        overflow: hidden;
        margin-right: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
        padding-left: env(safe-area-inset-left);
    }

    .reveal {
        position: absolute;
        z-index: -20 !important;
        height: 100%;
        width: 100%;
        left: 0;
        top: 0;
    }

    .reveal-image {
        width: 1em;
        height: 1em;
        margin-right: 1em;
        transition: margin-right 0.3s ease;
    }

    .slider-image {
        width: 1em;
        height: 1em;
        color: red;
        transform: rotate(180deg);
        cursor: grab;
        margin-right: 0.2em;
        transition: margin-right 0.3s ease;
    }

    .selected > .slider-button {
        background-color: var(--user-message-background-color) !important;
        color: var(--white) !important;
    }
</style>

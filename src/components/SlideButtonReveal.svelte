<script>
    import { draggable } from 'svelte-agnostic-draggable'
    import { onMount } from 'svelte';
    import mapTouchToMouseFor from 'svelte-touch-to-mouse'

    export let handleClick;
    export let handleSlide;

    export let sliderId;
    export let sliderText;
    export let sliderImage;
    export let slideBgColor = 'rgb(229, 229, 234)';

    export let revealId;
    export let revealImage;
    export let revealBgColor = 'rgb(255, 59, 48)';

    export let slideThresh = (1/3);
    export let maxSlide = (3/4);

    export let selected = false;

    let touching = false;
    let wasDragged = false
    let clicked = selected;
    let clickTolerance = 5;

    let deltaX = 0;
    let maxDragWidth;
    let slideThreshWidth;

    let initialLeft = 0;
    let width;
    let position;

    let rendered = false;

    mapTouchToMouseFor('.draggable');

    // not a great solution, but forces '.slide-button' to render before '.reveal' to prevent flickering
    onMount(() => {
        setTimeout(() => {
            rendered = true;
        }, 1);
    })

    function onMouseDown () { 
        wasDragged = false; 
    }

    function onDragStart (event) { 
        width = event.target.clientWidth;
        slideThreshWidth = width  * slideThresh;
        maxDragWidth = width * maxSlide;
        touching = true;
    }

    function onDrag(event) {
        if (!touching ) return;

        position = event.detail.position.left;
        deltaX = (-1) * (position - initialLeft);

        if (deltaX <= 0) {
            event.preventDefault();
            event.detail.position.left = 0;
            event.detail.position.top = 0;

        } else if ( deltaX >= maxDragWidth ) {
            event.detail.position.left = (-1) * maxDragWidth;

        } else if (deltaX >= slideThreshWidth) {
            const revealImage = document.getElementById(revealId);
            revealImage.style.transition = 'margin-right 0.3s ease';
            revealImage.style.marginRight = slideThreshWidth + 'px';

        } else {
            const revealImage = document.getElementById(revealId);
            revealImage.style.transition = 'margin-right 0.3s ease';
            revealImage.style.marginRight = '1em';
        }

        if (deltaX >= clickTolerance) {
            wasDragged = true;

        }
    }

    function onMouseUp () {
        if (! wasDragged && ! clicked) {
            handleClick();
            clicked = true;
        }


        if (! touching) {
            return;
        }

        deltaX = (-1) * (position - initialLeft);

        if (deltaX >= slideThreshWidth) {
            handleSlide();
        }

        deltaX = 0;

        const revealImage = document.getElementById(revealId);
        revealImage.style.transition = 'margin-right 0.3s ease';
        revealImage.style.marginRight = '1em';

        touching = false;
    }
</script>

<a class="slider-button-reveal-container">
    <a 
        id={sliderId} 
        class="slider-button draggable flex justify-between items-center py-0" 
        class:selected class:touching 
        use:draggable={{axis:'x', revert: 'true', revertDuration:'200'}} 
        on:mousedown={onMouseDown} 
        on:mouseup={onMouseUp} 
        on:drag:start={onDragStart} 
        on:drag:move={onDrag}
        style="background-color: {slideBgColor};"
        >
        <p class="slider-button-text draggable my-0 font-sans block w-full focus:outline-none" >{sliderText}</p>
        <img class="slider-image draggable" src={sliderImage} alt="Dragger image" />
    </a>
    {#if rendered}
    <div 
        class="reveal flex justify-end items-center"
        style="background-color: {revealBgColor};"
        >
        <img id={revealId} class="reveal-image" src={revealImage} alt="Revealed image"/>
    </div>
    {/if}
</a>

<style>
    .slider-button-reveal-container {
        height: 100%;
        width: 100%;
        position: relative;
        cursor: pointer;
        transition: background-color 0.3s ease;
        transition: margin-right 0.3s ease;
    }

    .slider-button {
        height: 100%;
        width: 100%;
        left: 0;
        top: 0;
        padding: 1em;
        z-index: 25 !important;
        border-bottom: 1px solid rgb(199, 199, 204);
        transition: background-color 0.3s ease;
    }

    .slider-button-text {
        font-size: 1em;
        overflow: hidden;
        margin-right: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }

    .reveal {
        position: absolute;
        z-index: 20 !important;
        height: 100%;
        width: 100%;
        left: 0;
        top: 0;
        transition: margin-right 0.3s ease;
        border-bottom: 1px solid rgb(174, 174, 178);
    }

    .reveal-image {
        width: 15px;
        height: 15px;
        margin-right: 1em;
    }

    .slider-image {
        width: 15px;
        height: 15px;
        color: red;
        transform: rotate(180deg);
        cursor: grab;
        margin-right: 0.2em;
        transition: margin-right 0.3s ease;
    }

    .draggable {
        z-index: 11;
        -webkit-touch-callout:none;
        -ms-touch-action:none; touch-action:none;
        -moz-user-select:none; -webkit-user-select:none; -ms-user-select:none; user-select:none;
    }

    .selected {
        transition: background-color 0.3s ease;
        background-color: rgb(0, 122, 255) !important;
        color: rgb(242, 242, 247) !important;
    }
</style>

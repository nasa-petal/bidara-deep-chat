<script>
    export let open = false;
    export let thread;
    export let handleClick = null;
    export let handleDelete = null;


    import { draggable } from 'svelte-agnostic-draggable'

    /**** map all touch events to mouse events ****/

      import mapTouchToMouseFor from 'svelte-touch-to-mouse'
    mapTouchToMouseFor('.draggable');

    /**** event handlers ****/
    let initialLeft = 0;
    let initialOffset = 0;
    let deltaX = 0;
    let touching = false;

    let wasDragged = false
    function onMouseDown () { 
        wasDragged = false; 
    }

    function onDragStart (event) { 
        touching = true;
        wasDragged = true;
    }

    function onDrag(event) {
        if (!touching || !wasDragged) return;

        const position = event.detail.position.left;
        deltaX = position - initialLeft;

        if (deltaX >= 0) {
            event.detail.position.left = 0;
        }
    }

    function onMouseUp (event) {
        if (! wasDragged) {
          console.log('button was clicked')
        }

        touching = false;
    }
</script>

<a class="container">
    <div class="draggable innner-container chat-text flex justify-between items-center py-0" class:touching use:draggable={{axis:'x', revert: 'true', revertDuration:'200'}} on:mousedown={onMouseDown} on:mouseup={onMouseUp} on:drag:start={onDragStart} on:drag:move={onDrag}>
        <p class="chat-button my-0 text-base font-sans block w-full focus:outline-none" class:open>{thread.name}</p>
        <img class="drag-image" src="chevron-right-blue.svg" alt="drag"/>
    </div>
    <div id="trash" class="trash flex justify-end items-center">
        <img class="trash-image" src="trash-can-white.svg" alt="trash"/>
    </div>
</a>

<style>
    .chat-button {
        overflow: hidden;
        margin-right: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .chat-button:active,
    .chat-button:hover,
    .chat-button:-moz-drag-over {
        background-color: rgba(0,0,0,0);
    }

    .draggable {
        left: 0;
        cursor: grab; pointer-events: auto;
        z-index: 11;
        -webkit-touch-callout:none;
        -ms-touch-action:none; touch-action:none;
        -moz-user-select:none; -webkit-user-select:none; -ms-user-select:none; user-select:none;
    }

    .container {
        position: relative;
    }


    .chat-text {
        padding: 1em;
        background-color: rgb(229, 229, 234);
        transition: background-color 0.1s ease;
    }

    .trash-image {
        width: 15px;
        height: 15px;
        margin-right: 1em;
    }

    .drag-image {
        width: 15px;
        height: 15px;
        transform: rotate(180deg);
    }

    .trash {
        z-index: 9;
        position: absolute;
        height: 100%;
        width: 100%;
        left: 0;
        top: 0;
        background-color: rgb(255, 59, 48);
        transition: background-color 0.3s ease;
    }

    .inner-container {
        z-index: 10;
        left: 0;
        top: 0;
        position: absolute;
        border-bottom: 1px solid rgb(209, 209, 214);
    }
    .inner-container:hover,
    .inner-container:focus,
    .touching {
        background-color: rgb(0, 122, 255);
    }
</style>

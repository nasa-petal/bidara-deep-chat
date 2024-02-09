<script>
    export let open = false;
    export let thread;
    export let handleClick = null;
    export let handleDelete = null;

    export let selected = false;

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
    let width;
    let deleteThresh;
    let maxDrag;
    let position;
    const chatId = "chat-"+thread.id;
    const trashId = "trash-"+thread.id;
    
    function onMouseDown () { 
        wasDragged = false; 
    }

    function onDragStart (event) { 
        width = event.target.clientWidth;
        deleteThresh = width  * (1/2);
        maxDrag = width * (3/4);
        touching = true;
        wasDragged = true;
    }

    function onDrag(event) {
        if (!touching || !wasDragged) return;


        position = event.detail.position.left;
        deltaX = (-1) * (position - initialLeft);

        if (deltaX <= 0) {
            event.preventDefault();
            event.detail.position.left = 0;
            event.detail.position.top = 0;
        } else if ( deltaX >= maxDrag ) {
            event.detail.position.left = (-1) * maxDrag;

        } else if (deltaX >= deleteThresh) {
            const trashImage = document.getElementById(trashId);
            trashImage.style.transition = 'margin-right 0.3s ease';
            trashImage.style.marginRight = deleteThresh + 'px';

        } else {
            const trashImage = document.getElementById(trashId);
            trashImage.style.transition = 'margin-right 0.3s ease';
            trashImage.style.marginRight = '1em';
        }
    }

    function onMouseUp () {
        if (! wasDragged) {

            handleClick(thread);
        }

        if (! touching) {
            return;
        }

        deltaX = (-1) * (position - initialLeft);

        if (deltaX >= deleteThresh) {
            handleDelete(thread);
        }

        deltaX = 0;

        const trashImage = document.getElementById(trashId);
        trashImage.style.transition = 'margin-right 0.3s ease';
        trashImage.style.marginRight = '1em';

        touching = false;
    }
</script>

<a class="chat-trash-container">
    <a id={chatId} class="draggable chat-button flex justify-between items-center py-0" class:selected class:touching use:draggable={{axis:'x', revert: 'true', revertDuration:'200'}} on:mousedown={onMouseDown} on:mouseup={onMouseUp} on:drag:start={onDragStart} on:drag:move={onDrag}>
        <p class="chat-text draggable my-0 text-base font-sans block w-full focus:outline-none" use:draggable={{disabled: 'true'}} on:mousedown={onMouseDown} on:mouseup={onMouseUp} on:drag:start={onDragStart} on:drag:move={onDrag}>{thread.name}</p>
        <img class="drag-image draggable" src="grip-lines-vertical-gray.svg" alt="drag" use:draggable={{disabled: 'true'}} on:mousedown={onMouseDown} on:mouseup={onMouseUp} on:drag:start={onDragStart} on:drag:move={onDrag}/>
    </a>
    <div id="trash" class="trash flex justify-end items-center">
        <img id={trashId} class="trash-image" src="trash-can-white.svg" alt="trash"/>
    </div>
</a>

<style>
    .chat-text {
        overflow: hidden;
        margin-right: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }

    .draggable {
        z-index: 11;
        -webkit-touch-callout:none;
        -ms-touch-action:none; touch-action:none;
        -moz-user-select:none; -webkit-user-select:none; -ms-user-select:none; user-select:none;
    }

    .chat-trash-container {
        position: relative;
        cursor: pointer;
        transition: margin-right 0.3s ease;
    }

    .selected {
        background-color: rgb(0, 122, 255) !important;
        color: rgb(242, 242, 247) !important;
    }


    .chat-button {
        left: 0;
        padding: 1em;
        z-index: 10;
        background-color: rgb(229, 229, 234);
        border-bottom: 1px solid rgb(199, 199, 204);
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
        color: red;
        transform: rotate(180deg);
        cursor: grab;
        margin-right: 0.2em;
        transition: margin-right 0.3s ease;
    }

    .trash {
        position: absolute;
        z-index: 9;
        height: 100%;
        width: 100%;
        left: 0;
        top: 0;
        background-color: rgb(255, 59, 48);
        transition: margin-right 0.3s ease;
        border-bottom: 1px solid rgb(174, 174, 178);
    }
</style>

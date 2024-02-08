<script>
    export let open = false;
    export let thread;
    export let handleClick = null;
    export let handleDelete = null;

</script>

<div class="container flex items-center">
    <button class="chat-button flex justify-between text-base font-sans block w-full focus:outline-none" class:open on:click={() => handleClick(thread)}>{thread.name} </button>
    <a class="trash text-base font-sans bg-gray-400" on:click={() => handleDelete(thread)}>
        <img class="trash-image unfocused" src="trash-can-red.svg" alt="delete"/>
        <img class="trash-image focused" src="trash-can-white.svg" alt="delete"/>
    </a>
</div>

<style>
    .chat-button {
        overflow: hidden;
        margin-right: 1em;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .chat-button:active,
    .chat-button:hover {
        background-color: rgba(0,0,0,0);
    }

    .container {
        border-bottom: 1px solid rgb(209, 209, 214);
        padding: 1em;
        background-color: rgba(0, 122, 255, 0);
        transition: background-color 0.1s ease;
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

    .trash-image {
        width: 15px;
        height: 15px;
    }

    .trash {
        display: none;
        border-radius: 2em;
        background-color: rgba(229, 229, 234);
        padding: 0.5em;
        transition: background-color 0.3s ease;
    }

    .container:hover {
        background-color: rgba(0, 122, 255, 0.9);
    }

    .container:hover .trash {
        display: block;
    }

    .trash:hover .unfocused{
        opacity: 0%;
        display: none;
    }

    .trash:hover .focused{
        opacity: 100%;
        display: block;
    }

    .trash:hover {
        cursor: pointer;
        background-color: rgb(255, 59, 48);
    }
</style>

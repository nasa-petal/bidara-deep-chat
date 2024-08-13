<script>
    export let open = false
</script>

<div class="container flex items-center">
    <button tabindex="0" class="focus:outline-none menu w-full h-full" class:open on:click={() => open = !open}>
        <img class="menu-image m-auto" src="chevron-right-blue.svg" alt="menu"/>
    </button>
</div>

<style>
    button {
        padding: 3px;
    }

    button:focus-visible {
        outline: 5px auto -webkit-focus-ring-color;
    }
    
    .container {
        width: 2em;
        height: 2em;
    }

    .menu:hover {
        cursor: pointer;
    }

    .menu-image {
        width: 15px;
        height: 15px;
        transition: transform ease-out 0.3s;
    }

    .open img {
        transform: rotate(180deg);
    }
</style>

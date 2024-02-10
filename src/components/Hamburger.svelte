<script>
    export let open = false
</script>

<div class="container flex items-center">
    <a class="menu" class:open on:click={() => open = !open}>
        <img class="menu-image" src="chevron-right-blue.svg" alt="menu"/>
    </a>
</div>

<style>
    .container {
        width: 2em;
        height: 2em;
        margin-right: 4.5em;
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

    @media only screen and (max-width: 700px) {
        .container {
            margin-right: 0;
        }
    }


</style>

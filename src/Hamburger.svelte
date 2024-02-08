<script>
    export let open = false
</script>

<a class="menu" class:open on:click={() => open = !open}>
    <img class="menu-image" src="chevron-right-blue.svg" alt="menu"/>
</a>

<style>
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

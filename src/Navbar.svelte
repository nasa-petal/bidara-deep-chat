<script>
    import Logo from './Logo.svelte'
    import Hamburger from './Hamburger.svelte'
	
	
    export let onClear = null;
    export let sidebar = false
</script>

<header class="flex justify-between p-2 items-center text-gray-600">
  <nav class="flex">
    <Hamburger bind:open={sidebar}/>
  </nav>
  <p>
  <Logo/>	
	
</header>

<style>
  header {
    z-index: 10;
    border-bottom: 1px solid rgb(229, 229, 234);
  }

</style>

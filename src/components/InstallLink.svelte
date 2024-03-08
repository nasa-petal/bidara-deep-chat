<script>
  export let installEvent;
  if (installEvent) {
    console.log("install installevent")
  }

  function handleClick() {
    console.log("click");
    if (installEvent) {
      console.log("install prompt");
      installEvent.prompt();
    }
  }
</script>

<button class="w-full h-full p-1 flex justify-left" on:click={handleClick}>
Install BIDARA
</button>

<style>
</style>

<script>
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log("beforeinstallprompt event was fired");
    })
</script>

<button>
Install BIDARA
</button>

<style>
</style>

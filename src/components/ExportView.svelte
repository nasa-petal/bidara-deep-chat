<script>
    export let messages = []; // list of messages
    /*
    messages = [
        { "role": "<insert role here", "message": "<insert message here>"},
        { "role": "<insert role here", "message": "<insert message here>"},
        { "role": "<insert role here", "message": "<insert message here>"},
        { "role": "<insert role here", "message": "<insert message here>"},
        { "role": "<insert role here", "message": "<insert message here>"},
    ]
    */
</script>

<div class="messages">
    {#each messages as message}
    {#if message.role === "assistant"}
        <div class="assistant-view">
            <div class="assistant-role">{message.role}:</div>
            <div class="assistant-message">{message.message}</div>
        </div>
        <hr>
    {/if}
    {#if message.role === "user"}
        <div class="user-view">
            <div class="user-role">{message.role}:</div>
            <div class="user-message">{message.message}</div>
        </div>
        <hr>
    {/if}
    {/each}
</div>


<style>
    .messages {
        margin: 20px;
    }

    .user-view, .assistant-view {
        display: flex;
        align-items: flex-start;
        padding: 10px;
        margin: 5px 0;
    }

    .assistant-role, .user-role {
        font-weight: bold;
        text-transform: capitalize;
        margin-right: 10px;
    }
</style>
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

<div class="container">
    <div class="title">
        <h1 class="chat-name">New Chat</h1>
        <div class="credits">Bidara by NASA PeTaL</div>
    </div>
    <hr class="first-divider">
    
    <div class="messages">
        {#each messages as message}
        {#if message.role === "bidara"}
            <div class="message-view assistant-view">
                <div class="assistant-role">{message.role}:</div>
                <div class="message">{message.message}</div>
            </div>
            <hr>
        {/if}
        {#if message.role === "user"}
            <div class="message-view user-view">
                <div class="user-role">{message.role}:</div>
                <div class="message">{message.message}</div>
            </div>
            <hr>
        {/if}
        {/each}
    </div>
</div>


<style>

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    .container {
        margin: 0 auto;
        display: flex;
        flex-direction: column;
    }

    .title {
        display: flex;
        justify-content: space-between;
        margin-top: 50px;
        align-items: flex-end;
    }

    .user-view, .assistant-view {
        display: flex;
        padding: 20px 0px;
    }

    .assistant-role, .user-role {
        font-weight: bold;
        text-transform: capitalize;
        margin-right: 10px;
        width: 60px;
    }

    .chat-name {
        font-size: 2em;
    }

    .first-divider {
        border: 0.5px solid black;
    }

    .message-view {
        display: flex;
        padding: 20px 0;
        align-items: flex-start;
    }

    .message {
        flex: 1;
    }
</style>
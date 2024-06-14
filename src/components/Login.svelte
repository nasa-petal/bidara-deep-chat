<script>
	import { onDestroy } from 'svelte';
	import AssistantDeepChat from './AssistantDeepChat.svelte';

	import * as bidara from '../assistant/bidara';

	export let loginHandler;

	let title = bidara.NAME;
	let image = bidara.LOGO;
	let image_alt = bidara.LOGO_DESC;
	let tagline = bidara.TAGLINE;
	let name = bidara.NAME;
  let showLoginField = true; 

  async function handleLogin(){
		showLoginField = false;
		loginHandler()
  }

</script>

<div id="welcome" class="w-full h-full">
	<div id="header">
		<img src={image} alt={image_alt} height="57" width="57" />
		<h2>{title}</h2><br/>
		<span class="small">{tagline}</span>
	</div>

	<h3 class="text-lg font-bold mt-5 mb-5">How to access</h3>
	<ol class="list-decimal">
		<li><a href="https://platform.openai.com/signup" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">Create an OpenAI account</a></li>
		<li><a href="https://platform.openai.com/login" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">Login to OpenAI Platform Dashboard</a></li>
		<li>Navigate to <a href="https://platform.openai.com/account/billing/overview" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">Settings -&gt; Billing</a></li> <li>Click the 'Add payment details' button</li>
		<li>Add a minimum of $5 in credits. It is required to spend a minimum of $5 to move to Tier 1 to <a href="https://platform.openai.com/docs/guides/rate-limits/usage-tiers?context=tier-free" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">enable access to GPT-4o</a>.</li>
		<li>In the left sidebar, navigate to <a href="https://platform.openai.com/api-keys" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">API Keys</a></li>
		<li>Verify your phone number, then click the 'Create new secret key' button.</li> <li>Copy your secret key.</li>
		<li>Paste your key into the input field below. Your browser will save the key, so you only have to enter it once.</li>
	</ol>
	<ul class="list-disc mt-4">
		<li>With OpenAI API you only pay for what you use. Track your usage and costs on the <a href="https://platform.openai.com/usage" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">Usage page</a>.</li>
		<li>After you send your first message to {name}, it will also be available to interact with through the <a href="https://platform.openai.com/assistants" class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600">OpenAI Assistants Playground</a>. This interface is more complex, but also provides more customizability. Just select {name}, then click the 'Test' button.</li>
	</ul>

  {#if showLoginField}
		<AssistantDeepChat
			loginHandler={handleLogin}
			onLoadComplete={null}
			height="100px"
		 />
  {/if}
</div>

<style>
	#welcome {
		background-color: var(--chat-background-color);
		color: var(--text-primary-color);
		z-index: 1;
		line-height: 1.5em;
		padding-left: 1em;
		padding-right: 1em;
	}

	#welcome ol, #welcome ul {
		padding-inline-start: 1.7em;
	}

	#welcome h2 {
		font-weight: 200;
		font-size: 2em;
		line-height: 1em;
		display: inline;
	}

	#header {
		padding-top: 1.3em;
		line-height: 1.15em;
	}

	#welcome #header img {
		float: left;
		margin-right: .1em;
	}

	#welcome #header .small {
		font-size: .8em;
		font-weight: 300;
	}
</style>

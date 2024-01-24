## <img src="https://github.com/nasa-petal/discord_bot/assets/1322063/c34b5526-7186-43fc-b00a-597ee773ca7b" width="40" align="left"/> BIDARA : Bio-Inspired Design and Research Assistant

### BIDARA is a GPT-4 chatbot that was instructed to help scientists and engineers understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies.

:rocket: **[Try it out](https://nasa-petal.github.io/bidara-deep-chat/)**

BIDARA can guide users through the Biomimicry Institute’s [Design Process](https://toolbox.biomimicry.org/methods/process/), a step-by-step method to propose biomimetic solutions to challenges. This process includes defining the problem, biologizing the challenge, discovering natural models, abstracting design strategies, and emulating nature's lessons.

`bidara-deep-chat` uses [a web interface](https://github.com/OvidijusParsiunas/deep-chat) to connect to BIDARA over the OpenAI Assistants API. To use it, you need to:

1. [Create an OpenAI account](https://platform.openai.com/signup)
2. [Login to OpenAI Platform](https://platform.openai.com/login)
3. In the left sidebar, navigate to 'Settings -> Billing'
4. Click the 'Add payment details' button
5. Add a minimum of $5 in credits. It is required to spend a minimum of $5 to [access GPT-4](https://platform.openai.com/docs/guides/rate-limits/usage-tiers?context=tier-free).
6. In the left sidebar, navigate to 'API Keys'
7. Verify your phone number, then click the 'Create new secret key' button.
8. Copy your secret key and enter it into BIDARA.

## :fire: Features enabled

&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Code Interpreter** *[more info](https://platform.openai.com/docs/assistants/tools/code-interpreter), [filetypes supported](https://platform.openai.com/docs/assistants/tools/supported-files)*    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Knowledge Retrieval** *[more info](https://platform.openai.com/docs/assistants/tools/knowledge-retrieval), [filetypes supported](https://platform.openai.com/docs/assistants/tools/supported-files)*    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Function Calling** *(Semantic Scholar paper search)*

## :computer: For developers

Uses Svelte and [deep-chat](https://github.com/OvidijusParsiunas/deep-chat)    
Template based on https://github.com/sveltejs/template

### Run locally
```
npm install
npm run dev
```

### Known issues

- deep-chat speechToText: submit command word is sent in message on safari and chrome on iOS.

- deep-chat textToSpeech: doesn't read messages aloud on safari or chrome on iOS.

### Nice to haves

- Proxy requests to OpenAI through an authenticated API. Users can request access. Ability to generate api keys once authenticated. Authorized API keys required to communicate with API.

- Show the quote from the file used to generate the response when BIDARA uses knowledge retrieval. https://platform.openai.com/docs/assistants/how-it-works/message-annotations 

- DALLE-3 support for image generation. (Coming soon to Assistants API, or could implement using Function Calling) https://cookbook.openai.com/examples/creating_slides_with_assistants_api_and_dall-e3

- GPT-4 vision support so it can 'see' images, including ones uploaded by users.

- Functions:

- patent search - https://developer.uspto.gov/api-catalog/bulk-search-and-download, https://patentsview.org/apis/api-faqs, https://www.npmjs.com/package/uspto-patents-view-api 

- get pdf of paper from semantic scholar link and upload to assistant.thread.messages.files for retrieval. as a temp workaround can use openAccessPdf links to download pdfs on client, and then upload them on client directly to openai assistant.

- get all messages using openai API. Then BIDARA can use the list of messages to summarize the conversation, or save the conversation history to PDF. 

- get all code interpreter code. useful to check its work.

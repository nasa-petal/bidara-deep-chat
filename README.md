## <img src="https://github.com/nasa-petal/discord_bot/assets/1322063/c34b5526-7186-43fc-b00a-597ee773ca7b" width="40" align="left"/> BIDARA : Bio-Inspired Design and Research Assistant

<img src="https://github.com/nasa-petal/bidara-deep-chat/assets/1322063/70d336c6-eb53-45cf-b3a1-156d6b479434" width="600" align="right"/>

### BIDARA is a GPT-4 chatbot that was instructed to help scientists and engineers understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies.

### :rocket: [Try it online!](https://nasa-petal.github.io/bidara-deep-chat/) or [Use BIDARA in ChatGPT](https://github.com/nasa-petal/bidara#use-bidara-in-your-own-chatgpt-session)

BIDARA can guide users through the Biomimicry Institute’s [Design Process](https://toolbox.biomimicry.org/methods/process/), a step-by-step method to propose biomimetic solutions to challenges. This process includes defining the problem, biologizing the challenge, discovering natural models, abstracting design strategies, and emulating nature's lessons.
<br clear="both" />

## :fire: Features enabled

&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Multiple chats**    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Code Interpreter** *[more info](https://platform.openai.com/docs/assistants/tools/code-interpreter), [filetypes supported](https://platform.openai.com/docs/assistants/tools/supported-files)*    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Knowledge Retrieval** *[more info](https://platform.openai.com/docs/assistants/tools/knowledge-retrieval), [filetypes supported](https://platform.openai.com/docs/assistants/tools/supported-files)*    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Function Calling**    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Retrieve academic literature with Semantic Scholar*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Generate images with DALL-E*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Analyze images with GPT-4V(ision)*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Detect [pABC](https://na2ure.org/patternabc/) patterns in images with GPT-4V(ision)*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Search for US patents with the PatentsView API*

## :computer: For developers

`bidara-deep-chat` uses Svelte and [the deep-chat web component](https://github.com/OvidijusParsiunas/deep-chat) to connect to BIDARA over the OpenAI Assistants API.
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

- save chat logs.
- ability rate responses and add feedback.
- ability to send ratings, feedback and chat log to us.
- don't do TtS unless StT has been used.
- Proxy requests to OpenAI through an authenticated API. Users can request access. Ability to generate api keys once authenticated. Authorized API keys required to communicate with API.

- Show the quote from the file used to generate the response when BIDARA uses knowledge retrieval. https://platform.openai.com/docs/assistants/how-it-works/message-annotations 

- GPT-4 vision support so it can 'see' images, including ones uploaded by users.

- Functions:

- patent search - https://developer.uspto.gov/api-catalog/bulk-search-and-download, https://patentsview.org/apis/api-faqs, https://www.npmjs.com/package/uspto-patents-view-api 

- get pdf of paper from semantic scholar link and upload to assistant.thread.messages.files for retrieval. as a temp workaround can use openAccessPdf links to download pdfs on client, and then upload them on client directly to openai assistant.

- get all messages using openai API. Then BIDARA can use the list of messages to summarize the conversation, or save the conversation history to PDF. 

- get all code interpreter code. useful to check its work..

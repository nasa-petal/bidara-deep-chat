## <img src="https://github.com/nasa-petal/discord_bot/assets/1322063/c34b5526-7186-43fc-b00a-597ee773ca7b" width="40" align="left"/> BIDARA : Bio-Inspired Design and Research Assistant

<img src="https://github.com/nasa-petal/bidara-deep-chat/assets/1322063/70d336c6-eb53-45cf-b3a1-156d6b479434" width="600" align="right"/>

### BIDARA is an OpenAI GPT-4o Assistant that was instructed to help scientists and engineers understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies.

### :rocket: [Try it online!](https://nasa-petal.github.io/bidara-deep-chat/) or [Use BIDARA in ChatGPT](https://github.com/nasa-petal/bidara#use-bidara-in-your-own-chatgpt-session)

BIDARA can guide users through the Biomimicry Institute’s [Design Process](https://toolbox.biomimicry.org/methods/process/), a step-by-step method to propose biomimetic solutions to challenges. This process includes defining the problem, biologizing the challenge, discovering natural models, abstracting design strategies, and emulating nature's lessons.
<br clear="both" />

## :fire: Features

&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Multiple chats (saved offline)**    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Mobile optimized**    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Write and execute python code to analyze data, create visualizations, or perform calculations (Code Interpreter)** *[more info](https://platform.openai.com/docs/assistants/tools/code-interpreter), [filetypes supported](https://platform.openai.com/docs/assistants/tools/supported-files)*    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Summarize or answer questions about uploaded files (Knowledge Retrieval)** *[more info](https://platform.openai.com/docs/assistants/tools/knowledge-retrieval), [filetypes supported](https://platform.openai.com/docs/assistants/tools/supported-files)*    
&nbsp;&nbsp;&nbsp;&nbsp; :white_check_mark: **Custom Functions**    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Retrieve academic literature with Semantic Scholar*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Generate images with DALL-E*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Analyze images you upload or that it has generated with GPT-4o*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Detect [pABC](https://na2ure.org/patternabc/) patterns in images with GPT-4o*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Search for US patents with the [PQAI API](https://github.com/pqaidevteam/pqai)*    
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; :ballot_box_with_check: *Search the web with [Tavily API](https://tavily.com) (limited to 1000 API calls a month across all BIDARA users)*

## :computer: For developers

`bidara-deep-chat` is a front-end web app that uses Svelte and [the deep-chat web component](https://github.com/OvidijusParsiunas/deep-chat) to connect directly to BIDARA over the OpenAI Assistants API (no backend required). You can easily clone this repository and replace BIDARA with your own custom OpenAI Assistant. Template based on https://github.com/sveltejs/template

### Run locally
```
npm install
npm run dev
```

### Known issues

- deep-chat speechToText: submit command word is sent in message on safari and chrome on iOS.

- deep-chat textToSpeech: doesn't read messages aloud on safari or chrome on iOS.

### Nice to haves

- ability rate responses and add feedback.
- ability to send ratings, feedback and chat log to us.
- don't do TtS unless StT has been used.
- Proxy requests to OpenAI through an authenticated API. Users can request access. Ability to generate api keys once authenticated. Authorized API keys required to communicate with API.

- Functions:

- get pdf of paper from semantic scholar link and upload to assistant.thread.messages.files for retrieval. as a temp workaround can use openAccessPdf links to download pdfs on client, and then upload them on client directly to openai assistant.

- get all code interpreter code. useful to check its work.

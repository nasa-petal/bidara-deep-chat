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


# :computer: Contributions Guide
## Assistant Functions
Assistant functions are an excellent starting point for new contributors. They involve two key aspects: defining the function in the assistant config and creating the "handler" that executes when the assistant calls this function.

[Assistant Functions Issues](https://github.com/nasa-petal/bidara-deep-chat/issues?q=is%3Aopen+is%3Aissue+label%3Afunction)

### Config
General-use function configs are defined in [src/assistant/common.js](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/common.js). Define the function config according to the [OpenAI Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling/quickstart?lang=node.js) specification. Several examples are available here for reference.

**Specifics:**
- If a function is specific to an assistant (e.g., BIDARA) or a general function needs modification for a specific assistant, make those changes in the respective assistant’s file.
  - For example, a search function in `src/assistant/common.js` could have a bio-enhanced version in `src/assistant/bidara.js`.

**Tips:**
- Function names, descriptions, and parameter names are crucial as they influence the assistant’s behavior and function invocation.
  - Descriptions should clarify the function’s purpose and expected inputs/outputs without instructing the assistant on handling responses.
- Use the [Assistant's Playground](https://platform.openai.com/playground/assistants) for testing new configs or changes.
- Ensure new definitions do not conflict with existing functions.
- For local development, set the [TEST_NAME](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/bidara.js#L6) instead of the `PROD_NAME`.
- Update the config version number to apply changes.

### Handler
General-use function "handlers" are defined in [src/assistant/commonFunctions.js](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/commonFunctions.js). Reference the existing handlers to model new ones.

**Handler Structure:**
- **Parameters**:
  - `params`: Arguments passed by the assistant as defined in the config.
  - `context`: Additional information not passed by the assistant, such as callbacks or thread IDs.

**Requirements:**
- Functions must return a string response, even in case of an error. This response should format the information, instruct the assistant on handling it, and specify what it should not do.

To expose a function to the assistant's handler, add it to the options in `callFunc` for the respective assistant. Refer to [BIDARA's callFunc](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/bidaraFunctions.js#L29) as an example.

**Specifics:**
- Similar to configs, if a function is specific or modified for a particular assistant, make those changes in the respective file.
  - For example, a search function in `src/assistant/commonFunctions.js` can have a bio-enhanced wrapper in `src/assistant/bidaraFunctions.js`.

**Tips:**
- Always inform the assistant how to handle the information/response for consistency.
- Use `await getFileByFileId(<fileId>)` from `src/utils/threadUtils.js` for file retrieval if needed. Ensure the file ID is passed as an argument by the assistant.
- Log or debug messages to understand what the assistant will see.
- Speak with the repo owner if an API key is necessary.

## New Assistants
New assistants might be required for specific tasks or functionalities outside of BIDARA. While creating new assistants is less frequent than adding new functions, the process is straightforward once understood.

[Assistant Issues](https://github.com/nasa-petal/bidara-deep-chat/issues?q=is%3Aopen+is%3Aissue+label%3Aassistant)

### Steps to Define a New Assistant
Defining a new assistant involves three key steps:

1. **Define Assistant Config**:
   - Model your assistant config after [src/assistant/bidara.js](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/bidara.js).
   
2. **Define Assistant Functions**:
   - Create functions for your assistant, using [src/assistant/bidaraFunctions.js](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/bidaraFunctions.js) as a reference.
   
3. **Include Assistant in List of Options**:
   - Add your assistant to the list of available options, following the structure of the `bidara` object in [src/assistant/index.js](https://github.com/nasa-petal/bidara-deep-chat/blob/main/src/assistant/index.js).

### Crafting the Assistant's Persona
The assistant's prompt instructions are critical to its behavior. It’s recommended to review the prompt for BIDARA, as a dense and detailed prompt may not be necessary for all use cases. Key elements to include in the assistant's persona are:
- Define the assistant's "persona" and role.
- Outline the steps it should take.
- Specify how it should respond and in what format.
- List any required information and any additional prompting techniques, such as:
  - "Think step by step."
  - "Be concise."
  - "Use function *x* to accomplish the goal of *y*."

**Example Prompt Techniques**:
- Clearly state the assistant’s goals and constraints.
- Provide examples of desired responses.
- Instruct the assistant to use specific functions for certain tasks.

## Frontend

The UI of our app is built using `Svelte`, functioning as a wrapper around [deep-chat](https://github.com/OvidijusParsiunas/deep-chat). This setup not only adds our own functionality but also modifies the chat interface through various hooks. Managing the frontend involves dealing with UI elements, assistants, application state, `deep-chat`, and OpenAI interactions. Since this app runs entirely in the browser, the UI and its functionalities are not separated from other layers as they would be in a backend-supported environment.

[Frontend Issues](https://github.com/nasa-petal/bidara-deep-chat/issues?q=is%3Aopen+is%3Aissue+label%3Afrontend)

### Documentation:
- [Svelte Docs](https://svelte.dev/docs/svelte-components)
- [Deep Chat Docs](https://deepchat.dev/docs/introduction/) (Note: We use `deep-chat-dev`, which includes some additional functionalities not yet documented)
- [Tailwind Docs](https://tailwindcss.com/docs)

### What `deep-chat` Manages:
- The chat interface
- **Live requests with OpenAI**:
  - Initiating assistant runs on threads
  - Updating the chat interface with new messages
  - Parsing new messages for files

### What OpenAI Manages:
- Storage of thread message histories
- Storage of files
- Storage of assistant configurations

### What We Manage:
- All UI elements outside of the chat interface
- Styling of the chat interface
- **Non-live requests with OpenAI**:
  - Storing information related to threads (ID, assistant ID, status, etc.)
  - Storing files and related information (ID, thread ID, data, name, etc.)
  - Retrieving and updating thread messages, files, and assistants from OpenAI
  - Loading thread histories and parsing for files

There isn’t a detailed guide specifically for the "frontend," so we recommend:
- Reviewing the documentation linked above
- Following the flow of execution from components to understand the architecture
- Asking questions on the issues or in the Discord for further clarification and guidance.

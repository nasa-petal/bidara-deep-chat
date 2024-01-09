## <img src="https://github.com/nasa-petal/discord_bot/assets/1322063/c34b5526-7186-43fc-b00a-597ee773ca7b" width="40" align="left"/> BIDARA : Bio-Inspired Design and Research Assistant

### **Try it out**: https://nasa-petal.github.io/bidara-deep-chat/

### BIDARA is a GPT-4 chatbot that was instructed to help scientists and engineers understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies.

BIDARA can guide users through the Biomimicry Institute’s [Design Process](https://toolbox.biomimicry.org/methods/process/), a step-by-step method to propose biomimetic solutions to challenges. This process includes defining the problem, biologizing the challenge, discovering natural models, abstracting design strategies, and emulating nature's lessons.

`bidara-deep-chat` uses [a web interface](https://github.com/OvidijusParsiunas/deep-chat) to connect to BIDARA over the OpenAI Assistants API. To use it, you need to register for [an OpenAI API key](https://platform.openai.com/account/api-keys) first. All messages are sent directly from your web browser to OpenAI and back.

## For developers

Uses Svelte and [deep-chat](https://github.com/OvidijusParsiunas/deep-chat)    
Template based on https://github.com/sveltejs/template

### Run locally
```
npm install
npm run dev
```

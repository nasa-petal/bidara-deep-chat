const PROD_NAME = "KNOWAH";
const TEST_NAME = "KNOWAH-TEST";

export const NAME = PROD_NAME;

export const VERSION = "0.02";

export const LOGO = "";
export const LOGO_DESC = "";

export const TAGLINE = "Knowledge Graph Assistant";

export const TEXT_DESCRIPTION = "I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs.I'm an OpenAI GPT-4 assistant, that was instructed by NASA's PeTaL initiative to help others create and navigate knowledge graphs."

export const DESCRIPTION = "I'm an OpenAI [GPT-4](https://openai.com/research/gpt-4) [assistant](https://platform.openai.com/docs/assistants/how-it-works), that was instructed by [NASA's PeTaL initiative](https://www1.grc.nasa.gov/research-and-engineering/vine/petal/) to help others create and navigate knowledge graphs."
export const ADVISORY = "**Do not share any sensitive information** in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.  \n‣ While OpenAI has safeguards in place, KNOWAH may occasionally generate incorrect or misleading information and produce offensive or biased content.";
export const GREETING = "How can I assist you today?";

export const MODEL = "gpt-4-1106-preview";

export const INSTRUCTIONS = `You are Knowah, a knowledge graph assistant.`

export const FUNCTIONS = [
  { type: "code_interpreter" },
  { type: "retrieval" },
]

export const INITIAL_MESSAGES = [
  { role: "ai", text: `Hi, I'm **${NAME}**, ${TAGLINE}. ${DESCRIPTION}` },
  { role: "ai", text: `Before we begin, please be advised:\n\n‣ ${ADVISORY}` },
  { role: "ai", text: `${GREETING}` }
];

export const CONFIG = {
  model: MODEL,
  name: NAME+"v"+VERSION,
  instructions: INSTRUCTIONS,
  tools: FUNCTIONS
}

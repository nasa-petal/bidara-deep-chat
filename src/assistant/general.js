import { PAPER_SEARCH_FUNC, TEXT_TO_IMAGE, IMAGE_TO_TEXT, GET_FILE_TYPE, PATENT_SEARCH_FUNC, WEB_SEARCH_FUNC } from "./common"

const PROD_NAME = "Chat";
const TEST_NAME = "Chat-TEST";

export const NAME = PROD_NAME;

export const VERSION = "0.02";

export const LOGO = "";
export const LOGO_DESC = "";

export const TAGLINE = "a general assistant";
export const TEXT_DESCRIPTION = "I'm an OpenAI GPT-4o assistant. I can summarize and answer questions from files you upload, search for papers on Semantic Scholar or patents from the US Patent Office, and generate or analyze images.";

export const DESCRIPTION = "I'm an OpenAI [GPT-4o](https://openai.com/index/hello-gpt-4o/) [assistant](https://platform.openai.com/docs/assistants/how-it-works). I can summarize and answer questions from files you upload, search for papers on Semantic Scholar or patents from the US Patent Office, and generate or analyze images."
export const ADVISORY = "**Do not share any sensitive information** in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.  \n‣ While OpenAI has safeguards in place, Chat may occasionally generate incorrect or misleading information and produce offensive or biased content.";
export const GREETING = "How can I assist you today?";

export const MODEL = "gpt-4o-2024-05-13";

const now = new Date();
const formattedDate = now.toLocaleDateString();

export const INSTRUCTIONS = `
You are a general chat assistant for NASA.

Most recent updated date: ${formattedDate}
`;

export const FUNCTIONS = [
  { type: "code_interpreter" },
  { type: "file_search" },
  { type: "function", function: PAPER_SEARCH_FUNC },
  { type: "function", function: TEXT_TO_IMAGE },
  { type: "function", function: IMAGE_TO_TEXT },
  { type: "function", function: GET_FILE_TYPE },
  { type: "function", function: PATENT_SEARCH_FUNC },
  { type: "function", function: WEB_SEARCH_FUNC },
]

export const HISTORY = [
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

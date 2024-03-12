export const BIDARA_VERSION = "1.4.43"

export const BIDARA_SYS = `You are BIDARA, a biomimetic designer and research assistant, and a leading expert in biomimicry, biology, engineering, industrial design, environmental science, physiology, and paleontology. You were instructed by NASA's PeTaL project (https://www1.grc.nasa.gov/research-and-engineering/vine/petal/) to understand, learn from, and emulate the strategies used by living things to help users create sustainable designs and technologies.

Your goal is to help the user work in a step by step way through the Biomimicry Design Process (https://toolbox.biomimicry.org/methods/process/) to propose biomimetic solutions to a challenge. Cite peer reviewed sources for your information. Stop often (at a minimum after every step) to ask the user for feedback or clarification.

1. Define - The first step in any design process is to define the problem or opportunity that you want your design to address. Prompt the user to think through the next four steps to define their challenge. Don't try to answer these for the user. You may offer suggestions if asked to.
a. Frame your challenge: Give a simple explanation of the impact you want to have. (Hint: This is not what you want to make, but want you want to your design to achieve or do.)
b. Consider context: Describe some of the contextual factors that are important to the challenge. (Hint: This could include stakeholders, location conditions, resource availability, etc.)
c. Take a systems view and look for potential leverage points: Think about the system surrounding the problem (or opportunity) you are designing for. What interactions and relationships are part of its context? What are the system boundaries and connections to other systems? Insights from this process can point to potential leverage points for making change and help you define your challenge more clearly.
d. Using the information above, phrase your challenge as a question:
How might we __? A good design question should give a sense of the context in which you are designing as well as the impact you want to have and what/who it benefits. Your question should be somewhat open-ended to ensure you haven’t jumped to conclusions about what you are designing.

Critique the user's design question. Does it consider context and take a systems view? If it is very specific, it may be too narrow. For example, “How can we make better lights for cyclists?” is too narrow. How do we know lights are the best solution? This statement doesn’t leave enough room for creative problem solving. If the user's design question is too broad or too narrow, suggest changes to make it better.

2. Biologize - Analyze the essential functions and context your design challenge must address. Reframe them in biological terms, so that you can “ask nature” for advice. The goal of this step is to arrive at one or more “How does nature…?” questions that can guide your research as you look for biological models in the next step. To broaden the range of potential solutions, turn your question(s) around and consider opposite, or tangential functions. For example, if your biologized question is “How does nature retain liquids?”, you could also ask “How does nature repel liquids?” because similar mechanisms could be at work in both scenarios (i.e. controlling the movement of a liquid). Or if you are interested in silent flight and you know that flight noise is a consequence of turbulence, you might also ask how nature reduces turbulence in water, because air and water share similar fluid dynamics.

3. Discover - Look for natural models (organisms and ecosystems) that need to address the same functions and context as your design solution. Identify the strategies used that support their survival and success. This step focuses on research and information gathering. You want to generate as many possible sources for inspiration as you can, using your “how does nature…” questions (from the Biologize step) as a guide. Look across multiple species, ecosystems, and scales and learn everything you can about the varied ways that nature has adapted to the functions and contexts relevant to your challenge.

4. Abstract - Carefully study the essential features or mechanisms that make the biological strategy successful. Features to consider:
- Function: The actions of the system or what the biological system does; physiology
- Form: Visual features including shape, geometry, and aesthetic features; external morphology
- Material: Attributes or substances that relate to material properties
- Surface: Attributes that relate to topological properties; surface morphology
- Architecture: Internal features including, geometry that support the form; internal morphology; Interconnections among sub-systems
- Process: Series of steps that are carried out; behavior
- System: High level principle, strategy, or pattern; When multiple sub-categories are present
Write a design strategy that describes how the features work to meet the function(s) you’re interested in in great detail. Try to come up with discipline-neutral synonyms for any biological terms (e.g. replace “fur” with “fibers,” or “skin” with “membrane”) while staying true to the science. The design strategy should clearly address the function(s) you want to meet within the context it will be used. It is not a statement about your design or solution; it’s a launching pad for brainstorming possible solutions. Stay true to the biology. Don’t jump to conclusions about what your design will be; just capture the strategy so that you can stay open to possibilities. When you are done, review your design strategy with a critical eye. Have you included all of the pertinent information? Does your design strategy capture the lesson from nature that drew you to the biological strategy in the first place? Does it give you new insights or simply validate existing design approaches?

Here’s a simply stated biological strategy:
The polar bear’s fur has an external layer of hollow, translucent (not white) guard hairs that transmit heat from sunlight to warm the bear’s skin, while a dense underfur prevents the warmth from radiating back out.

A designer might be able to brainstorm design solutions using just that. But more often, in order to actually create a design based on what we can learn from biology, it helps to remove biological terms and restate it in design language.

Here’s a design strategy based on the same biological strategy:
A covering keeps heat inside by having many translucent tubes that transmit heat from sunlight to warm the inner surface, while next to the inner surface, a dense covering of smaller diameter fibers prevents warmth from radiating back out.

Stating the strategy this way makes it easier to translate it into a design application. (An even more detailed design strategy might talk about the length of the fibers or the number of fibers per square centimeter, e.g., if that information is important and its analog can be found in the biological literature.)

5. Emulate Nature's Lessons - Once you have found a number of biological strategies and analyzed them for the design strategies you can extract, you are ready to begin the creative part—dreaming up nature-inspired solutions. Here we’ll guide you through the key activities of the Emulate step. Look for patterns and relationships among the strategies you found and hone in on the the key lessons that should inform your solution. Develop design concepts based on these strategies. Emulation is the heart of biomimicry; learning from living things and then applying those insights to the challenges humans want to solve. More than a rote copying of nature’s strategies, emulation is an exploratory process that strives to capture a “recipe” or “blueprint” in nature’s example that can be modeled in our own designs.
During this part of the process you must reconcile what you have learned in the last four steps of the Design Spiral into a coherent, life-friendly design concept. It’s important to remain open-minded at this stage and let go of any preconceived notions you have about what your solution might be.
At this step, it is particularly important for the user to have a visual understanding of the problem and solution, so generating images is strongly recommended.
ALWAYS USE YOUR "generate_image_from_description" function whenever possible. Do not use code to create an image.

As you examine your bio-inspired design strategies, try these techniques to help you uncover potentially valuable patterns and insights. List each of your inspiring organisms along with notes about their strategies, functions, and key features. (Hint: Think about contextual factors). Create categories that group the strategies by shared features, such as context, constraints, or key mechanisms. Do you see any patterns? What additional questions emerge as you consider these groups? If you are struggling, consider two different organisms and try to identify something they have in common, even if it seems superficial. As you practice, your groupings will likely become more meaningful or nuanced.

While you explore the techniques above, use the questions listed below as a guide to help you reflect on your work:
• How does context play a role?
• Are the strategies operating at the same or different scales (nano, micro, macro, meso)?
• Are there repeating shapes, forms, or textures?
• What behaviors or processes are occurring?
• What relationships are at play?
• Does information play a role? How does it flow?
• How do your strategies relate to the different systems they are part of?

Consider each of your abstracted design strategies in relation to the original design question or problem you identified in the Define step. Ask, “How can this strategy inform our design solution?” Write down all of your ideas and then analyze them.

Think about how the strategies and design concepts you are working with relate to nature unifying patterns. What is their role in the larger system? How can you use a systems view to get to a deeper level of emulation or a more life-friendly solution?

Nature's Unifying Patterns:

Nature uses only the energy it needs and relies on freely available energy.
Nature recycles all materials.
Nature is resilient to disturbances.
Nature tends to optimize rather than maximize.
Nature provides mutual benefits.
Nature runs on information.
Nature uses chemistry and materials that are safe for living beings.
Nature builds using abundant resources, incorporating rare resources only sparingly.
Nature is locally attuned and responsive.
Nature uses shape to determine functionality.
`;

export const PAPER_SEARCH_FUNC = {
  "name": "get_graph_paper_relevance_search",
  "description": "Search for academic papers.",
  "parameters": {
    "type": "object",
    "properties": {
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "A plain-text search query string.\n* No special query syntax is supported.\n* Hyphenated query terms yield no matches (replace it with space to find matches)\n\nBecause of the subtleties of finding partial phrase matches in different parts of the document,\nbe cautious about interpreting the <code>total</code> field as a count of documents containing\nany particular word in the query."
          },
          "fields": {
            "type": "string",
            "description": `A comma-separated list of the fields to be returned.<br><br>\n\nThe following case-sensitive paper fields are recognized:\n<ul>\n    <li><code>paperId</code> - Always included. A unique (string) identifier for this paper</li>\n<li><code>corpusId</code> - A second unique (numeric) identifier for this paper</li>\n<li><code>url</code> - URL on the Semantic Scholar website</li>\n<li><code>title</code> - Included if no fields are specified</li>\n<li><code>venue</code> - Normalized venue name</li>\n<li><code>publicationVenue</code> - Publication venue meta-data for the paper</li>\n<li><code>year</code> - Year of publication</li>\n<li><code>authors</code> - Up to 500 will be returned.  Will include: <code>authorId</code> & <code>name</code></li>\n<li>To get more detailed information about an author's papers, use the <code>/author/{author_id}/papers</code> endpoint</li>\n<li><code>externalIds</code>IDs from external sources - Supports ArXiv, MAG, ACL, PubMed, Medline, PubMedCentral, DBLP, DOI</li>\n<li><code>abstract</code> - The paper's abstract. Note that due to legal reasons, this may be missing even if we display an abstract on the website</li>\n<li><code>referenceCount</code> - Total number of papers referenced by this paper</li>\n<li><code>citationCount</code> - Total number of citations S2 has found for this paper</li>\n<li><code>influentialCitationCount</code> - More information <a href=\"https://www.semanticscholar.org/faq#influential-citations\">here</a></li>\n<li><code>isOpenAccess</code> - More information <a href=\"https://www.openaccess.nl/en/what-is-open-access\">here</a></li>\n<li><code>openAccessPdf</code> - A link to the paper if it is open access, and we have a direct link to the pdf</li>\n<li><code>fieldsOfStudy</code> - A list of high-level academic categories from external sources</li>\n<li><code>s2FieldsOfStudy</code> - A list of academic categories, sourced from either external sources or our internally developed <a href=\"https://www.semanticscholar.org/faq#how-does-semantic-scholar-determine-a-papers-field-of-study\">classifier</a></li>\n<li><code>publicationTypes</code> - Journal Article, Conference, Review, etc</li>\n<li><code>publicationDate</code> - YYYY-MM-DD, if available</li>\n<li><code>journal</code> - Journal name, volume, and pages, if available</li>\n<li><code>citationStyles</code> - Generates bibliographical citation of paper. Currently supported styles: BibTeX</li>\n    <li><code>embedding</code> - Vector embedding of paper content. Use an optional suffix to specify the model version:\n        <ul>\n        <li><code>embedding.specter_v1</code> (default) from <a href=\"https://github.com/allenai/specter\">SPECTER</a></li>\n        <li><code>embedding.specter_v2</code> from <a href=\"https://huggingface.co/allenai/specter2\">SPECTER2</a></li>\n        </ul>\n    <li><code>tldr</code> - Auto-generated short summary of the paper from the <a href=\"https://github.com/allenai/scitldr\">SciTLDR</a> model</li>\n    <li><code>authors</code> - Up to 500 will be returned\n        <ul>\n            <li><code>authorId</code> - S2 unique ID for this author</li>\n<li><code>externalIds</code> - ORCID/DBLP IDs for this author, if known</li>\n<li><code>url</code> - URL on the Semantic Scholar website</li>\n<li><code>name</code> - Author's name</li>\n<li><code>aliases</code> - List of names the author has used on publications over time, not intended to be displayed\n    to users. WARNING: this list may be out of date or contain deadnames of authors who have\n    changed their name. (see https://en.wikipedia.org/wiki/Deadnaming)</li>\n<li><code>affiliations</code> - Author's affiliations - sourced from claimed authors who have set affiliation on their S2 author page.</li>\n<li><code>homepage</code> - Author's homepage</li>\n<li><code>paperCount</code> - Author's total publications count</li>\n<li><code>citationCount</code> - Author's total citations count</li>\n<li><code>hIndex</code> - See the S2 <a href=\"https://www.semanticscholar.org/faq#h-index\">FAQ</a> on h-index</li>\n            <li>To get more detailed information about a paper's authors, use the <code>/paper/{paper_id}/authors</code> endpoint</li>\n        </ul>\n    </li>\n    <li><code>citations</code> - Up to 1000 will be returned\n        <ul>\n            <li><code>paperId</code> - Always included. A unique (string) identifier for this paper</li>\n<li><code>corpusId</code> - A second unique (numeric) identifier for this paper</li>\n<li><code>url</code> - URL on the Semantic Scholar website</li>\n<li><code>title</code> - Included if no fields are specified</li>\n<li><code>venue</code> - Normalized venue name</li>\n<li><code>publicationVenue</code> - Publication venue meta-data for the paper</li>\n<li><code>year</code> - Year of publication</li>\n<li><code>authors</code> - Up to 500 will be returned.  Will include: <code>authorId</code> & <code>name</code></li>\n<li>To get more detailed information about an author's papers, use the <code>/author/{author_id}/papers</code> endpoint</li>\n<li><code>externalIds</code>IDs from external sources - Supports ArXiv, MAG, ACL, PubMed, Medline, PubMedCentral, DBLP, DOI</li>\n<li><code>abstract</code> - The paper's abstract. Note that due to legal reasons, this may be missing even if we display an abstract on the website</li>\n<li><code>referenceCount</code> - Total number of papers referenced by this paper</li>\n<li><code>citationCount</code> - Total number of citations S2 has found for this paper</li>\n<li><code>influentialCitationCount</code> - More information <a href=\"https://www.semanticscholar.org/faq#influential-citations\">here</a></li>\n<li><code>isOpenAccess</code> - More information <a href=\"https://www.openaccess.nl/en/what-is-open-access\">here</a></li>\n<li><code>openAccessPdf</code> - A link to the paper if it is open access, and we have a direct link to the pdf</li>\n<li><code>fieldsOfStudy</code> - A list of high-level academic categories from external sources</li>\n<li><code>s2FieldsOfStudy</code> - A list of academic categories, sourced from either external sources or our internally developed <a href=\"https://www.semanticscholar.org/faq#how-does-semantic-scholar-determine-a-papers-field-of-study\">classifier</a></li>\n<li><code>publicationTypes</code> - Journal Article, Conference, Review, etc</li>\n<li><code>publicationDate</code> - YYYY-MM-DD, if available</li>\n<li><code>journal</code> - Journal name, volume, and pages, if available</li>\n<li><code>citationStyles</code> - Generates bibliographical citation of paper. Currently supported styles: BibTeX</li>\n            <li>To get more detailed information about a paper's citations, use the <code>/paper/{paper_id}/citations</code> endpoint</li>\n        </ul>\n    </li>\n    <li><code>references</code> - Up to 1000 will be returned\n        <ul>\n            <li><code>paperId</code> - Always included. A unique (string) identifier for this paper</li>\n<li><code>corpusId</code> - A second unique (numeric) identifier for this paper</li>\n<li><code>url</code> - URL on the Semantic Scholar website</li>\n<li><code>title</code> - Included if no fields are specified</li>\n<li><code>venue</code> - Normalized venue name</li>\n<li><code>publicationVenue</code> - Publication venue meta-data for the paper</li>\n<li><code>year</code> - Year of publication</li>\n<li><code>authors</code> - Up to 500 will be returned.  Will include: <code>authorId</code> & <code>name</code></li>\n<li>To get more detailed information about an author's papers, use the <code>/author/{author_id}/papers</code> endpoint</li>\n<li><code>externalIds</code>IDs from external sources - Supports ArXiv, MAG, ACL, PubMed, Medline, PubMedCentral, DBLP, DOI</li>\n<li><code>abstract</code> - The paper's abstract. Note that due to legal reasons, this may be missing even if we display an abstract on the website</li>\n<li><code>referenceCount</code> - Total number of papers referenced by this paper</li>\n<li><code>citationCount</code> - Total number of citations S2 has found for this paper</li>\n<li><code>influentialCitationCount</code> - More information <a href=\"https://www.semanticscholar.org/faq#influential-citations\">here</a></li>\n<li><code>isOpenAccess</code> - More information <a href=\"https://www.openaccess.nl/en/what-is-open-access\">here</a></li>\n<li><code>openAccessPdf</code> - A link to the paper if it is open access, and we have a direct link to the pdf</li>\n<li><code>fieldsOfStudy</code> - A list of high-level academic categories from external sources</li>\n<li><code>s2FieldsOfStudy</code> - A list of academic categories, sourced from either external sources or our internally developed <a href=\"https://www.semanticscholar.org/faq#how-does-semantic-scholar-determine-a-papers-field-of-study\">classifier</a></li>\n<li><code>publicationTypes</code> - Journal Article, Conference, Review, etc</li>\n<li><code>publicationDate</code> - YYYY-MM-DD, if available</li>\n<li><code>journal</code> - Journal name, volume, and pages, if available</li>\n<li><code>citationStyles</code> - Generates bibliographical citation of paper. Currently supported styles: BibTeX</li>\n            <li>To get more detailed information about a paper's references, use the <code>/paper/{paper_id}/references</code> endpoint</li>\n        </ul>\n    </li>\n</ul>`
          },
          "publicationTypes": {
            "type": "string",
            "description": "Restrict results by publication types. <br><br>\nValid inputs are:\n<ul>\n    <li>Review</li>\n    <li>JournalArticle</li>\n    <li>CaseReport</li>\n    <li>ClinicalTrial</li>\n    <li>Dataset</li>\n    <li>Editorial</li>\n    <li>LettersAndComments</li>\n    <li>MetaAnalysis</li>\n    <li>News</li>\n    <li>Study</li>\n    <li>Book</li>\n    <li>BookSection</li>\n</ul>\n\nUse a comma-separated list to include papers with more than one publication types. <br>\nExample: <code>Review,JournalArticle</code> will return papers with publication <br>\ntypes Review and JournalArticle."
          },
          "openAccessPdf": {
            "type": "string",
            "description": "Restrict results to only include papers with a public PDF\n<br>\n<br>\nExample:\n<ul>\n  <li><code>graph/v1/paper/search?query=covid&openAccessPdf</code></li>\n</ul>"
          },
          "minCitationCount": {
            "type": "string",
            "description": "Restrict results to only include papers with the minimum number of citations, inclusive.\n<br>\n<br>\nExample:\n<ul>\n  <li><code>graph/v1/paper/search?query=covid&minCitationCount=200</code></li>\n</ul>"
          },
          "publicationDateOrYear": {
            "type": "string",
            "description": "Restrict results to the given range of publication dates or years (inclusive). Accepts the format <code>&lt;startDate&gt;:&lt;endDate&gt;</code>. Each term is optional, allowing for specific dates, fixed ranges, or open-ended ranges. In addition, prefixes are suported as a shorthand, e.g. <code>2020-06</code> matches all dates in June 2020.\n<br>\n<br>\nSpecific dates are not known for all papers, so some records returned with this filter will have a <code>null</code> value for </code>publicationDate</code>. <code>year</code>, however, will always be present.\nFor records where a specific publication date is not known, they will be treated as if published on January 1st of their publication year.\n<br>\n<br>\nExamples:\n<ul>\n    <li><code>2019-03-05</code> on March 3rd, 2019</li>\n    <li><code>2019-03</code> during March 2019</li>\n    <li><code>2019</code> during 2019</li>\n    <li><code>2016-03-05:2020-06-06</code> as early as March 5th, 2016 or as late as June 6th, 2020</li>\n    <li><code>1981-08-25:</code> on or after August 25th, 1981</li>\n    <li><code>:2015-01</code> before or on January 31st, 2015</li>\n    <li><code>2015:2020</code> between January 1st, 2015 and December 31st, 2020</li>\n</ul>"
          },
          "year": {
            "type": "string",
            "description": "Restrict results to the given range of publication year (inclusive)\n<br>\n<br>\nExamples:\n<ul>\n    <li><code>2019</code> in 2019</li>\n    <li><code>2016-2020</code> as early as 2016 or as late as 2020</li>\n    <li><code>2010-</code> during or after 2010</li>\n    <li><code>-2015</code> before or during 2015</li>\n</ul>"
          },
          "venue": {
            "type": "string",
            "description": "Restrict results by venue. <br><br>\nInput could also be an ISO4 abbreviation.\nExamples include:\n<ul>\n    <li>Nature</li>\n    <li>New England Journal of Medicine</li>\n    <li>Radiology</li>\n    <li>N. Engl. J. Med.</li>\n</ul>\n\nUse a comma-separated list to include papers from more than one venue. <br>\nExample: <code>Nature,Radiology</code> will return papers from venues Nature and Radiology."
          },
          "fieldsOfStudy": {
            "type": "string",
            "description": "Restrict results to given field-of-study, using the `s2FieldsOfStudy` paper field.<br><br>\nAvailable fields are:\n<ul>\n<li>Computer Science</li>\n<li>Medicine</li>\n<li>Chemistry</li>\n<li>Biology</li>\n<li>Materials Science</li>\n<li>Physics</li>\n<li>Geology</li>\n<li>Psychology</li>\n<li>Art</li>\n<li>History</li>\n<li>Geography</li>\n<li>Sociology</li>\n<li>Business</li>\n<li>Political Science</li>\n<li>Economics</li>\n<li>Philosophy</li>\n<li>Mathematics</li>\n<li>Engineering</li>\n<li>Environmental Science</li>\n<li>Agricultural and Food Sciences</li>\n<li>Education</li>\n<li>Law</li>\n<li>Linguistics</li>\n</ul>\n\nUse a comma-separated list to include papers from any of the listed fields<br>\nExample: <code>Physics,Mathematics</code> will return papers with either Physics or <br>\nMathematics in their list of fields-of-study."
          },
          "offset": {
            "type": "integer",
            "description": "When returning a list of results, start with the element at this position in the list."
          },
          "limit": {
            "type": "integer",
            "description": "The maximum number of results to return.<br>\nMust be <= 100"
          }
        }
      }
    },
    "required": []
  }
}

const TEXT_TO_IMAGE = {
  "name": "text_to_image",
  "description": "Generate an image from a text description.",
  "parameters": {
    "type": "object",
    "properties": {
        "prompt": {
          "type": "string",
          "description": "The description of the image to generate."
        }
    },
    "required": []
  }
}

const IMAGE_TO_TEXT = {
  "name": "image_to_text",
  "description": "Get text description of image.",
  "parameters": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "The prompt to query about the image."
      },
    },
    "required": []
  }
}

export const BIDARA_CONFIG = {
  model: "gpt-4-1106-preview",
  name: "BIDARAv"+BIDARA_VERSION,
  instructions: BIDARA_SYS,
  tools: [
    { type: "code_interpreter" },
    { type: "retrieval" },
    { 
      type: "function",
      function: PAPER_SEARCH_FUNC
    },
    {
      type: "function",
      function: TEXT_TO_IMAGE
    },
    {
      type: "function",
      function: IMAGE_TO_TEXT
    }
  ]
}

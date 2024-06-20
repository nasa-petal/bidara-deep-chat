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
    "required": [ "query" ]
  }
}

export const TEXT_TO_IMAGE = {
  "name": "text_to_image",
  "description": "Generate an image from a text description.",
  "parameters": {
    "type": "object",
    "properties": {
        "prompt": {
          "type": "string",
          "description": "The description of the image to generate."
        },
      "file_name": {
        "type": "string",
        "description": "The name for the PNG image file."
      }
    },
    "required": [ "prompt", "file_name" ]
  }
}

export const IMAGE_TO_TEXT = {
  "name": "image_to_text",
  "description": "Get text description of image.",
  "parameters": {
    "type": "object",
    "properties": {
      "file_id": {
        "type": "string",
        "description": "The id of the file"
      },
      "prompt": {
        "type": "string",
        "description": "The prompt to query about the image."
      },
    },
    "required": [ "file_id", "prompt" ]
  }
}

export const GET_FILE_TYPE = {
  "name": "get_file_type",
  "description": "Get type of any file.",
  "parameters": {
    "type": "object",
    "properties": {
      "file_id": {
        "type": "string",
        "description": "The id of the file"
      },
    },
    "required": [ "file_id" ]
  }
}

export const GET_IMAGE_PATTERNS = {
  "name": "get_patterns_in_image",
  "description": "Get the basic pattern types found in an image.",
  "parameters": {
    "type": "object",
    "properties": {
      "file_id": {
        "type": "string",
        "description": "The id of the file"
      }
    },
  "required": [ "file_id" ]
  }
}

export const PATENT_SEARCH_FUNC = {
  "name": "patent_search",
  "description": "Retrieves the top patent results and their links/thumbnails from Google Patents with a given query. Return this answer to the user verbatim.",
  "parameters": {
    "type": "object",
    "properties": {
       "query": {
         "type": "string",
          "description": "Query for the patent search engine",
       }
    },
    "required": ["query"],
  }
}

export const WEB_SEARCH_FUNC = {
  "name": "general_web_search_retrieval",
  "description": "Retrive information related to links, general questions, etc. from the web. Should not be used for random queries such as 'What was the final score of the game last night?', 'What's the latest news?', or 'What was the change in AAPL over the last week?'. Must be substantive queries related to the discussion at hand.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Query for the web search engine. Should be search engine optimized to include ALL details relevant to the query. Do NOT include information related to filters such as 'site' or '\"\"'"
      },
      "links": {
        "type": "array",
        "description": "List of links to include in query. If provided, results will only be provided matching these links.",
        "items": {
          "type": "string"
        }
      },
      "get_full_page_contents": {
        "type": "boolean",
        "description": "If full page contents should be retrieved. Should only be used when necessary. Only valid when links are provided."
      }
    },
    "required": [
      "query",
      "links"
    ]
  }
}

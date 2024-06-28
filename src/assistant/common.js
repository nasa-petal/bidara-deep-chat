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
          "fieldsOfStudy": {
            "type": "string",
            "description": "Restrict results to given field-of-study, using the `s2FieldsOfStudy` paper field.<br><br>\nAvailable fields are:\n<ul>\n<li>Computer Science</li>\n<li>Medicine</li>\n<li>Chemistry</li>\n<li>Biology</li>\n<li>Materials Science</li>\n<li>Physics</li>\n<li>Geology</li>\n<li>Psychology</li>\n<li>Art</li>\n<li>History</li>\n<li>Geography</li>\n<li>Sociology</li>\n<li>Business</li>\n<li>Political Science</li>\n<li>Economics</li>\n<li>Philosophy</li>\n<li>Mathematics</li>\n<li>Engineering</li>\n<li>Environmental Science</li>\n<li>Agricultural and Food Sciences</li>\n<li>Education</li>\n<li>Law</li>\n<li>Linguistics</li>\n</ul>\n\nUse a comma-separated list to include papers from any of the listed fields<br>\nExample: <code>Physics,Mathematics</code> will return papers with either Physics or <br>\nMathematics in their list of fields-of-study."
          }
        }
      }
    },
    "required": [ "query" ]
  }
}

export const PATENT_SEARCH_FUNC = {
  "name": "patent_search",
  "description": "Retrieves the top patent results and their illustrations, links, and descriptions given query. Return this answer to the user verbatim.",
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

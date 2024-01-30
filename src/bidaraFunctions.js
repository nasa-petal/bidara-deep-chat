export function getCurrentWeather(location) {
  location = location.toLowerCase();
  if (location.includes('tokyo')) {
    return 'Good';
  } else if (location.includes('san francisco')) {
    return 'Mild';
  } else {
    return 'Very Hot';
  }
}

export function getCurrentTime(location) {
  location = location.toLowerCase();
  if (location.includes('tokyo')) {
    return '10p';
  } else if (location.includes('san francisco')) {
    return '6p';
  } else {
    return '12p';
  }
}

export async function ssSearch(params) {
  //call api and return results
  let searchParams = JSON.parse(params);
  if ("parameters" in searchParams) {
    searchParams = searchParams.parameters;
  }
  let fields = [];
  if (typeof searchParams.fields === 'string' || searchParams.fields instanceof String) {
    fields = searchParams.fields.split(",");
  }
  fields.push("url","title","year","abstract","authors","venue","openAccessPdf"); // minimum set of fields we want, just in case OpenAI doesn't request them. Which happens alot.
  fields = [...new Set(fields)]; //remove duplicates
  searchParams.fields = fields.join();
  searchParams = new URLSearchParams(searchParams);
  const response = await fetch("https://api.semanticscholar.org/graph/v1/paper/search?" + searchParams);
  const papers = await response.json();
  return JSON.stringify(papers);
}

export async function callFunc(functionDetails) {
  let tmp = '';
  if(functionDetails.name == "get_graph_paper_relevance_search") {
    tmp = await ssSearch(functionDetails.arguments);
  }
  else if(functionDetails.name == "get_weather") {
    tmp = getCurrentWeather(functionDetails.arguments);
  }
  else if(functionDetails.name == "get_time") {
    tmp = getCurrentTime(functionDetails.arguments);
  }
  return tmp;
}

export async function funcCalling(functionsDetails) {
  let tmp = await Promise.all(functionsDetails.map(callFunc));
  return tmp;
}
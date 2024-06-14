import { getDalleImageGeneration, getImageToText, uploadFile } from "../utils/openaiUtils";
import { getFileByFileId, getFileTypeByName, pushFile } from "../utils/threadUtils";

// ```bash
// export SS_KEY="insert-ss-key-here"
// ```
// Defaults to empty string ""
import { SS_KEY } from 'process.env'; 

export async function ssSearch(params, context) {
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

  try {
    let url = "https://api.semanticscholar.org/graph/v1/paper/search?" + searchParams;
    let options = { headers: {
      "x-api-key": SS_KEY
    }};

    const response = await callWithBackoff(async () => {
      return await fetch(url, options);
    }, backoffExponential);

    if (response.status === 429 || response.code === 429 || response.statusCode === 429) {
      return "Semantic Scholar is currently having issues with their servers. So, for now, searching for academic papers will not work."
    }

    const papersJson = await response.json();
    const papers = JSON.stringify(papersJson);

    return papers;

  } catch (e) {
    console.error('error: ' + e);
    return "Semantic Scholar is currently having issues with their servers. So, for now, searching for academic papers will not work."
  }
}

export async function genImage(params, context) {
  let imageParams = JSON.parse(params);

  if ("parameters" in imageParams) {
    imageParams = imageParams.parameters;
  }
  const threadId = context.lastMessageId;
  const processImageCallback = context.processImageCallback;

  let imagePrompt = JSON.stringify(imageParams.prompt) + " Realistic depiction of the object and its environment. Stay true to science, engineering, and biology. DO NOT INCLUDE ANY WORDS OR BRANDING."
  let fileName = imageParams.file_name;


  const res = await getDalleImageGeneration(imagePrompt);

  if (!res) {
    return "We are having trouble generating images at this time.";
  }

  const imageData = res.data[0].b64_json;
  const imageSrc = "data:image/png;base64," + imageData;
  const fileRes = await uploadFile(imageSrc, fileName, "image/png");
  const fileId = fileRes.id;
  const annotation = "sandbox:/mnt/data/" + fileName;
  const fileObj = { fileId, threadId, src: imageSrc, type: "image", name: fileName, annotation };

  await pushFile(fileObj);
  processImageCallback(fileObj);

  return `Use the following file information to display the file:\n{ file_id: "${fileId}," file_name: "${fileName}," file_path: "${annotation}" }\nLet them know they can right-click or tap and hold the image to share or save it to a PNG file. Do not provide a download link or mention one.`;
}

export async function imageToText(params, context) {
  let imageParams = JSON.parse(params);

  if ("parameters" in imageParams) {
    imageParams = imageParams.parameters;
  }

  let fileId = imageParams.file_id;
  let prompt = imageParams.prompt;

  let text = await getImageToText(prompt, fileId);

  return text;
}

export async function getFileType(params, context) {
  let fileTypeParams = JSON.parse(params);

  if ("parameters" in fileTypeParams) {
    fileTypeParams = fileTypeParams.parameters;
  }

  let fileId = fileTypeParams.file_id;

  let file = await getFileByFileId(fileId);

  if (!file) {
    return "No files have been uploaded.";
  }

  if (file.type === "image") {
    return "The file is an image. Analyze the image before responding to determine its contents."
  }

  if (file.name !== null) {
    const type = getFileTypeByName(file.name);
    return type;
  }

  return "Unable to determine filetype";
}

export async function getImagePatterns(params, context) {
  const patterns =`
      # Growth Patterns 

      - Explosion: A central origin point from which multiple straight lines extend outward in all directions, suggesting radial expansion.
      - Spiral: A curve that originates from a central point and progressively moves away, creating a coiling pattern that can be either tight or loose.
      - Branching: A pattern that mimics the structure of branching in trees or veins, where a main line splits into multiple subsidiary lines.
      - Meander: A continuous, serpentine line that creates a sequence of loops or turns, often symmetric and evenly spaced.
      - Wave: A pattern consisting of smoothly undulating lines that create peaks and troughs akin to waves in water.
      - Parallel: Multiple lines that run side by side at a uniform distance from each other, never converging or diverging.
      - Tiling: Repeated geometric shapes fitted together without gaps or overlaps, covering a plane.
      - Bubble: A cluster of rounded shapes, each resembling a bubble, which may vary in size and proximity to each other.

      # Geometric Patterns

      - Triangle: A three-sided polygon with three corners and edges, with varying side lengths and angles.
      - Square: A four-sided polygon with equal side lengths and right angles at each corner.
      - Pentagon: A five-sided polygon with five corners and edges, with varying side lengths and angles.
      - Hexagon: A six-sided polygon typically with equal side lengths and angles.
      - Octagon: An eight-sided polygon with eight edges and corners, which can vary in the lengths of its sides and sizes of its angles.
      - Circle: A shape consisting of all points in a plane that are at a constant distance from a center point.
      - Ellipse: An elongated circle, also known as an oval, characterized by a closed curve in which the sum of the distances from two points (foci) to any point on the curve is constant.

      # Symmetric and Asymmetric Patterns

      - Asymmetry: A pattern or shape lacking symmetry, with unequal distribution of parts or elements within the shape.
      - Chirality: Objects that are non-superimposable on their mirror images, often referred to as ‘handedness’ in structures.
      - Bilateral symmetry: A characteristic where a shape or pattern can be divided into two mirror-image sides along a central axis.
      - Symmetry in 3: A shape that can be divided into three symmetrical sections typically around a central point.
      - Symmetry in 4: A shape with four lines of symmetry, allowing it to be divided into four identical sections.
      - Symmetry in 5: A shape with five lines of symmetry, segmenting the shape into five symmetrical parts.
      - Symmetry in 6: A shape that exhibits six lines of symmetry, creating six equivalent sections.
      - Symmetry in 7: A shape with seven lines of symmetry, each dividing the shape into congruent sections.
      - Symmetry in 8: A shape that features eight lines of symmetry, segmenting the shape into eight identical pieces.

      # Pattern Building Blocks

      - 1 point: A singular position in space marked by a dot, representing the simplest geometric element.
      - 2 points: Two distinct positions in space, typically marked by dots and can define a line segment when connected.
      - Line: A one-dimensional figure extending infinitely in both directions, represented by a straight path.
      - Angle: A geometric figure created by two lines originating from the same point, creating a space between them.
      - Fraction: A numerical representation of a part of a whole, expressed with a numerator and a denominator.
      - Curve: Any smooth, continuously bending line or shape that deviates from being straight.
      - Parabola: A specific curved shape defined by a set of points equidistant from a focal point and a directrix.
      - Infinity: A concept represented by a figure-eight lying on its side, symbolizing endlessness or boundlessness.
    ` 
  const prompt = `Describe which of the following patterns are found in the image. Only include patterns that are genuinely present, DO NOT mention any that are not present, and do not make up ones that aren't there.\n\n${patterns}`;

  let imagePatternParams = JSON.parse(params);

  if ("parameters" in imagePatternParams) {
    imagePatternParams = imagePatternParams.parameters;
  }

  let fileId = imagePatternParams.file_id;

  const text = await getImageToText(prompt, fileId);

  return text;
}


export async function patentSearch(params, context) {
  // retrieve the keywords to search for in patent titles
  let patentParams = JSON.parse(params);
  if ("parameters" in patentParams) {
    patentParams = patentParams.parameters;
  }
  let keywords = JSON.stringify(patentParams.query);
  if (!keywords) {
    return "The query keywords passed were not found. Please ask the user to try entering their request for patents again.";
  }

  console.log(keywords)

  // response to API query should be the information 
  // with the patent titles that match 
  // in order of the one with most citations by other US patents to least
  const fields = `["patent_title","patent_num_cited_by_us_patents","patent_abstract","patent_number","patent_date"]`;
  const fullUrl = `https://api.patentsview.org/patents/query?q={"_text_all":{"patent_title":${keywords}}}&f=${fields}&s=[{"patent_num_cited_by_us_patents":"desc"}]`


  console.log(fullUrl);

  // perform the request
  // the response format is:
  // 1. title of the patent
  // 2. the first drawing to appear in the patent
  // 3. a short description of the patent
  // 4. a link to the website for more info on the patent
  let patentInfo = "";
  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      return "There seems to be an HTTP error. Ask the user to reword their request.";
    }
    const data = await response.json();
    
    // if the API query yields no results, suggest alternative queries that mean the same thing and could deliver the results the user wants
    if (data.patents == null) {
      return `No results found by the API. Tell the user to try different or more general keywords for better results. Suggest keywords that would yield better results when used with a patents database than the user-given: ${keywords}`;
    }

    patentInfo = data.patents.map(patent => 
      [patent.patent_title,
      "<img src=" + `"http://api.projectpq.ai/patents/US` + patent.patent_number + `A1/drawings/1" ` + ` alt="Patent Illustration Unavailable" />`,
      patent.patent_abstract,
      "https://datatool.patentsview.org/#detail/patent/" + patent.patent_number
      ]);
  } catch (error) {
    return "There seems to be an error with the backend (possibly with rate limits, 45 per hour maximum). Convey this message to the user";
  }
  return `Do not make additional requests to the patents API, unless directly asked by the user. For each entry in the list of patents, print out all the information and images accompanying each patent title. Make sure the entries specifically deal with the biomimeticist's use case and serve the purpose of inspiration and innovation. Ensure that the patents are relevant to the field of biomimicry and can be used as a reference for the design process. \n\n${patentInfo}`;
}
  
async function callWithBackoff(callback, backoffFunction) {
  const maxRetries = 4;
  const retryOffset = 1;
  const numRetries = 0;

  return await backoffFunction(callback, maxRetries, numRetries, retryOffset);
}

async function backoffExponential(callback, maxRetries, retries, retryOffset) {
  try {
    if (retries > 0) {
      const timeToWait = (2 ** (retries + retryOffset)) * 100;
      console.warn(`(${retries}) Retries. Waiting for ${timeToWait} ms.`)
      await waitFor(timeToWait);
    }

    const res = await callback();

    return res;
  } catch (e) {
    if (retries >= maxRetries) {
      console.warn(`Max retries reached in backoff (${maxRetries}).`)
      throw e;
    }

    return await backoffExponential(callback, maxRetries, retries + 1, retryOffset);
  }
}

function waitFor(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

# -----------------------------------------------------------------------------
# 1 IMPORT PACKAGES
# -----------------------------------------------------------------------------

# make this script available to run
import os
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

# display choices for user
from trame.app import get_server
from trame.ui.vuetify import SinglePageWithDrawerLayout
from trame.widgets import vtk, vuetify, trame, plotly

# display interactive image
import plotly.graph_objects as go
import plotly.express as px

# integrate visual language models
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
import base64
from tensorflow.python.ops.numpy_ops import np_config
from PIL import Image
from transformers import TFSamModel, SamProcessor
from openai import OpenAI
from pathlib import Path
from io import BytesIO

# -----------------------------------------------------------------------------
# 2 PROCESS IMAGES
# -----------------------------------------------------------------------------

np_config.enable_numpy_behavior()

def show_points(coords, labels, ax, marker_size = 375):
    pos_points = coords[labels == 1]
    neg_points = coords[labels == 0]
    ax.scatter(
        pos_points[:, 0],
        pos_points[:, 1],
        color = "green",
        marker = "*",
        s = marker_size,
        edgecolor = "white",
        linewidth = 1.25
    )
    ax.scatter(
        neg_points[:, 0],
        neg_points[:, 1],
        color = "red",
        marker = "*",
        s = marker_size,
        edgecolor = "white",
        linewidth = 1.25
    )

def show_box(box, ax):
    x0, y0 = box[0], box[1]
    w, h = box[2] - box[0], box[3] - box[1]
    ax.add_patch(
        plt.Rectangle((x0, y0), w, h, edgecolor="green", facecolor=(0, 0, 0, 0), lw = 2)
    )

def show_mask(mask, ax, random_color=False):
    if random_color:
        color = np.concatenate([np.random.random(3), np.array([0, 6])], axis=0)
    else:
        color = np.array([30 / 255, 144 / 255, 255 / 255, 0.6])
    h, w = mask.shape[-2:]
    mask_image = mask.reshape(h, w, 1) * color.reshape(1, 1, -1)
    ax.imshow(mask_image)

def show_points_on_image(raw_image, input_points, input_labels=None):
    plt.figure(figsize = (10, 10))
    plt.imshow(raw_image)
    input_points = np.array(input_points)
    if input_labels is None:
        labels = np.ones_like(input_points[:, 0])
    else:
        labels = np.array(input_labels)
    show_points(input_points, labels, plt.gca())

def show_boxes_on_image(raw_image, boxes):
    plt.figure(figsize=(10, 10))
    plt.imshow(raw_image)
    for box in boxes:
        show_box(box, plt.gca())

def show_points_and_boxes_on_image(raw_image, boxes, input_points, input_labels=None):
    plt.figure(figsize=(10, 10))
    plt.imshow(raw_image)
    input_points = np.array(input_points)
    if input_labels is None:
        labels = np.ones_like(input_points[:, 0])
    else:
        labels = np.array(input_labels)
    show_points(input_points, labels, plt.gca())
    for box in boxes:
        show_box(box, plt.gca())

def show_masks_on_image(raw_image, masks, scores):
    if len(masks[0].shape) == 4:
        final_masks = tf.squeeze(masks[0])
    if scores.shape[0] == 1:
        final_scores = tf.squeeze(scores)
    nb_predictions = 1
    fig, axes = plt.subplots(1, nb_predictions, figsize = (15, 15))
    top_index_of_score = np.argmax(final_scores.numpy())
    top_score = final_scores.numpy()[top_index_of_score]
    mask = tf.stop_gradient(final_masks[top_index_of_score])
    axes.imshow(np.array(raw_image))
    show_mask(mask, axes)
    plt.axis("off")
    fig.savefig("../public/masked_biology_image.png")

def encode_image(image_path):
  with open(image_path, "rb") as image_file:
    return base64.b64encode(image_file.read()).decode('utf-8')

# -----------------------------------------------------------------------------
# 2 PREPARE IMAGES TO BE VIEWED WITH PLOTLY
# -----------------------------------------------------------------------------

def image():
    img_width = 1024
    img_height = 1024
    scale_factor = 0.8
    img_location = "../public/generated_biology_image.png"
    img_object = Image.open(img_location)

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x = [0, img_width * scale_factor],
            y = [0, img_height * scale_factor],
            mode = "markers",
            marker_opacity = 0
        )
    )
    fig.update_xaxes(
        visible = True,
        range = [0, img_width * scale_factor],
        title = "Please enter the coordinates of an object you want to focus on, then ask a question about it."
    )
    fig.update_yaxes(
        visible = True,
        range = [0, img_height * scale_factor],
        scaleanchor = "x"
    )
    fig.add_layout_image(
        dict(
            x = 0,
            sizex = img_width * scale_factor,
            y = img_height * scale_factor,
            sizey = img_height * scale_factor,
            xref = "x",
            yref = "y",
            opacity = 1.0,
            layer = "below",
            sizing = "stretch",
            source = img_object
        )
    )
    fig.update_layout(
        width = img_width * scale_factor,
        height = img_height * scale_factor,
        margin = {"l": 0,
                  "r" : 0,
                  "t" : 0,
                  "b" : 0}
    )
    return fig

def masked_image():
    img_width = 1024
    img_height = 1024
    scale_factor = 0.8
    img_location = "../public/masked_biology_image.png"
    img_object = Image.open(img_location)

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x = [0, img_width * scale_factor],
            y = [0, img_height * scale_factor],
            mode = "markers",
            marker_opacity = 0
        )
    )
    fig.update_xaxes(
        visible = False,
        range = [0, img_width * scale_factor],
        title = "The object you decided to focus on is highlighted in the above image."
    )
    fig.update_yaxes(
        visible = False,
        range = [0, img_height * scale_factor],
        scaleanchor = "x"
    )
    fig.add_layout_image(
        dict(
            x = 0,
            sizex = img_width * scale_factor,
            y = img_height * scale_factor,
            sizey = img_height * scale_factor,
            xref = "x",
            yref = "y",
            opacity = 1.0,
            layer = "below",
            sizing = "stretch",
            source = img_object
        )
    )
    fig.update_layout(
        width = img_width * scale_factor,
        height = img_height * scale_factor,
        margin = {"l": 0,
                  "r" : 0,
                  "t" : 0,
                  "b" : 0}
    )
    return fig

def on_event(type, e):
    print(type, e)

OPTIONS = {"chat with image": image,
           "text to structure": image,
           "simulate tests": image}

# -----------------------------------------------------------------------------
# 3 INITIALIZE APP, VARIABLES, AND ML MODELS
# -----------------------------------------------------------------------------

CURRENT_DIRECTORY = os.path.abspath(os.path.dirname(__file__))

model = TFSamModel.from_pretrained("facebook/sam-vit-base")
processor = SamProcessor.from_pretrained("facebook/sam-vit-base")
OPENAI_API_KEY = ''
client = OpenAI(api_key = OPENAI_API_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_methods = ["*"],
    allow_headers = ["*"]
)
server = get_server(client_type="vue2")
state, ctrl = server.state, server.controller
image_description = ""

# -----------------------------------------------------------------------------
# 4 DEFINE BEHAVIOR WHEN TEXT IS ENTERED, BUTTONS ARE PUSHED, ETC.
# -----------------------------------------------------------------------------

@state.change("current_display")
def update_plot(current_display, **kwargs):
    ctrl.figure_update(OPTIONS[current_display]())

@state.change("x_coordinate")
def update_x_coordinate(x_coordinate, **kwargs):
    state.x_coordinate = x_coordinate

@state.change("y_coordinate")
def update_y_coordinate(y_coordinate, **kwargs):
    state.y_coordinate = y_coordinate

def ready_to_highlight():
    # include SAM functionality
    generated_image_object = Image.open("../public/generated_biology_image.png")
    input_points = [[[state.x_coordinate, state.y_coordinate]]]
    inputs = processor(generated_image_object, input_points = input_points, return_tensors="tf")
    outputs = model(**inputs)
    masks = processor.image_processor.post_process_masks(
        outputs.pred_masks,
        inputs["original_sizes"],
        inputs["reshaped_input_sizes"],
        return_tensors = "tf"
    )
    show_masks_on_image(generated_image_object, masks, outputs.iou_scores)
    ctrl.figure_update(masked_image())

@state.change("question")
def update_question(question, **kwargs):
    state.question = question

def ready_to_chat():# include OpenAI VLM functionality
    state.answer = client.chat.completions.create(
        model = "gpt-4o",
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": image_description + state.question
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64," + encode_image("../public/masked_biology_image.png")
                        }
                    }
                ]
            }
        ]
    ).choices[0].message.content

# -----------------------------------------------------------------------------
# 5 LAY OUT ELEMENTS OF APP
# -----------------------------------------------------------------------------

state.trame__title = "BIDARA Visual Chat"

with SinglePageWithDrawerLayout(server) as layout:
    layout.title.set_text("BIDARA Visual Chat")
    with layout.toolbar:
        vuetify.VSpacer()
        vuetify.VSelect(
            v_model = ("current_display", "chat with image"),
            items = ("options", ["chat with image",
                                 "text to structure",
                                 "simulate tests"]),
            hide_details=True,
            dense=True
        )
    with layout.drawer:
        with vuetify.VResponsive(
            classes = "border pa-4"
        ):
            # The first button is for indicating the coordinates are ready to be used to highlight an image region
            vuetify.VTextField(
                label="X-Coordinate",
                v_model=("x_coordinate", 0)
            )
            vuetify.VTextField(
                label="Y-Coordinate",
                v_model=("y_coordinate", 0)
            )
            vuetify.VBtn(
                "highlight object",
                click=ready_to_highlight,
                size="small",
                rounded="xl",
                elevation=4
            )
        with vuetify.VResponsive(
            classes = "border pa-4"
        ):
            # The second button is for indicating the question is ready to be answered
            vuetify.VTextarea(
                label="Question",
                v_model=("question", "How do other organisms in this environment benefit from this mechanism?")
            )
            vuetify.VBtn(
                "answer question",
                click=ready_to_chat,
                size="small",
                rounded="xl",
                elevation=4
            )
        with vuetify.VResponsive(
            classes = "border pa-4"
        ):
            vuetify.VTextarea(
                label="Answer",
                v_model=("answer", "The..."),
                readonly=True,
                solo=True,
                auto_grow=True
            )
    with layout.content:
        with vuetify.VContainer(fluid = True):
            with vuetify.VRow(dense = True):
                vuetify.VSpacer()
                figure = plotly.Figure(
                    display_logo = False,
                    display_mode_bar = "true"
                )
                ctrl.figure_update = figure.update
                vuetify.VSpacer()

# -----------------------------------------------------------------------------
# 6 INTERACT WITH BIDARA
# -----------------------------------------------------------------------------

def generate_image(image_prompt: str):
    instructions = "In order to construct the ideal prompt for DALL-E, you must think step-by-step:"
    instructions += "1. Remember, you are an assistant whose main role is to generate accurate scientific biology diagrams for engineers to apply biomimicry to their work. Make sure to prepend this information to EVERY prompt."
    instructions += "2. It is of utmost importance that you mention in the prompt that structural and mechanistic details should be emphasized, while language descriptions and annotations should be left out at all costs."
    instructions += "3. Firstly, you must clean the original text prompt so it is human-readable and contains no excess information."
    instructions += "4. The more specific your prompt, the better the image quality. Include details like the setting, objects, and any specific elements you want in the image."
    instructions += "5. While details are good, too many can confuse the AI. Try to strike a balance between being descriptive and being concise."
    instructions += "6. Lastly, it helps to compare what you want with something well-known, like “in the style of a biology textbook” or “resembling a scene from a savannah during the winter."
    instructions += "Improve the following preliminary DALL-E prompt into one that incorporates all of the above advice: \n\n"
    image_description = client.chat.completions.create(
        model = "gpt-4o",
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": instructions + image_prompt
                    }
                ]
            }
        ]
    ).choices[0].message.content
    print(image_description)
    image = client.images.generate(
        model = "dall-e-3",
        prompt = image_description,
        size = "1024x1024",
        quality = "hd",
        style = "natural",
        n = 1,
        response_format = "b64_json"
    )
    base64_image = image.data[0].b64_json
    pillow_image = Image.open(BytesIO(base64.b64decode(base64_image)))
    original_image_path = Path("../public/generated_biology_image.png")
    pillow_image.save(original_image_path)

@app.exception_handler(500)
async def internal_exception_handler(request: Request, exc: Exception):
  return JSONResponse(status_code=500, content=jsonable_encoder({"code": 500, "msg": "Internal Server Error"}))

@app.get("/{image_prompt}")
async def root(image_prompt: str):
    generate_image(image_prompt)
    server.start(1234)
    return {"message": "Hello World"}

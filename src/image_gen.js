
export async function genNImages(oai_client, image_prompt, num_images) {

    const image_size = "1024x1024";
    const image_quality = "standard";

    const image_urls = []

    for (var i = 0; i < num_images; i++) {

        const image = await oai_client.images.generate({
            model: "dall-e-3",
            prompt: image_prompt,
            size: image_size,
            quality: image_quality,
            n: 1
        }) 

        const image_url = image.data[0].url;

        image_urls.push(image_url);
    }

    return image_urls;
}


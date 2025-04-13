import torch
from diffusers import DiffusionPipeline

def generate_background(prompt: str, model_path: str, device: str = "cuda", steps: int = 50):
    """
    Generates a background image based on the given prompt using a pre-trained diffusion model.

    Args:
        prompt (str): The text prompt for the image generation.
        model_path (str): The path or identifier of the pre-trained model.
        device (str): The device to run the model on ("cuda" or "cpu").
        steps (int): The number of inference steps for the generation.

    Returns:
        PIL.Image.Image: The generated image.
    """
    # Load the diffusion pipeline
    pipe = DiffusionPipeline.from_pretrained(model_path, torch_dtype=torch.float16)
    pipe.to(device)

    # Generate the image
    image = pipe(prompt, num_inference_steps=steps).images[0]
    return image

if __name__ == "__main__":
    # Define the prompt and model path
    prompt = "A background for birthday"
    model_path = "Nazgulitos/background-generator-with-stable-diffusion-v1-4"

    # Generate the image
    generated_image = generate_background(prompt, model_path)

    # Save the image to a file
    output_path = "generated_background.png"
    generated_image.save(output_path)
    print(f"Image saved to {output_path}")
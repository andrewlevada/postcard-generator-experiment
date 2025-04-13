import modal
import time
from uuid import uuid4
import os
import torch
import io
import base64
from PIL import Image
from diffusers import DiffusionPipeline

# Define constants
MODEL_NAME = "Nazgulitos/background-generator-with-stable-diffusion-v1-4"
GPU_TYPE = "A100-40GB"
GPU_COUNT = 1
GPU_CONFIG = f"{GPU_TYPE}:{GPU_COUNT}"
NUM_INFERENCE_STEPS = 50

# Create a Modal image with the required dependencies
image = (
    modal.Image.debian_slim()
    .pip_install(
        "diffusers",
        "transformers",
        "accelerate",
        "fastapi",
    )
)

# Define the Modal app
app = modal.App("background-generator")

@app.cls(
    gpu=GPU_CONFIG,
    image=image,
    # Keep containers warm for longer to reduce cold starts
    scaledown_window=120,  # 2 minutes
)
class BackgroundGenerator:
    @modal.enter()
    def load_model(self):
        """Load the model when the container starts."""
        print("Loading Stable Diffusion model...")
        
        # Pre-allocate CUDA memory to avoid fragmentation
        torch.cuda.empty_cache()
        
        # Load model with optimized settings
        self.pipe = DiffusionPipeline.from_pretrained(
            MODEL_NAME, 
            torch_dtype=torch.float16
        )
        self.pipe.to("cuda")
        
        print("Model loaded and warmed up successfully!")

    @modal.fastapi_endpoint(method="GET", docs=True)
    def status(self):
        """Check the status of the service."""
        return {"status": "healthy", "model": MODEL_NAME}

    @modal.fastapi_endpoint(method="GET", docs=True)
    def generate_background(self, prompt: str, num_inference_steps: int = NUM_INFERENCE_STEPS):
        """Generate a background image based on the given prompt."""
        start = time.monotonic_ns()
        request_id = uuid4()
        print(f"Generating background for request {request_id}")
        
        # Generate the image
        image = self.pipe(
            prompt, 
            num_inference_steps=num_inference_steps
        ).images[0]
        
        # Convert PIL image to base64 string for API response
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        print(f"Request {request_id} completed in {round((time.monotonic_ns() - start) / 1e9, 2)} seconds")
        
        return {"image": img_str}

# For local development
@app.local_entrypoint()
def main():
    print(f"Up and running!") 
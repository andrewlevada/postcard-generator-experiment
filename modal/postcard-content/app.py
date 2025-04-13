import modal
import time
from uuid import uuid4
import os
import torch
import io
import base64
from PIL import Image
from diffusers import DiffusionPipeline
from pathlib import Path

# Define constants for poem generation
POEM_MODEL_NAME = "Nazgulitos/poem-gemma2-lora-model"
POEM_MAX_SEQ_LENGTH = 2048
POEM_LOAD_IN_4BIT = True

# Define constants for background generation
BACKGROUND_MODEL_NAME = "Nazgulitos/background-generator-with-stable-diffusion-v1-4"
BACKGROUND_NUM_INFERENCE_STEPS = 50

# GPU configuration
GPU_TYPE = "A100-40GB"
GPU_COUNT = 1
GPU_CONFIG = f"{GPU_TYPE}:{GPU_COUNT}"

# Define paths for model storage
MODEL_CACHE_DIR = Path("/model_cache")
POEM_MODEL_CACHE_DIR = MODEL_CACHE_DIR / "poem_model"
BACKGROUND_MODEL_CACHE_DIR = MODEL_CACHE_DIR / "background_model"

# Create a Modal Volume for storing model weights
volume = modal.Volume.from_name("postcard-model-weights", create_if_missing=True)

# Create a Modal image with the required dependencies
image = (
    modal.Image.debian_slim()
    .pip_install(
        "unsloth",
        "diffusers",
        "transformers",
        "accelerate",
        "fastapi",
    )
)

# Define the Modal app
app = modal.App("postcard-content")

@app.function(
    image=image,
    volumes={MODEL_CACHE_DIR: volume},
)
def download_models():
    """Download and cache models to the Modal Volume."""
    print("Downloading and caching models...")
    
    # Create cache directories if they don't exist
    os.makedirs(POEM_MODEL_CACHE_DIR, exist_ok=True)
    os.makedirs(BACKGROUND_MODEL_CACHE_DIR, exist_ok=True)
    
    # Download poem model
    if os.environ.get("MODAL_IS_REMOTE") == "1":
        from unsloth import FastLanguageModel
        
        print(f"Downloading poem model {POEM_MODEL_NAME} to {POEM_MODEL_CACHE_DIR}...")
        FastLanguageModel.from_pretrained(
            model_name=POEM_MODEL_NAME,
            max_seq_length=POEM_MAX_SEQ_LENGTH,
            dtype=None,
            load_in_4bit=POEM_LOAD_IN_4BIT,
            cache_dir=POEM_MODEL_CACHE_DIR,
        )
        print("Poem model downloaded successfully!")
    
    # Download background model
    print(f"Downloading background model {BACKGROUND_MODEL_NAME} to {BACKGROUND_MODEL_CACHE_DIR}...")
    DiffusionPipeline.from_pretrained(
        BACKGROUND_MODEL_NAME, 
        torch_dtype=torch.float16,
        cache_dir=BACKGROUND_MODEL_CACHE_DIR,
    )
    print("Background model downloaded successfully!")
    
    print("All models downloaded and cached!")

@app.cls(
    gpu=GPU_CONFIG,
    image=image,
    volumes={MODEL_CACHE_DIR: volume},
    # Keep containers warm for longer to reduce cold starts
    scaledown_window=120,  # 2 minutes
)
class PostcardContentGenerator:
    @modal.enter()
    def load_models(self):
        """Load the models when the container starts."""
        print("Loading models...")
        
        # Pre-allocate CUDA memory to avoid fragmentation
        torch.cuda.empty_cache()
        
        # Load poem model with optimized settings
        if os.environ.get("MODAL_IS_REMOTE") == "1":
            from unsloth import FastLanguageModel
            
            print("Loading poem model with Unsloth optimizations...")
            self.poem_model, self.poem_tokenizer = FastLanguageModel.from_pretrained(
                model_name=POEM_MODEL_NAME,
                max_seq_length=POEM_MAX_SEQ_LENGTH,
                dtype=None,
                load_in_4bit=POEM_LOAD_IN_4BIT,
                cache_dir=POEM_MODEL_CACHE_DIR,
            )
            
            # Enable native 2x faster inference
            FastLanguageModel.for_inference(self.poem_model)
            print("Poem model loaded successfully!")
        
        # Load background model
        print("Loading Stable Diffusion model...")
        self.background_pipe = DiffusionPipeline.from_pretrained(
            BACKGROUND_MODEL_NAME, 
            torch_dtype=torch.float16,
            cache_dir=BACKGROUND_MODEL_CACHE_DIR,
        )
        self.background_pipe.to("cuda")
        print("Background model loaded successfully!")
        
        print("All models loaded and warmed up!")

    @modal.fastapi_endpoint(method="GET", docs=True)
    def status(self):
        """Check the status of the service."""
        return {
            "status": "healthy", 
            "poem_model": POEM_MODEL_NAME,
            "background_model": BACKGROUND_MODEL_NAME
        }

    def generate_poem(self, theme: str, title: str):
        """Generate a poem based on the given theme and title."""
        start = time.monotonic_ns()
        request_id = uuid4()
        print(f"Generating poem for request {request_id}")
        
        greeting_prompt = """Below is a theme and title for a poem. Write a greeting poem that matches the theme and title for a greeting postcard.

### Theme:
{}

### Title:
{}

### Poem:
{}"""

        inputs = self.poem_tokenizer(
            greeting_prompt.format(theme, title, ""),
            return_tensors="pt"
        ).to(self.poem_model.device)

        outputs = self.poem_model.generate(
            **inputs,
            max_new_tokens=128,          
            temperature=0.7,             
            top_k=50,                   
            top_p=0.9,                  
            repetition_penalty=1.1,     
            do_sample=True,        
            use_cache=True
        )

        generated_poem = self.poem_tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        poem_start = generated_poem.find("### Poem:") + len("### Poem:")
        final_poem = generated_poem[poem_start:].strip()
        
        print(f"Request {request_id} completed in {round((time.monotonic_ns() - start) / 1e9, 2)} seconds")
        
        return {"poem": final_poem}

    def generate_background(self, prompt: str, num_inference_steps: int = BACKGROUND_NUM_INFERENCE_STEPS):
        """Generate a background image based on the given prompt."""
        start = time.monotonic_ns()
        request_id = uuid4()
        print(f"Generating background for request {request_id}")
        
        # Generate the image
        image = self.background_pipe(
            prompt, 
            num_inference_steps=num_inference_steps
        ).images[0]
        
        # Convert PIL image to base64 string for API response
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        print(f"Request {request_id} completed in {round((time.monotonic_ns() - start) / 1e9, 2)} seconds")
        
        return {"image": img_str}

    @modal.fastapi_endpoint(method="GET", docs=True)
    def generate_postcard_content(self, theme: str, title: str, background_prompt: str):
        """Generate both poem and background for a postcard in a single request."""
        start = time.monotonic_ns()
        request_id = uuid4()
        print(f"Generating postcard content for request {request_id}")
        
        # Generate poem
        poem_result = self.generate_poem(theme, title)
        poem = poem_result["poem"]
        
        # Generate background
        background_result = self.generate_background(background_prompt)
        background_image = background_result["image"]
        
        print(f"Request {request_id} completed in {round((time.monotonic_ns() - start) / 1e9, 2)} seconds")
        
        return {
            "poem": poem,
            "background_image": background_image
        }

# For local development
@app.local_entrypoint()
def main():
    print(f"Postcard Content Generator API up and running!")
    
    # Download and cache models when running locally
    download_models.remote() 
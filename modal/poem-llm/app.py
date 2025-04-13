import modal
import time
from uuid import uuid4
import os
import torch

if os.environ.get("MODAL_IS_REMOTE") == "1":
    from unsloth import FastLanguageModel


# Define constants
MODEL_NAME = "Nazgulitos/poem-gemma2-lora-model"
GPU_TYPE = "h100"
GPU_COUNT = 1
GPU_CONFIG = f"{GPU_TYPE}:{GPU_COUNT}"
MAX_SEQ_LENGTH = 2048
LOAD_IN_4BIT = True

# Create a Modal image with the required dependencies
image = (
    modal.Image.debian_slim()
    .pip_install(
        "unsloth",
        "fastapi",
    )
)

# Define the Modal app
app = modal.App("poem-generator")

@app.cls(
    gpu=GPU_CONFIG,
    image=image,
    # Keep containers warm for longer to reduce cold starts
    scaledown_window=120,  # 2 minutes
)
class PoemGenerator:
    @modal.enter()
    def load_model(self):
        """Load the model when the container starts."""
        print("Loading model with Unsloth optimizations...")
        
        # Pre-allocate CUDA memory to avoid fragmentation
        torch.cuda.empty_cache()
        
        # Load model with optimized settings
        self.model, self.tokenizer = FastLanguageModel.from_pretrained(
            model_name=MODEL_NAME,
            max_seq_length=MAX_SEQ_LENGTH,
            dtype=None,
            load_in_4bit=LOAD_IN_4BIT,
        )
        
        # Enable native 2x faster inference
        FastLanguageModel.for_inference(self.model)
        print("Model loaded and warmed up successfully!")

    @modal.fastapi_endpoint(method="GET", docs=True)
    def status(self):
        """Check the status of the service."""
        return {"status": "healthy", "model": MODEL_NAME}

    @modal.fastapi_endpoint(method="GET", docs=True)
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

        inputs = self.tokenizer(
            greeting_prompt.format(theme, title, ""),
            return_tensors="pt"
        ).to(self.model.device)

        outputs = self.model.generate(
            **inputs,
            max_new_tokens=128,          
            temperature=0.7,             
            top_k=50,                   
            top_p=0.9,                  
            repetition_penalty=1.1,     
            do_sample=True,        
            use_cache=True
        )

        generated_poem = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        poem_start = generated_poem.find("### Poem:") + len("### Poem:")
        final_poem = generated_poem[poem_start:].strip()
        
        print(f"Request {request_id} completed in {round((time.monotonic_ns() - start) / 1e9, 2)} seconds")
        
        return {"poem": final_poem}

# For local development
@app.local_entrypoint()
def main():
    print(f"Up and running!")

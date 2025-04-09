from unsloth import FastLanguageModel

# Configuration
MODEL_NAME = "Nazgulitos/poem-gemma2-lora-model"
MAX_SEQ_LENGTH = 2048
LOAD_IN_4BIT = True
DEVICE = "cuda"

GREETING_PROMPT_TEMPLATE = """Below is a theme and title for a poem. Write a greeting poem that matches the theme and title for a greeting postcard.

### Theme:
{}

### Title:
{}

### Poem:
{}"""

def load_model_and_tokenizer(model_name, max_seq_length, load_in_4bit):
    """
    Load the model and tokenizer with the specified configuration.
    """
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=load_in_4bit,
    )
    FastLanguageModel.for_inference(model)  # Enable faster inference
    return model, tokenizer

def generate_poem(model, tokenizer, theme, title, device, max_new_tokens=128):
    """
    Generate a poem based on the given theme and title.
    """
    prompt = GREETING_PROMPT_TEMPLATE.format(theme, title, "")
    inputs = tokenizer(prompt, return_tensors="pt").to(device)

    outputs = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        temperature=0.7,
        top_k=50,
        top_p=0.9,
        repetition_penalty=1.1,
        do_sample=True,
        use_cache=True,
    )

    generated_poem = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
    poem_start = generated_poem.find("### Poem:") + len("### Poem:")
    return generated_poem[poem_start:].strip()

def main():
    """
    Main function to load the model and generate a poem.
    """
    # Load model and tokenizer
    model, tokenizer = load_model_and_tokenizer(MODEL_NAME, MAX_SEQ_LENGTH, LOAD_IN_4BIT)

    # Define theme and title
    theme = "Write a sweet poem to my best friend to cheer her up"
    title = "support, happiness, shared memories"

    # Generate poem
    final_poem = generate_poem(model, tokenizer, theme, title, DEVICE)

    # Print the generated poem
    print("Generated Poem:")
    print(final_poem)

if __name__ == "__main__":
    main()
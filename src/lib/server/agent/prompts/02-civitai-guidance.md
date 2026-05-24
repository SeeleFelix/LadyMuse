## Civitai Query Guide

You have two Civitai tools. Use them flexibly based on what information you need.

### search_civitai_images — finding prompt references

Common query strategies:

**Find prompts for a style/subject:**
- query="cyberpunk city" + sort="Most Reactions" → proven, high-quality prompts
- query="cyberpunk city" + sort="Newest" + period="Month" → fresh approaches, less homogenized

**Browse a model/LoRA's gallery:**
- First use search_civitai_models to find the model ID
- Then search_civitai_images with modelId=12345 → see how others prompt with that model

**Study a creator's style:**
- search_civitai_images with username="artist_name" + sort="Most Reactions" → their best work

**Filter by architecture:**
- Add baseModels="Illustrious" (or "SDXL 1.0", "SD 1.5", etc.) to ensure prompts are relevant to the user's setup

**Paginate for more:**
- If the first page has few usable prompts, use the returned nextCursor to fetch more

### search_civitai_models — finding models

Use when the user asks about available models for a style, or wants to find a specific LoRA/checkpoint.
To see a model's images, take the model ID and use search_civitai_images with modelId.

### Working with results

- Images with meta.prompt contain real generation parameters — extract keywords, patterns, parameter configurations
- Images without prompt still have url/likes — useful for visual reference but not prompt study
- The meta.withPrompt count tells you how many results are actually useful for prompt analysis
- Don't copy prompts directly — extract effective patterns and recombine with your own understanding
- If search returns 0 results, tell the user honestly and generate based on your professional knowledge

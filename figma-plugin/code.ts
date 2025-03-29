import { Instruction, ImageConfig, TextConfig } from "./schema";
import { hexToRgb } from "./utils";

const selection = figma.currentPage.selection[0];

if (!selection || selection.type !== "TEXT") {
  figma.closePlugin("Please select a text node");
  throw new Error("No text node selected");
}

let parsedData: unknown;
try {
    parsedData = JSON.parse(selection.characters);
    console.log("Parsed data:", parsedData);
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Invalid JSON in text node: ${errorMessage}\nText content: ${selection.characters}`);
    figma.closePlugin("Error in console");
    throw error;
}

let instruction: Instruction;
try {
    instruction = Instruction.parse(parsedData);
    console.log("Validated instruction:", instruction);
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Invalid instruction format: ${errorMessage}\nParsed data: ${JSON.stringify(parsedData, null, 2)}`);
    figma.closePlugin("Error in console");
    throw error;
}

function calculatePosition(position: string, frameWidth: number, frameHeight: number, elementWidth: number, elementHeight: number) {
    const positions = {
        'top-left': { x: 20, y: 20 },
        'top-middle': { x: (frameWidth - elementWidth) / 2, y: 20 },
        'top-right': { x: frameWidth - elementWidth - 20, y: 20 },
        'middle-left': { x: 20, y: (frameHeight - elementHeight) / 2 },
        'middle-middle': { x: (frameWidth - elementWidth) / 2, y: (frameHeight - elementHeight) / 2 },
        'middle-right': { x: frameWidth - elementWidth - 20, y: (frameHeight - elementHeight) / 2 },
        'bottom-left': { x: 20, y: frameHeight - elementHeight - 20 },
        'bottom-middle': { x: (frameWidth - elementWidth) / 2, y: frameHeight - elementHeight - 20 },
        'bottom-right': { x: frameWidth - elementWidth - 20, y: frameHeight - elementHeight - 20 }
    };
    return positions[position as keyof typeof positions];
}

async function generatePostcard(instruction: Instruction): Promise<SceneNode> {
    const postcardFrame = figma.createFrame();
    postcardFrame.resize(300, 400);
    postcardFrame.x = 0;
    postcardFrame.y = 0;
    postcardFrame.fills = [{type: 'SOLID', color: hexToRgb("#D5D5D5")}];

    await placeObject(instruction.header, postcardFrame);
    await placeObject(instruction.body, postcardFrame);
    await placeObject(instruction.picture, postcardFrame);

    return postcardFrame;
}

async function placeObject(objectConfig: TextConfig | ImageConfig, postcardFrame: FrameNode) {
    if (TextConfig.safeParse(objectConfig).success) {
        const textConfig = objectConfig as TextConfig;
        await figma.loadFontAsync({family: textConfig.fontFamily, style: textConfig.fontWeight});

        const object = figma.createText();
        object.fontName = {family: textConfig.fontFamily, style: textConfig.fontWeight};
        object.characters = textConfig.text;
        object.fontSize = textConfig.fontSize;
        object.setRangeFills(
            0,
            object.characters.length,
            [{type: 'SOLID', color: hexToRgb(textConfig.color)}]
        );

        postcardFrame.appendChild(object);
        
        // Calculate position based on the position property
        const pos = calculatePosition(textConfig.position, postcardFrame.width, postcardFrame.height, object.width, object.height);
        object.x = pos.x;
        object.y = pos.y;
        return;
    }

    if (ImageConfig.safeParse(objectConfig).success) {
        const imageConfig = objectConfig as ImageConfig;
        
        // Create a frame to hold the image
        const imageFrame = figma.createFrame();
        imageFrame.resize(imageConfig.size.width, imageConfig.size.height);
        postcardFrame.appendChild(imageFrame);
        
        // Calculate position based on the position property
        const pos = calculatePosition(imageConfig.position, postcardFrame.width, postcardFrame.height, imageConfig.size.width, imageConfig.size.height);
        imageFrame.x = pos.x;
        imageFrame.y = pos.y;

        // Fetch and set the image
        try {
            const response = await fetch(imageConfig.url);
            const arrayBuffer = await response.arrayBuffer();
            const imageData = new Uint8Array(arrayBuffer);
            const image = figma.createImage(imageData);
            imageFrame.fills = [{type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL'}];
        } catch (error) {
            console.error('Failed to load image:', error);
            // Create a placeholder rectangle if image loading fails
            const placeholder = figma.createRectangle();
            placeholder.resize(imageConfig.size.width, imageConfig.size.height);
            imageFrame.appendChild(placeholder);
        }
    }
}

async function run() {
    const postcard = await generatePostcard(instruction);

    figma.currentPage.selection = [postcard];
    figma.viewport.scrollAndZoomIntoView([postcard]);
    figma.closePlugin();
}

run().then(() => {
    figma.closePlugin();
}).catch((error) => {
    figma.closePlugin(error.message);
});



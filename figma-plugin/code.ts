import { Instruction, ImageConfig, TextConfig } from "./schema";
import { hexToRgb } from "./utils";

// Hardcoded constants
const POSTCARD_WIDTH = 300;
const POSTCARD_HEIGHT = 400;
const MARGIN = 20;
const ITEM_SPACING = 4;

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
    
    // Log warnings for missing fields
    if (!instruction.header) console.warn("Warning: header field is missing");
    if (!instruction.body) console.warn("Warning: body field is missing");
    if (!instruction.picture) console.warn("Warning: picture field is missing");
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

const flexContainers: Record<string, FrameNode> = {};

function getOrCreateFlexContainer(position: string, postcardFrame: FrameNode): FrameNode {
    if (flexContainers[position]) {
        return flexContainers[position];
    }

    const vPosition = position.split('-')[0];
    const hPosition = position.split('-')[1];

    const container = figma.createFrame();
    container.layoutMode = "VERTICAL";
    container.resize(postcardFrame.width - 2 * MARGIN, 1);
    container.layoutSizingVertical = "HUG";
    container.itemSpacing = ITEM_SPACING;
    
    // Configure flex properties based on position
    if (vPosition === 'top') {
        container.primaryAxisAlignItems = "MIN";
        container.constraints = {
            horizontal: "SCALE",
            vertical: "MIN"
        }
    } else if (vPosition === 'middle') {
        container.primaryAxisAlignItems = "CENTER";
        container.constraints = {
            horizontal: "SCALE",
            vertical: "CENTER"
        }
    } else if (vPosition === 'bottom') {
        container.primaryAxisAlignItems = "MAX";
        container.constraints = {
            horizontal: "SCALE",
            vertical: "MAX"
        }
    }

    if (hPosition === 'left') {
        container.counterAxisAlignItems = "MIN";
        container.constraints = {
            horizontal: "MIN",
            vertical: container.constraints.vertical
        }
    } else if (hPosition === 'middle') {
        container.counterAxisAlignItems = "CENTER";
        container.constraints = {
            horizontal: "CENTER",
            vertical: container.constraints.vertical
        }
    } else if (hPosition === 'right') {
        container.counterAxisAlignItems = "MAX";
        container.constraints = {
            horizontal: "MAX",
            vertical: container.constraints.vertical
        }
    }

    // Position the container
    const pos = calculatePosition(position, postcardFrame.width, postcardFrame.height, 0, 0);
    container.x = pos.x;
    container.y = pos.y;

    // Remove the default fill
    container.fills = []
    
    postcardFrame.appendChild(container);
    flexContainers[position] = container;
    return container;
}

async function generatePostcard(instruction: Instruction): Promise<SceneNode> {
    const postcardFrame = figma.createFrame();
    postcardFrame.resize(POSTCARD_WIDTH, POSTCARD_HEIGHT);
    postcardFrame.x = 0;
    postcardFrame.y = 0;
    postcardFrame.fills = [{type: 'SOLID', color: hexToRgb("#D5D5D5")}];

    if (instruction.header) await placeObject(instruction.header, postcardFrame);
    if (instruction.body) await placeObject(instruction.body, postcardFrame);
    if (instruction.picture) await placeObject(instruction.picture, postcardFrame);

    return postcardFrame;
}

async function placeObject(objectConfig: TextConfig | ImageConfig, postcardFrame: FrameNode) {
    if (TextConfig.safeParse(objectConfig).success) {
        const textConfig = objectConfig as TextConfig;
        // Only load font if font properties are present
        if (textConfig.fontFamily && textConfig.fontWeight) {
            await figma.loadFontAsync({family: textConfig.fontFamily, style: textConfig.fontWeight});
        }

        const object = figma.createText();
        object.fontName = {
            family: textConfig.fontFamily || "Inter",
            style: textConfig.fontWeight || "Regular"
        };
        object.characters = textConfig.text || "";
        object.fontSize = textConfig.fontSize || 16;
        object.setRangeFills(
            0,
            object.characters.length,
            [{type: 'SOLID', color: hexToRgb(textConfig.color || "#000000")}]
        );

        const container = getOrCreateFlexContainer(textConfig.position || "middle-middle", postcardFrame);
        container.appendChild(object);

        // Fit the text to the container
        object.textAutoResize = "WIDTH_AND_HEIGHT";
        object.resize(container.width, object.height);

        return;
    }

    if (ImageConfig.safeParse(objectConfig).success) {
        const imageConfig = objectConfig as ImageConfig;
        
        // Create a frame to hold the image
        const imageFrame = figma.createFrame();
        imageFrame.resize(
            imageConfig.size?.width || 200,
            imageConfig.size?.height || 200
        );
        
        const container = getOrCreateFlexContainer(imageConfig.position || "middle-middle", postcardFrame);
        container.appendChild(imageFrame);

        // Create a placeholder rectangle first
        const placeholder = figma.createRectangle();
        placeholder.resize(
            imageConfig.size?.width || 200,
            imageConfig.size?.height || 200
        );
        placeholder.fills = [{type: 'SOLID', color: hexToRgb("#CCCCCC")}];
        imageFrame.appendChild(placeholder);

        // Only try to fetch image if URL is present
        if (imageConfig.url) {
            try {
                const response = await fetch(imageConfig.url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const imageData = new Uint8Array(arrayBuffer);
                const image = figma.createImage(imageData);
                
                // Remove the placeholder and set the image
                placeholder.remove();
                imageFrame.fills = [{type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL'}];
            } catch (error) {
                console.error('Failed to load image:', error);
                // Keep the placeholder if image loading fails
            }
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



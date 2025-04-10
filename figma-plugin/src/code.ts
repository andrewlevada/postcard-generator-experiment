import { Instruction, ImageConfig, TextConfig } from "./schema";
import { loadApiToken } from "./token-loader"
import { hexToRgb } from "./utils";

type ContainerStore = Record<string, FrameNode>;

// Hardcoded constants
const POSTCARD_WIDTH = 300;
const POSTCARD_HEIGHT = 400;
const MARGIN = 20;
const ITEM_SPACING = 4;

// Show the UI
figma.showUI(__html__, { width: 300, height: 560 });

// Get the API token and pass it to the UI
const apiToken = loadApiToken(figma.currentPage);
if (!apiToken) {
    figma.closePlugin("Error: No API token found! Place it as a text layer in the current page please");
} else {
    figma.ui.postMessage({
        type: 'api-token',
        apiToken: apiToken
    });
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-postcard') {
    try {
        let instruction: Instruction;
        try {
            // ***
            const debug_text = msg.instruction
            console.log("Debug text:", debug_text);
            // ***
            
            instruction = Instruction.parse(debug_text);
            console.log("Validated instruction:", instruction);
            
            // Log warnings for missing fields
            if (!instruction.header) console.warn("Warning: header field is missing");
            if (!instruction.body) console.warn("Warning: body field is missing");
            if (!instruction.picture) console.warn("Warning: picture field is missing");
            if (!instruction.layout) console.warn("Warning: layout field is missing");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Invalid instruction format: ${errorMessage}\nParsed data: ${JSON.stringify(msg.instruction, null, 2)}`);
            figma.closePlugin("Error in console");
            throw error;
        }

        const postcard = await generatePostcard(instruction);
        figma.currentPage.selection = [postcard];
        figma.viewport.scrollAndZoomIntoView([postcard]);
        figma.notify("✅ Done!");
        
    } catch (error) {
        figma.notify(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

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

function getOrCreateFlexContainer(position: string, postcardFrame: FrameNode, flexContainers: ContainerStore): FrameNode {
    if (flexContainers[position]) {
        return flexContainers[position];
    }

    const vPosition = position.split('-')[0];
    const hPosition = position.split('-')[1];

    const container = figma.createFrame();
    postcardFrame.appendChild(container);
    flexContainers[position] = container;

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
    
    return container;
}

async function generatePostcard(instruction: Instruction): Promise<SceneNode> {
    const postcardFrame = figma.createFrame();
    postcardFrame.resize(POSTCARD_WIDTH, POSTCARD_HEIGHT);
    postcardFrame.x = 0;
    postcardFrame.y = 0;
    
    // Use backgroundColor from layout config if available, otherwise use default
    const backgroundColor = instruction.layout?.backgroundColor || "#D5D5D5";
    postcardFrame.fills = [{type: 'SOLID', color: hexToRgb(backgroundColor)}];

    const flexContainers: ContainerStore = {};

    if (instruction.header) await placeTextObject(instruction.header, postcardFrame, flexContainers);
    if (instruction.body) await placeTextObject(instruction.body, postcardFrame, flexContainers);
    if (instruction.picture) await placeImageObject(instruction.picture, postcardFrame, flexContainers);

    patchContainerPositions(flexContainers, postcardFrame);

    return postcardFrame;
}

async function placeTextObject(textConfig: TextConfig, postcardFrame: FrameNode, flexContainers: ContainerStore) {
    const object = figma.createText();

    try {
        await figma.loadFontAsync({family: textConfig.fontFamily, style: textConfig.fontWeight});

        object.fontName = {
            family: textConfig.fontFamily,
            style: textConfig.fontWeight
        };
    } catch (error) {
        console.warn('Failed to load font:', error);

        const fallbackFont = "Inter";
        const fallbackStyle = "Medium";

        await figma.loadFontAsync({family: fallbackFont, style: fallbackStyle});

        object.fontName = {
            family: fallbackFont,
            style: fallbackStyle
        };
    }
    
    object.characters = textConfig.text || "";
    object.fontSize = textConfig.fontSize || 16;
    object.setRangeFills(
        0,
        object.characters.length,
        [{type: 'SOLID', color: hexToRgb(textConfig.color || "#000000")}]
    );

    const container = getOrCreateFlexContainer(textConfig.position || "middle-middle", postcardFrame, flexContainers);
    container.appendChild(object);

    // Aligning the text with it's position
    const alignment = textConfig.position.split('-')[1];
    if (alignment === 'left') {
        object.textAlignHorizontal = "LEFT";
    } else if (alignment === 'middle') {
        object.textAlignHorizontal = "CENTER";
    } else if (alignment === 'right') {
        object.textAlignHorizontal = "RIGHT";
    }

    // Fit the text to the container
    object.textAutoResize = "WIDTH_AND_HEIGHT";
    object.resize(container.width, object.height);
}

async function placeImageObject(imageConfig: ImageConfig, postcardFrame: FrameNode, flexContainers: ContainerStore) {
    // Create a frame to hold the image
    const imageFrame = figma.createFrame();
    imageFrame.resize(
        imageConfig.size?.width || 200,
        imageConfig.size?.height || 200
    );
    
    const container = getOrCreateFlexContainer(imageConfig.position || "middle-middle", postcardFrame, flexContainers);
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
            console.warn('Failed to load image:', error);
            // Keep the placeholder if image loading fails
        }
    }
}

function patchContainerPositions(flexContainers: ContainerStore, postcardFrame: FrameNode) {
    for (const position of Object.keys(flexContainers)) {
        const container = flexContainers[position];
        const pos = calculatePosition(position, postcardFrame.width, postcardFrame.height, container.width, container.height);
        
        container.x = pos.x;
        container.y = pos.y;
    }
}

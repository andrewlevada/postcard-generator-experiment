import { Instruction, ObjectConfig } from "./schema";
import { hexToRgb } from "./utils";

const selection = figma.currentPage.selection[0];

if (!selection || selection.type !== "TEXT") {
  figma.closePlugin("Please select a text node");
  throw new Error("No text node selected");
}

const instruction = Instruction.parse(JSON.parse(selection.characters));

async function generatePostcard(instruction: Instruction): Promise<SceneNode> {
    const postcardFrame = figma.createFrame();
    postcardFrame.resize(300, 400);
    postcardFrame.x = 0;
    postcardFrame.y = 0;
    postcardFrame.fills = [{type: 'SOLID', color: hexToRgb("#D5D5D5")}];

    await placeObject(instruction.header, postcardFrame, 0);
    await placeObject(instruction.body, postcardFrame, 100);

    return postcardFrame;
}

async function placeObject(objectConfig: ObjectConfig, postcardFrame: FrameNode, y: number) {
    await figma.loadFontAsync({family: objectConfig.fontFamily, style: objectConfig.fontWeight});

    const object = figma.createText();

    object.fontName = {family: objectConfig.fontFamily, style: objectConfig.fontWeight};
    object.characters = objectConfig.text;
    object.fontSize = objectConfig.fontSize;
    object.setRangeFills(
        0,
        object.characters.length,
        [{type: 'SOLID', color: hexToRgb(objectConfig.color)}]
    );

    postcardFrame.appendChild(object);
    object.y = y;
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



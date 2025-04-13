import { z } from "zod";

const PositionEnum = z.enum(["top-left", "top-middle", "top-right", "middle-left", "middle-middle", "middle-right", "bottom-left", "bottom-middle", "bottom-right"]).default("middle-middle").catch("middle-middle");

export const TextConfig = z.object({
    text: z.string().default("Ура").catch("Ура"),
    fontSize: z.number().default(16).catch(16),
    fontWeight: z.string().default("Regular").catch("Regular"),
    fontFamily: z.string().default("Inter").catch("Inter"),
    color: z.string().default("#000000").catch("#000000"),
    position: PositionEnum
});

export type TextConfig = z.infer<typeof TextConfig>;

export const ImageConfig = z.object({
    url: z.string().optional(),
    size: z.object({
        width: z.number().default(200).catch(200),
        height: z.number().default(200).catch(200),
    }),
    position: PositionEnum
});

export type ImageConfig = z.infer<typeof ImageConfig>;

export const BackgroundConfig = z.object({
    url: z.string().optional(),
    blur: z.number().default(100).catch(100),
    color: z.string().default("#D5D5D5").catch("#D5D5D5")
});

export type BackgroundConfig = z.infer<typeof BackgroundConfig>;

export const LayoutConfig = z.object({
    backgroundColor: z.string().default("#D5D5D5").catch("#D5D5D5")
});

export type LayoutConfig = z.infer<typeof LayoutConfig>;

export const Instruction = z.object({
    header: TextConfig.optional(),
    body: TextConfig.optional(),
    picture: ImageConfig.optional(),
    background: BackgroundConfig.optional(),
    layout: LayoutConfig.optional()
})

export type Instruction = z.infer<typeof Instruction>;


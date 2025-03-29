import { z } from "zod";

const PositionEnum = z.enum(["top-left", "top-middle", "top-right", "middle-left", "middle-middle", "middle-right", "bottom-left", "bottom-middle", "bottom-right"]);

export const TextConfig = z.object({
    text: z.string(),
    fontSize: z.number(),
    fontWeight: z.string(),
    fontFamily: z.string(),
    color: z.string(),
    position: PositionEnum
})
export type TextConfig = z.infer<typeof TextConfig>;

export const ImageConfig = z.object({
    url: z.string(),
    size: z.object({
        width: z.number(),
        height: z.number(),
    }),
    position: PositionEnum
})
export type ImageConfig = z.infer<typeof ImageConfig>;

export const Instruction = z.object({
    header: z.union([TextConfig, ImageConfig]),
    body: z.union([TextConfig, ImageConfig]),
    picture: z.union([TextConfig, ImageConfig]),
})
export type Instruction = z.infer<typeof Instruction>;


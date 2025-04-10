import { z } from "zod";

const PositionEnum = z.enum(["top-left", "top-middle", "top-right", "middle-left", "middle-middle", "middle-right", "bottom-left", "bottom-middle", "bottom-right"]).default("middle-middle");

export const TextConfig = z.object({
    text: z.string().default(""),
    fontSize: z.number().default(16),
    fontWeight: z.string().default("Regular"),
    fontFamily: z.string().default("Inter"),
    color: z.string().default("#000000"),
    position: PositionEnum
}).partial();

export type TextConfig = z.infer<typeof TextConfig>;

export const ImageConfig = z.object({
    url: z.string().default(""),
    size: z.object({
        width: z.number().default(200),
        height: z.number().default(200),
    }).partial(),
    position: PositionEnum
}).partial();

export type ImageConfig = z.infer<typeof ImageConfig>;

export const Instruction = z.object({
    header: z.union([TextConfig, ImageConfig]).optional(),
    body: z.union([TextConfig, ImageConfig]).optional(),
    picture: z.union([TextConfig, ImageConfig]).optional(),
})
export type Instruction = z.infer<typeof Instruction>;


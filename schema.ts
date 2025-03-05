import { z } from "zod";

export const ObjectConfig = z.object({
    text: z.string(),
    fontSize: z.number(),
    fontWeight: z.string(),
    fontFamily: z.string(),
    color: z.string()
})
export type ObjectConfig = z.infer<typeof ObjectConfig>;

export const Instruction = z.object({
    header: ObjectConfig,
    body: ObjectConfig,
})
export type Instruction = z.infer<typeof Instruction>;


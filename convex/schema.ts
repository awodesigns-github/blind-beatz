import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const gameStatus = v.union(
    v.literal("lobby"),
    v.literal("composing"),
    v.literal("reveal")
)

export default defineSchema({
    games: defineTable({
        code: v.string(),
        status: gameStatus,
        bpm: v.number(),
        revealAt: v.optional(v.number())
    }),
    players: defineTable({
        gameId: v.number(),
        userId: v.number(),
        name: v.string(),
        track: v.number(),
        steps: v.array(v.number()),
    })
})
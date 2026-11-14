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
        revealAt: v.optional(v.number()),
        playerIds: v.array(v.string())
    })
    .index("by_code", ["code"]),
    players: defineTable({
        gameId: v.id("games"),
        userId: v.string(),
        name: v.string(),
        steps: v.array(v.boolean()),
        locked: v.boolean()
    }).index("by_game_user", ["gameId", "userId"])
})
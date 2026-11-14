import { mutation, MutationCtx, query, QueryCtx } from './_generated/server'
import { Id } from './_generated/dataModel'
import { v } from 'convex/values'


const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 6
const MAX_ATTEMPTS = 3


// Creates a game with a shortcode and adds the creator to track 0
export const createGame = mutation({
    args: { userId: v.string(), bpm: v.number() },
    handler: async (ctx, args) => {
        await ctx.db.insert("games", {
            bpm: args.bpm,
            status: 'lobby',
            code: await generateGameCode(ctx),
            playerIds: [args.userId]
        })
    }
})

// Checks for a valid code and allows a user to join a game
export const joinGame = mutation({
    args: { userId: v.string(), code: v.string() },
    handler: async (ctx, args) => {
        const game = await getGameByCode(ctx, args.code)

        // Already in the game, nothing to do
        if (game.playerIds.includes(args.userId)) return game._id

        // Check MAX_PLAYERS
        if (game.playerIds.length >= 4) throw new Error('Game is full')

        await ctx.db.patch('games', game._id, {
            playerIds: [...game.playerIds, args.userId],
        })

        return game._id
    }
})

// Moves the game from lobby to composing
export const startComposing = mutation({
    args: { code: v.string() },
    handler: async (ctx, args) => {
        const game = await getGameByCode(ctx, args.code)

        await ctx.db.patch('games', game._id, {
            status: 'composing'
        })
    }
})


// Get the game
export const getGame = query({
    args: { code: v.string() },
    handler: async (ctx, args) => {
        const gameDetails = await getGameByCode(ctx, args.code)

        // Keep everyone's steps hidden until the reveal
        if (gameDetails.status !== "reveal") {
            return { ...gameDetails, playerSteps: null }
        }

        // One steps array per player, in the same order as playerIds
        const playerSteps = await Promise.all(
            gameDetails.playerIds.map(async (userId) => {
                const player = await findPlayer(ctx, gameDetails._id, userId)
                return player?.steps ?? []
            })
        )

        return { ...gameDetails, playerSteps }
    }
})

// Saves a player's steps and locks in their pattern
export const lockPattern = mutation({
    args: { code: v.string(), userId: v.string(), steps: v.array(v.boolean()) },
    handler: async (ctx, args) => {
        // A pattern needs at least one active step
        if (!args.steps.some((step) => step)) {
            throw new Error("Can't lock an empty pattern")
        }

        const game = await getGameByCode(ctx, args.code)
        if (game.status !== 'composing') throw new Error('Game is not in the composing phase')

        const player = await findPlayer(ctx, game._id, args.userId)
        if (!player) throw new Error('Player not found in this game')
        if (player.locked) throw new Error('Pattern is already locked')

        await ctx.db.patch('players', player._id, {
            steps: args.steps,
            locked: true,
        })
    }
})


// ---- Helpers ----

// Looks up a game by its code, or returns null if there isn't one
async function findGameByCode(ctx: QueryCtx, code: string) {
    return await ctx.db
        .query('games')
        .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
        .first()
}

// Looks up a game by its code, and throws if there isn't one
async function getGameByCode(ctx: QueryCtx, code: string) {
    const game = await findGameByCode(ctx, code)
    if (!game) throw new Error('Invalid code')
    return game
}

// Looks up a player's row in a game, or returns null if there isn't one
async function findPlayer(ctx: QueryCtx, gameId: Id<'games'>, userId: string) {
    return await ctx.db
        .query('players')
        .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', userId))
        .first()
}

// Generates a unique 6 letter game code and checks if code exists
async function generateGameCode(ctx: MutationCtx): Promise<string> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let code = ''
        for (let i = 0; i < CODE_LENGTH; i++) {
            code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
        }

        if (!(await findGameByCode(ctx, code))) return code
    }
    throw new Error('Failed to generate a unique game code')
}

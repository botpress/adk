import {
  Autonomous,
  Conversation,
  Reference,
  context,
  z,
} from "@botpress/runtime";
import { generateUniqueJoinCode } from "../utils/join-code";
import {
  GameSettingsSchema,
  type GameSettings,
  type Player,
} from "../tables/games";
import PlayQuizWorkflow from "../workflows/play-quiz";

/**
 * Conversation state for trivia game
 */
const ConversationState = z.object({
  currentGameId: z.number().optional(),
  isCreator: z.boolean().default(false),
  joinCode: z.string().optional(),
  playWorkflow: Reference.Workflow("play_quiz").optional(),
});

/**
 * Main Webchat Conversation Handler
 *
 * Handles the pre-game flow:
 * - Username setup (blocking if not set)
 * - Create/Join game
 * - Game settings (creator only)
 * - Start game (creator only)
 * - Next question control (creator only)
 */
export default new Conversation({
  channel: "webchat.channel",
  state: ConversationState,

  handler: async ({ execute, conversation, state, user, type, event }) => {
    const client = context.get("client");
    const botId = context.get("botId");
    const visibleUserId =
      conversation.tags?.["webchat:userId"] || conversation.id;

    // ========================================
    // Handle workflow requests (creator "Next" button)
    // ========================================
    if (type === "workflow_request" && state.playWorkflow) {
      try {
        await state.playWorkflow.provide(event, { proceed: true });
        return;
      } catch (error) {
        console.error("[Conversation] Failed to provide workflow data:", error);
      }
    }

    // ========================================
    // Build tools based on current state
    // ========================================
    const tools: Autonomous.Tool[] = [];

    // --- Set Username Tool (always available) ---
    const setUsernameTool = new Autonomous.Tool({
      name: "setUsername",
      description:
        "Set or update the player's display name. Required before playing.",
      input: z.object({
        username: z
          .string()
          .min(1)
          .max(20)
          .describe("The player's display name"),
      }),
      output: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      handler: async ({ username }) => {
        user.state.username = username;
        return {
          success: true,
          message: `Username set to "${username}"!`,
        };
      },
    });
    tools.push(setUsernameTool);

    // Only add game tools if username is set
    if (user.state.username) {
      // --- Create Game Tool ---
      if (!state.currentGameId) {
        const createGameTool = new Autonomous.Tool({
          name: "createGame",
          description:
            "Create a new trivia game. You will become the host and get a join code to share.",
          input: z.object({
            settings: GameSettingsSchema.optional().describe(
              "Optional game settings. Defaults will be used if not provided."
            ),
          }),
          output: z.object({
            success: z.boolean(),
            joinCode: z.string().optional(),
            gameId: z.number().optional(),
            message: z.string(),
          }),
          handler: async ({ settings }) => {
            const gameSettings: GameSettings = settings || {
              categories: ["any"],
              difficulty: "easy",
              questionCount: 10,
              scoreMethod: "all-right",
              timerSeconds: 20,
            };

            const joinCode = await generateUniqueJoinCode(client);

            const player: Player = {
              visibleUserId,
              visibleConversationId: conversation.id,
              username: user.state.username!,
              score: 0,
              isCreator: true,
            };

            const { rows } = await client.createTableRows({
              table: "gamesTable",
              rows: [
                {
                  visibleCreatorId: visibleUserId,
                  visibleCreatorConversationId: conversation.id,
                  joinCode,
                  status: "waiting",
                  players: JSON.stringify([player]),
                  settings: JSON.stringify(gameSettings),
                  questions: "[]",
                  currentQuestionIndex: 0,
                },
              ],
            });

            const gameId = Number(rows[0]?.id);
            state.currentGameId = gameId;
            state.isCreator = true;
            state.joinCode = joinCode;

            // Send lobby message
            await conversation.send({
              type: "custom",
              payload: {
                name: "trivia_lobby",
                url: "custom://trivia_lobby",
                data: {
                  gameId,
                  joinCode,
                  players: [player],
                  settings: gameSettings,
                  isCreator: true,
                  canStart: false, // Need at least 2 players
                },
              },
            });

            return {
              success: true,
              joinCode,
              gameId,
              message: `Game created! Share the code ${joinCode} with friends to join.`,
            };
          },
        });
        tools.push(createGameTool);

        // --- Join Game Tool ---
        const joinGameTool = new Autonomous.Tool({
          name: "joinGame",
          description: "Join an existing game using a 6-character join code.",
          input: z.object({
            joinCode: z.string().length(6).describe("The 6-character join code"),
          }),
          output: z.object({
            success: z.boolean(),
            gameId: z.number().optional(),
            playerCount: z.number().optional(),
            message: z.string(),
          }),
          handler: async ({ joinCode }) => {
            const code = joinCode.toUpperCase();

            // Find the game
            const { rows } = await client.findTableRows({
              table: "gamesTable",
              filter: {
                joinCode: { $eq: code },
                status: { $eq: "waiting" },
              },
            });

            if (rows.length === 0) {
              return {
                success: false,
                message:
                  "Invalid join code or game has already started. Please check the code and try again.",
              };
            }

            const game = rows[0];
            const gameId = Number(game.id);
            const players: Player[] = JSON.parse(game.players as string);
            const settings: GameSettings = JSON.parse(game.settings as string);

            // Check if already in game
            if (players.some((p) => p.visibleUserId === visibleUserId)) {
              state.currentGameId = gameId;
              state.isCreator = players.find(
                (p) => p.visibleUserId === visibleUserId
              )?.isCreator || false;
              state.joinCode = code;

              return {
                success: true,
                gameId,
                playerCount: players.length,
                message: "You're already in this game!",
              };
            }

            // Check max players
            if (players.length >= 20) {
              return {
                success: false,
                message: "This game is full (max 20 players).",
              };
            }

            // Add player
            const newPlayer: Player = {
              visibleUserId,
              visibleConversationId: conversation.id,
              username: user.state.username!,
              score: 0,
              isCreator: false,
            };
            players.push(newPlayer);

            // Update game
            await client.updateTableRows({
              table: "gamesTable",
              rows: [
                {
                  id: gameId,
                  players: JSON.stringify(players),
                },
              ],
            });

            state.currentGameId = gameId;
            state.isCreator = false;
            state.joinCode = code;

            // Broadcast join to all players
            for (const player of players) {
              await client.createMessage({
                conversationId: player.visibleConversationId,
                userId: botId,
                type: "custom",
                payload: {
                  name: "trivia_lobby",
                  url: "custom://trivia_lobby",
                  data: {
                    gameId,
                    joinCode: code,
                    players,
                    settings,
                    isCreator: player.isCreator,
                    canStart: player.isCreator && players.length >= 2,
                    newPlayer: user.state.username,
                  },
                },
                tags: {},
              });
            }

            return {
              success: true,
              gameId,
              playerCount: players.length,
              message: `Joined game ${code}! Waiting for host to start...`,
            };
          },
        });
        tools.push(joinGameTool);
      }

      // --- Creator-only tools when in a game ---
      if (state.currentGameId && state.isCreator) {
        // Update Settings Tool
        const updateSettingsTool = new Autonomous.Tool({
          name: "updateSettings",
          description: "Update game settings (host only).",
          input: GameSettingsSchema.partial(),
          output: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          handler: async (newSettings) => {
            const { rows } = await client.findTableRows({
              table: "gamesTable",
              filter: { id: { $eq: state.currentGameId! } },
            });

            if (rows.length === 0) {
              return { success: false, message: "Game not found" };
            }

            const game = rows[0];
            const currentSettings: GameSettings = JSON.parse(
              game.settings as string
            );
            const updatedSettings = { ...currentSettings, ...newSettings };
            const players: Player[] = JSON.parse(game.players as string);

            await client.updateTableRows({
              table: "gamesTable",
              rows: [
                {
                  id: state.currentGameId!,
                  settings: JSON.stringify(updatedSettings),
                },
              ],
            });

            // Broadcast settings update to all players
            for (const player of players) {
              await client.createMessage({
                conversationId: player.visibleConversationId,
                userId: botId,
                type: "custom",
                payload: {
                  name: "trivia_lobby",
                  url: "custom://trivia_lobby",
                  data: {
                    gameId: state.currentGameId,
                    joinCode: state.joinCode,
                    players,
                    settings: updatedSettings,
                    isCreator: player.isCreator,
                    canStart: player.isCreator && players.length >= 2,
                    settingsUpdated: true,
                  },
                },
                tags: {},
              });
            }

            return {
              success: true,
              message: "Settings updated!",
            };
          },
        });
        tools.push(updateSettingsTool);

        // Start Game Tool
        const startGameTool = new Autonomous.Tool({
          name: "startGame",
          description:
            "Start the trivia game (host only). Requires at least 2 players.",
          input: z.object({}),
          output: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          handler: async () => {
            const { rows } = await client.findTableRows({
              table: "gamesTable",
              filter: { id: { $eq: state.currentGameId! } },
            });

            if (rows.length === 0) {
              return { success: false, message: "Game not found" };
            }

            const game = rows[0];
            const players: Player[] = JSON.parse(game.players as string);
            const settings: GameSettings = JSON.parse(game.settings as string);

            if (players.length < 2) {
              return {
                success: false,
                message: "Need at least 2 players to start the game.",
              };
            }

            // Start the play_quiz workflow
            const workflow = await PlayQuizWorkflow.start({
              gameId: state.currentGameId!,
              players,
              settings,
            });

            state.playWorkflow = workflow;

            // Update game with workflow ID
            await client.updateTableRows({
              table: "gamesTable",
              rows: [
                {
                  id: state.currentGameId!,
                  workflowId: workflow.id,
                  status: "playing",
                },
              ],
            });

            return {
              success: true,
              message: `Game started with ${players.length} players! Get ready for ${settings.questionCount} questions.`,
            };
          },
        });
        tools.push(startGameTool);

        // Next Question Tool (only when game is in progress)
        const nextQuestionTool = new Autonomous.Tool({
          name: "nextQuestion",
          description:
            "Advance to the next question (host only). Use this after reviewing scores.",
          input: z.object({}),
          output: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          handler: async () => {
            if (!state.playWorkflow) {
              return {
                success: false,
                message: "No active game workflow found.",
              };
            }

            // The workflow will receive this via step.request()
            // The actual provide happens in the workflow_request handler above
            return {
              success: true,
              message: "Moving to the next question...",
            };
          },
        });
        tools.push(nextQuestionTool);
      }

      // --- Leave Game Tool ---
      if (state.currentGameId && !state.isCreator) {
        const leaveGameTool = new Autonomous.Tool({
          name: "leaveGame",
          description: "Leave the current game.",
          input: z.object({}),
          output: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          handler: async () => {
            const { rows } = await client.findTableRows({
              table: "gamesTable",
              filter: { id: { $eq: state.currentGameId! } },
            });

            if (rows.length === 0) {
              state.currentGameId = undefined;
              state.joinCode = undefined;
              return { success: true, message: "Left the game." };
            }

            const game = rows[0];
            const players: Player[] = JSON.parse(game.players as string);
            const updatedPlayers = players.filter(
              (p) => p.visibleUserId !== visibleUserId
            );

            await client.updateTableRows({
              table: "gamesTable",
              rows: [
                {
                  id: state.currentGameId!,
                  players: JSON.stringify(updatedPlayers),
                },
              ],
            });

            state.currentGameId = undefined;
            state.joinCode = undefined;
            state.isCreator = false;

            return {
              success: true,
              message: "You left the game.",
            };
          },
        });
        tools.push(leaveGameTool);
      }
    }

    // ========================================
    // Build dynamic instructions
    // ========================================
    const getInstructions = (): string => {
      const base = `You are a friendly trivia game host! Help players create or join games and have fun.`;

      if (!user.state.username) {
        return `${base}

IMPORTANT: The player hasn't set a username yet. This is required before they can play.
Ask them to choose a username using the setUsername tool. Make it fun and welcoming!
You can suggest they pick something creative or memorable.`;
      }

      if (!state.currentGameId) {
        return `${base}

Welcome ${user.state.username}! They can either:
1. CREATE a new game - they'll get a 6-character code to share with friends
2. JOIN an existing game - they need to enter a code from a friend

Help them choose what they want to do. If they want to create a game, you can ask about settings like:
- Number of questions (5-50, default 10)
- Difficulty (easy, medium, hard, or any)
- Category (general, science, history, sports, etc.)
- Scoring method:
  - "first-right": Only the fastest correct answer gets points
  - "time-right": Points based on how fast you answer correctly
  - "all-right": Everyone who answers correctly gets the same points`;
      }

      if (state.isCreator) {
        return `${base}

${user.state.username} is hosting game ${state.joinCode}!

As the host, they can:
- Update game settings using updateSettings
- Start the game using startGame (need at least 2 players)
- Share the join code ${state.joinCode} with friends

When the game is in progress, they control the pace:
- After each question, scores are shown
- They click "Next" to proceed (or you can use nextQuestion tool)

Keep the energy high and make it fun!`;
      }

      return `${base}

${user.state.username} has joined game ${state.joinCode}!

They're waiting for the host to start the game. Keep them entertained while they wait!
They can also leave the game using leaveGame if they change their mind.

Once the game starts, questions will appear automatically. They answer via the game UI, not by chatting.`;
    };

    // ========================================
    // Execute conversation
    // ========================================
    await execute({
      instructions: getInstructions(),
      tools,
    });
  },
});

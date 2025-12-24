# Trivia Quiz Game Bot - Implementation Plan

## Overview

Multiplayer trivia quiz game using Botpress ADK. Each player has their own conversation with the bot. Features include game creation with join codes, configurable settings, timed questions, multiple scoring methods, and real-time broadcasts.

**Key Decisions:**
- Questions: Open Trivia Database API
- Join Code: 6-char alphanumeric (ABC123)
- Scope: Bot backend + React frontend
- **Answers: Use `delegate` integration** - workflow creates delegates, frontend fulfills them with `{answer, timeToAnswerMs}`

---

## Delegate Pattern for Answers

Instead of using tables to store answers, we use the `delegate` integration:

1. **Workflow creates a delegate** for each player per question
2. **Delegate is sent via custom message** to the player's conversation
3. **Frontend displays question**, starts local timer, shows answer controls
4. **When player answers**, frontend calls `delegate.fulfill_url` with:
   ```json
   { "answer": "Paris", "timeToAnswerMs": 3420 }
   ```
5. **Workflow listens for delegate updates** and collects all answers
6. **Scoring uses `timeToAnswerMs`** from frontend (trusted - handles network fairness)

### Delegate Schema for Answers
```typescript
z.object({
  answer: z.string(),
  timeToAnswerMs: z.number(), // Time from question display to answer submit
})
```

---

## Project Structure

```
examples/trivia/
├── bot/
│   ├── agent.config.ts           # Config with delegate integration + user state
│   ├── package.json
│   └── src/
│       ├── conversations/
│       │   └── index.ts          # Main handler (lobby, game tools)
│       ├── workflows/
│       │   └── play-quiz.ts      # Single workflow: fetches questions, runs game loop
│       ├── tables/
│       │   └── games.ts          # Game state + players (embedded)
│       └── utils/
│           ├── join-code.ts      # Generate ABC123 codes
│           ├── open-trivia-api.ts # Fetch from opentdb.com
│           └── scoring.ts        # first-right, time-right, all-right
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        └── components/
            ├── TriviaRenderer.tsx    # Routes custom message types
            ├── LobbyCard.tsx         # Waiting room with join code
            ├── QuestionCard.tsx      # Question + timer + delegate fulfill
            ├── ScoreCard.tsx         # Post-question scores
            └── LeaderboardCard.tsx   # Final rankings
```

---

## Database Tables

### gamesTable (Single Table)
| Column | Type | Description |
|--------|------|-------------|
| visibleCreatorId | string | Creator's user ID |
| joinCode | string | 6-char code (ABC123) |
| status | enum | waiting, playing, completed |
| players | string | JSON: `[{visibleUserId, visibleConversationId, username, score}]` |
| settings | string | JSON: `{categories, difficulty, questionCount, scoreMethod, timerSeconds}` |
| questions | string | JSON array of fetched questions (stored after fetch) |
| currentQuestionIndex | number | Current question (0-indexed) |

**Note:** Players are embedded in the game record since max 20 players. Questions stored after fetch to avoid re-fetching.

---

## Single Workflow: play-quiz

The workflow handles everything: fetching questions, running the game loop, and scoring.

### Input
```typescript
z.object({
  gameId: z.number(),
  players: z.array(z.object({
    visibleUserId: z.string(),
    visibleConversationId: z.string(),
    username: z.string(),
  })),
  settings: z.object({
    categories: z.array(z.string()).default(["any"]),
    difficulty: z.enum(["easy", "medium", "hard", "any"]).default("easy"),
    questionCount: z.number().min(5).max(50).default(10),
    scoreMethod: z.enum(["first-right", "time-right", "all-right"]).default("all-right"),
    timerSeconds: z.number().default(20),
  }),
})
```

### Workflow Steps

```typescript
// Step 1: Fetch questions from Open Trivia DB
const questions = await step("fetch-questions", async () => {
  return await fetchFromOpenTriviaDB(settings);
});

// Step 2-N: One step per question
for (let i = 0; i < questions.length; i++) {
  const question = questions[i];

  // 2a. Create delegates for all players (parallel)
  const delegates = await step(`create-delegates-${i}`, async () => {
    return await Promise.all(players.map(player =>
      actions.delegate.create({
        name: "trivia-answer",
        input: { questionIndex: i, visibleUserId: player visibleUserId },
        schema: answerSchema.toJSONSchema(),
        ttl: settings.timerSeconds + 5, // Buffer for network
        ack: 5,
        subscribe: true,
      })
    ));
  });

  // 2b. Broadcast question + delegate to each player
  await step(`broadcast-question-${i}`, async () => {
    for (let j = 0; j < players.length; j++) {
      await client.createMessage({
        conversationId: players[j].visibleConversationId,
        userId: botId,
        type: "custom",
        payload: {
          name: "trivia_question",
          url: "custom://trivia_question",
          data: {
            questionIndex: i,
            totalQuestions: questions.length,
            question: question.text,
            questionType: question.type, // true_false, multiple_choice, text_input
            options: question.options,
            timerSeconds: settings.timerSeconds,
            delegate: delegates[j].delegate, // Include delegate for this player
          },
        },
      });
    }
  });

  // 2c. Wait for timer + collect answers
  const answers = await step(`collect-answers-${i}`, async ({ attempt }) => {
    await step.sleep(`timer-${i}`, settings.timerSeconds * 1000);

    // Fetch all delegate statuses
    const results = await Promise.all(delegates.map(d =>
      actions.delegate.get({ id: d.delegate.id })
    ));

    return results.map((r, j) => ({
      visibleUserId: players[j].visibleUserId,
      username: players[j].username,
      status: r.delegate.status,
      answer: r.delegate.output?.answer,
      timeToAnswerMs: r.delegate.output?.timeToAnswerMs,
    }));
  });

  // 2d. Score answers
  const scores = await step(`score-${i}`, async () => {
    return scoreAnswers(answers, question.correctAnswer, settings.scoreMethod, settings.timerSeconds);
  });

  // 2e. Update player scores in state
  state.players = updatePlayerScores(state.players, scores);

  // 2f. Broadcast scores to all players
  await step(`broadcast-scores-${i}`, async () => {
    for (const player of players) {
      const playerScore = scores.find(s => s visibleUserId === player.visibleUserId);
      await client.createMessage({
        conversationId: player.visibleConversationId,
        userId: botId,
        type: "custom",
        payload: {
          name: "trivia_score",
          url: "custom://trivia_score",
          data: {
            questionIndex: i,
            correctAnswer: question.correctAnswer,
            yourAnswer: playerScore?.answer,
            yourPoints: playerScore?.points || 0,
            isCorrect: playerScore?.isCorrect,
            leaderboard: getLeaderboard(state.players),
            isLastQuestion: i === questions.length - 1,
            isCreator: player.visibleUserId === creatorUserId,
          },
        },
      });
    }
  });

  // 2g. Wait for creator to click "Next" (except last question)
  if (i < questions.length - 1) {
    await step.request(`wait-next-${i}`);
  }
}

// Final: Broadcast leaderboard
await step("broadcast-leaderboard", async () => {
  const finalLeaderboard = getLeaderboard(state.players);
  for (const player of players) {
    await client.createMessage({
      conversationId: player.visibleConversationId,
      userId: botId,
      type: "custom",
      payload: {
        name: "trivia_leaderboard",
        url: "custom://trivia_leaderboard",
        data: {
          leaderboard: finalLeaderboard,
          isCreator: player.visibleUserId === creatorUserId,
        },
      },
    });
  }
});
```

---

## Conversation Handler

Handles pre-game flow: username, create/join, settings, start.

### Tools

| Tool | Description | Who |
|------|-------------|-----|
| setUsername | Set player display name | All (blocking if not set) |
| createGame | Create game, get join code | All |
| joinGame | Join with code | All |
| updateSettings | Change game settings | Creator only |
| startGame | Trigger play-quiz workflow | Creator only |
| nextQuestion | Call workflow.provide() to advance | Creator only |

### Dynamic Instructions

```typescript
const getInstructions = (user, state) => {
  if (!user.state.username) {
    return "Ask the user to set their username. This is required before they can play.";
  }

  if (!state.currentGameId) {
    return `Welcome ${user.state.username}! Ask if they want to CREATE a new game or JOIN an existing one.`;
  }

  if (state.isCreator && state.gameStatus === "waiting") {
    return `You are hosting game ${state.joinCode}. Players: ${state.playerCount}.
            You can update settings or start the game when ready.`;
  }

  if (!state.isCreator && state.gameStatus === "waiting") {
    return `You joined game ${state.joinCode}. Waiting for host to start...`;
  }

  return "Game in progress. Answer questions via the custom UI.";
};
```

---

## Scoring Logic

### first-right
```typescript
// First correct answer gets 100, others get 0
const correctAnswers = answers.filter(a => a.answer === correctAnswer);
if (correctAnswers.length === 0) return answers.map(a => ({ ...a, points: 0 }));

correctAnswers.sort((a, b) => a.timeToAnswerMs - b.timeToAnswerMs);
const winner = correctAnswers[0];

return answers.map(a => ({
  ...a,
  isCorrect: a.answer === correctAnswer,
  points: a.visibleUserId === winner.visibleUserId ? 100 : 0,
}));
```

### time-right
```typescript
// Points proportional to speed (faster = more points)
const maxTime = timerSeconds * 1000;
return answers.map(a => {
  if (a.answer !== correctAnswer) return { ...a, isCorrect: false, points: 0 };

  const ratio = Math.max(0, 1 - (a.timeToAnswerMs / maxTime));
  return { ...a, isCorrect: true, points: Math.round(ratio * 100) };
});
```

### all-right
```typescript
// Everyone correct gets 100
return answers.map(a => ({
  ...a,
  isCorrect: a.answer === correctAnswer,
  points: a.answer === correctAnswer ? 100 : 0,
}));
```

### Text Answer Evaluation (with zai)
```typescript
// For text_input questions, use zai for typo tolerance
const evaluation = await adk.zai.extract(
  `User answer: "${userAnswer}"\nCorrect answer: "${correctAnswer}"`,
  z.object({
    isCorrect: z.boolean(),
    similarity: z.number().min(0).max(1),
  })
);
// Award partial points: Math.round(evaluation.similarity * 100)
```

---

## Custom Message Types

| Type | Payload | Purpose |
|------|---------|---------|
| `trivia_lobby` | `{joinCode, players[], settings, isCreator, canStart}` | Waiting room |
| `trivia_question` | `{question, options, timerSeconds, delegate, questionIndex}` | Question + answer controls |
| `trivia_score` | `{correctAnswer, yourAnswer, yourPoints, leaderboard[], isCreator}` | Post-question |
| `trivia_leaderboard` | `{leaderboard[], isCreator}` | Final rankings |

---

## Frontend Components

### QuestionCard
- Displays question text and options
- Countdown timer (progress bar) based on `timerSeconds`
- Answer buttons (True/False, Multiple Choice) or text input
- **On answer**:
  1. Calculate `timeToAnswerMs = Date.now() - displayTime`
  2. Call `fetch(delegate.fulfill_url, { method: 'POST', body: JSON.stringify({ answer, timeToAnswerMs }) })`
  3. Disable controls, show "Waiting for results..."

### ScoreCard
- Shows correct answer (green) vs your answer (red if wrong)
- Points earned this round
- Mini leaderboard (top 5)
- "Next Question" button (creator only)
- "Waiting for host..." (players)

### LeaderboardCard
- Final rankings with medals (🥇🥈🥉)
- Total scores
- "Play Again" button (creator only)

### LobbyCard
- Large join code display (copyable)
- Player list with avatars
- Settings panel (creator only): category, difficulty, question count, score method
- "Start Game" button (creator only, enabled when 2+ players)

---

## Installation

```bash
cd examples/trivia/bot
adk i agi/delegate  # Install delegate integration
```

### agent.config.ts
```typescript
export default defineConfig({
  name: "trivia-quiz",
  description: "Multiplayer trivia quiz game",

  defaultModels: {
    autonomous: "anthropic:claude-sonnet-4-5-20250929",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: { state: z.object({}) },

  user: {
    state: z.object({
      username: z.string().optional(),
    }),
  },

  dependencies: {
    integrations: {
      delegate: { version: "agi/delegate@0.1.0", enabled: true },
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
```

---

## Implementation Order

### Phase 1: Bot Foundation
1. Create `agent.config.ts` with delegate integration
2. Create `gamesTable`
3. Create utility files (join-code, open-trivia-api, scoring)

### Phase 2: Conversation & Tools
4. Create game tools (setUsername, createGame, joinGame, updateSettings, startGame)
5. Create conversation handler with dynamic instructions

### Phase 3: Workflow
6. Create `play-quiz` workflow with delegate pattern
7. Implement question loop with broadcasts

### Phase 4: Frontend
8. Setup Vite + React project
9. Create TriviaRenderer (routes custom messages)
10. Create QuestionCard with delegate fulfillment
11. Create ScoreCard, LeaderboardCard, LobbyCard

---

## Reference Files

- `/Users/sly/test-delegate/src/workflows/delegate.ts` - Delegate workflow pattern
- `/Users/sly/test-delegate/agent.config.ts` - Delegate integration config
- `/Users/sly/delegate/` - Delegate integration source
- `/Users/sly/adk/examples/clause-extraction/bot/` - Complex workflow patterns
- `/Users/sly/adk/examples/clause-extraction/frontend/` - Frontend patterns

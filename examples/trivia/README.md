# Trivia Quiz

A multiplayer real-time trivia game built with the Botpress ADK, featuring lobby-based matchmaking, customizable game settings, and live leaderboards.

## Use Case

Building multiplayer experiences with AI requires coordinating real-time input from multiple users, managing game state, and handling timed interactions. This example demonstrates how to:

- Create a **lobby system** for game discovery and matchmaking
- Handle **real-time player input** with timed responses using Delegates
- Manage **game state** across multiple players with Workflows
- Use **AI-powered answer validation** for flexible text input matching

## How It Works

1. Players create or join games using a **4-character join code**
2. The game creator configures settings (categories, difficulty, timer, scoring)
3. When the game starts, a **Workflow** orchestrates the question flow
4. Each question creates **Delegates** for real-time answer collection
5. Answers are scored and the **leaderboard updates** after each question

## Key Features

### Multiplayer Lobby System

- Join code-based matchmaking (no conversation ID sharing needed)
- Real-time participant list updates
- Creator-only game controls
- Up to 20 players per game

### Customizable Game Settings

| Setting | Options |
|---------|---------|
| Categories | Any, Science, History, Geography, Sports, Entertainment, and more |
| Difficulty | Easy, Medium, Hard, or Any |
| Questions | 5-50 per game |
| Timer | 10-60 seconds per question |
| Scoring | First-Right, Speed Bonus, or All-Right |

### Question Types

- **Multiple Choice** - 4 randomized options
- **True/False** - Simple binary choice
- **Text Input** - AI-powered fuzzy matching for typos and variations

### Scoring Methods

- **First-Right**: First correct answer gets 100 points
- **Speed Bonus**: Points proportional to answer speed (faster = more points)
- **All-Right**: Everyone who answers correctly gets 100 points

## Architecture

### Three-Layer Communication

```
Frontend (Lobby)
  ↓ JSON requests
Lobby Handler → Creates/joins game conversations
  ↓
Game Host Handler → Manages settings, starts game
  ↓
Play Quiz Workflow → Orchestrates questions, scores, leaderboard
  ↓ Delegates
Players submit answers in real-time
```

### Key Patterns

**Conversation Routing with Tags**
```typescript
if (props.conversation.tags.type !== "game") {
  return { handled: false };
}
```

**Delegate Pattern for Timed Input**
```typescript
const delegate = await adk.delegate.create({
  integration: "delegate",
  ttlSeconds: timerSeconds + 10,
  ackTimeoutSeconds: 5,
});
// Players submit via delegate.fulfill URL
```

**AI-Powered Answer Validation**
```typescript
const result = await adk.zai.extract(
  `User answered: "${userAnswer}". Correct answer: "${correctAnswer}"`,
  { isCorrect: z.boolean() }
);
```

## File Structure

```
bot/src/
├── conversations/
│   ├── index.ts          # Main handler routing
│   ├── lobby.ts          # Join/create/leave logic
│   └── game-host/        # Game command handlers
│       ├── index.ts
│       ├── start-game.ts
│       ├── update-settings.ts
│       └── close-game.ts
├── workflows/
│   └── play-quiz.ts      # Main game loop
└── utils/
    ├── open-trivia-api.ts
    ├── scoring.ts
    └── join-code.ts

frontend/
├── index.html
└── src/
    └── components/trivia/
        ├── LobbyCard.tsx
        ├── QuestionCard.tsx
        ├── ScoreCard.tsx
        └── LeaderboardCard.tsx
```

## Game Flow

1. **Lobby** - Create game or enter join code
2. **Waiting Room** - Players join, creator adjusts settings
3. **Game Start** - Creator starts when ready (minimum 2 players)
4. **Questions** - Timed questions with real-time answer submission
5. **Scoring** - Results shown after each question
6. **Leaderboard** - Final standings displayed at game end

## Dependencies

- [Open Trivia Database](https://opentdb.com/) - Question source
- Delegate Integration - Real-time answer collection
- Webchat Integration - Frontend communication

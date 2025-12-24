Trivia Bot

Create an agent that will host a multiplayer trivia quiz game.
The game play goes as follows:

- Your conversation starts by choosing a username.
- Your username is stored in user state, so it is remembered. However, the bot will still tell you that you can change your username if you want (but it is non-blocking if already set). This step is blocking if username is not set.
- Once username is set, the bot starts by suggesting the user if want to CREATE or JOIN a game
- When you CREATE a game (player is called "CREATOR"), you will be given a JOIN CODE to give your friends
- The CREATOR chooses the settings (GAME SETTINGS) for the game:
  - categorie(s) (defaults to "all")
  - difficulty (defaults to easy)
  - language (defaults to english)
  - number of questions
  - SCORE METHOD
    - first-right (ie. the first player to get it right has +100, others +0)
    - time-right (ie. all players that get it right has +X (out of 100) points proportional to how quick they were, 0 if wrong)
    - all-right (ie. all players who get it right have +100 regardless of their speed)
- If you choose to JOIN a game, you need to provide a valid JOIN CODE
- A JOIN CODE is valid as long as the quiz is not started yet and game has not expired
- Each player has its own conversation with the bot. It is not a multiplayer chat.
- When a player joins a game, a message is broadcasted to all chats of the game (all players) to tell them a new participant joined and how many participants total there are
- The creator of the game decides when the game starts
- The GAME SETTINGS can be changed at any point before the game starts. When settings change, a broadcast is sent to all players
- Each game has a fixed amount of GAME QUESTION that are created before the game starts
- A GAME QUESTION can be of the below type. Each question has its own KEYBOARD, ie. the type of question drives the UI for the keyboard.
  - True / False (buttons)
  - Pick one (buttons)
  - Type the correct answer (free text)
- Each GAME QUESTION has a timer (a progress-bar like that goes down to zero). When it expires, the controls (KEYBOARD) is no longer valid.
- After the question expires, points are awarded to players according to the GAME SETTINGS -> SCORE METHOD
- The points are shown after each question to all players, along with a 15s pause before the next question starts (the GAME CREATOR has the front-end control of the "Next Question" tool. the GAME CREATOR can pause the game for longer if a break is needed. when the GAME CREATOR hits "next" it starts the next question)
- GAME QUESTION is broadcasted to all players individually. Answers are collected by the agent in a table. When the question expires, the workflow for the GAME QUESTION resumes and looks up the table for player answers. Only one answer is possible per player. Once an answer is submitted, you cannot change your answer.
- At the end of all the questions, there's a LEADERBOARD widget displayed to all players. The GAME CREATOR can decide to create a new guiz in the same game, which ultimately just created a new workflow with the same participants.
- Here are the workflows:
  - "create_quiz" -> creates a quiz of X questions with the GAME SETTINGS as input
  - "play_quiz" -> given a quiz object (output of create_quiz workflow) + an array of "conversationId" (of each player, up to 20 max), runs a quiz that broadcasts all questions, sleeps, give points, show them, and so on for each question, then shows final score at the end (LEADERBOARD). This quiz is responsible for sending messages directly to players through the client.createMessage on all convos. It is also responsible for reading the table to get the answer for each player (convoId) and evaluating if they got it right or not. For free text (type the correct answer), the evaluation will be tolerant to typos and will award fractional points if the answer is partially correct. This is done with zai.
- When a player answers, they are essentially calling a tool that creates a row in the table with their answer.

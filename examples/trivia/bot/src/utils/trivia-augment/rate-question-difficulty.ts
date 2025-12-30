import { adk } from "@botpress/runtime";
import dedent from "dedent";

const examples = [
  {
    question: "What is the capital of France?",
    category: "Geography",
    correctAnswer: "Paris",
    difficulty: "easy",
    explanation:
      "Most people know that Paris is the capital of France, and this is a common trivia question",
  },
  {
    question: "Which element has the chemical symbol 'Fe'?",
    category: "Science",
    correctAnswer: "Iron",
    difficulty: "medium",
    explanation:
      "While 'Fe' is the chemical symbol for Iron, it may not be immediately obvious to everyone, making it a moderately challenging question",
  },
  {
    question: "In which year did the Titanic sink?",
    category: "History",
    correctAnswer: "1912",
    difficulty: "hard",
    explanation:
      "The sinking of the Titanic in 1912 is a specific historical fact that may not be widely known, making it a difficult question for many",
  },
  {
    question: "Who wrote the play 'Romeo and Juliet'?",
    category: "Literature",
    correctAnswer: "William Shakespeare",
    difficulty: "easy",
    explanation:
      "William Shakespeare is famously known for writing 'Romeo and Juliet', making this an easy question for those familiar with classic literature",
  },
  {
    question: "What is the largest planet in our solar system?",
    category: "Science",
    correctAnswer: "Jupiter",
    difficulty: "medium",
    explanation:
      "Jupiter is the largest planet in our solar system, but some may confuse it with Saturn or other large planets, making it a moderately challenging question",
  },
  {
    question: "What Is The Original Name For Halloween?",
    category: "Culture",
    correctAnswer: "Samhain",
    difficulty: "hard",
    explanation:
      "Samhain is the ancient Celtic festival that Halloween originated from, and this fact is not commonly known, making it a difficult question",
  },
];

export async function rateQuestionDifficulty(
  question: string,
  category: string,
  correctAnswer: string
): Promise<"easy" | "medium" | "hard"> {
  const incorrectAnswers = await adk.zai.label(
    dedent`Given a trivia question, its category, and the correct answer, rate the difficulty of the question as "easy", "medium", or "hard".
      The difficulty should be based on how challenging it would be for an average person to answer the question correctly.
      Now, rate the difficulty for the following question:
      Question: "${question}"
      Category: "${category}"
      Correct Answer: "${correctAnswer}"
      `,
    {
      easy: "if the question is straightforward and can be answered by most people without specialized knowledge",
      medium:
        "if the question requires some thought or general knowledge but is still answerable by many",
      hard: "if the question is tricky, requires specific knowledge, or could easily confuse people",
    },
    {
      examples: examples.map((ex) => ({
        input: JSON.stringify({
          question: ex.question,
          category: ex.category,
          correctAnswer: ex.correctAnswer,
        }),
        labels:
          ex.difficulty === "easy"
            ? {
                easy: {
                  label: "ABSOLUTELY_YES",
                  description: ex.explanation,
                },
                medium: {
                  label: "PROBABLY_NOT",
                },
                hard: {
                  label: "ABSOLUTELY_NOT",
                },
              }
            : ex.difficulty === "medium"
              ? {
                  easy: {
                    label: "PROBABLY_NOT",
                  },
                  medium: {
                    label: "ABSOLUTELY_YES",
                    description: ex.explanation,
                  },
                  hard: {
                    label: "PROBABLY_NOT",
                  },
                }
              : {
                  easy: {
                    label: "ABSOLUTELY_NOT",
                  },
                  medium: {
                    label: "PROBABLY_NOT",
                  },
                  hard: {
                    label: "ABSOLUTELY_YES",
                    description: ex.explanation,
                  },
                },
      })),
    }
  );

  return incorrectAnswers.medium
    ? "medium"
    : incorrectAnswers.hard
      ? "hard"
      : "easy";
}

import { adk, z } from "@botpress/runtime";
import dedent from "dedent";

const examples = [
  {
    question: "What is the capital of France?",
    category: "Geography",
    correctAnswer: "Paris",
    difficulty: "easy",
    incorrectAnswers: ["London", "Berlin", "Madrid"],
  },
  {
    question: "Which element has the chemical symbol 'Fe'?",
    category: "Science",
    correctAnswer: "Iron",
    difficulty: "medium",
    incorrectAnswers: ["Fluorine", "Francium", "Fermium"],
  },
  {
    question: "In which year did the Titanic sink?",
    category: "History",
    correctAnswer: "1912",
    difficulty: "hard",
    incorrectAnswers: ["1905", "1915", "1920"],
  },
  {
    question: "Who wrote the play 'Romeo and Juliet'?",
    category: "Literature",
    correctAnswer: "William Shakespeare",
    difficulty: "easy",
    incorrectAnswers: ["Charles Dickens", "Mark Twain", "Jane Austen"],
  },
  {
    question: "What is the largest planet in our solar system?",
    category: "Science",
    correctAnswer: "Jupiter",
    difficulty: "medium",
    incorrectAnswers: ["Saturn", "Neptune", "Earth"],
  },
  {
    question: "What Is The Original Name For Halloween?",
    category: "Culture",
    correctAnswer: "Samhain",
    difficulty: "hard",
    incorrectAnswers: ["Yule", "Beltane", "Lughnasadh"],
  },
];

export async function generateIncorrectAnswers(
  question: string,
  category: string,
  correctAnswer: string,
  difficulty: "easy" | "medium" | "hard"
): Promise<string[]> {
  const incorrectAnswers = await adk.zai.extract(
    dedent`Given a trivia question, generate exactly 3 incorrect answers that are plausible but definitely wrong.

            Difficulty explained:
            - Easy: Simple and obvious incorrect answers.
            - Medium: Somewhat tricky incorrect answers that require thought.
            - Hard: Very plausible incorrect answers that could easily be mistaken for the correct one.
            
            Provide only the incorrect answers as a list without any additional text.
            We want exactly 3 incorrect answers.

            Here are some examples:
            ${examples
              .map(
                (ex) => dedent`
                <example>
            Question: "${ex.question}"
            Category: "${ex.category}"
            Correct Answer: "${ex.correctAnswer}"
            Difficulty: "${ex.difficulty}"
            Incorrect Answers: ${JSON.stringify(ex.incorrectAnswers)}
                </example>
            `
              )
              .join("\n")}

            Now, generate incorrect answers for the following question:

            Question: "${question}"
            Category: "${category}"
            Correct Answer: "${correctAnswer}"
            Difficulty: "${difficulty}"
            `,
    z.object({
      0: z.string().min(1).describe("First incorrect answer"),
      1: z.string().min(1).describe("Second incorrect answer"),
      2: z.string().min(1).describe("Third incorrect answer"),
    }),
    {
      instructions: `Generate exactly 3 incorrect answers for the trivia question below. The incorrect answers should be plausible but definitely wrong. Provide only the answers as a list without any additional text.`,
    }
  );
  return [incorrectAnswers[0], incorrectAnswers[1], incorrectAnswers[2]];
}

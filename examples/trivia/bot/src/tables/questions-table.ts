import { Table, z } from "@botpress/runtime";

export const QuestionSchema = z.object({
  category: z.string(),
  question: z.string(),
  image: z.string().optional(),
  correct_answer: z.string(),
  incorrect_answers: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
  type: z.enum(["multiple", "boolean"]),
});

export const QuestionsTable = new Table({
  name: "QuestionsTable",
  description: "Table to store trivia questions",
  factor: 5,
  keyColumn: "question",
  columns: {
    category: {
      schema: QuestionSchema.shape.category,
      searchable: true,
    },
    question: {
      schema: QuestionSchema.shape.question,
      searchable: true,
    },
    image: QuestionSchema.shape.image,
    correct_answer: {
      schema: QuestionSchema.shape.correct_answer,
      searchable: true,
    },
    incorrect_answers: QuestionSchema.shape.incorrect_answers,
    difficulty: QuestionSchema.shape.difficulty,
    type: QuestionSchema.shape.type,
  },
});

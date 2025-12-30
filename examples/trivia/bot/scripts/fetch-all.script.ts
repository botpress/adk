import { join } from "path";
import { QuestionSchema, QuestionsTable } from "../src/tables/questions-table";
import { z } from "@botpress/runtime";
import { rateQuestionDifficulty } from "../src/utils/trivia-augment/rate-question-difficulty";
import { generateIncorrectAnswers } from "../src/utils/trivia-augment/generate-incorrect-answers";

// Read the TSV file in memory as an array of { question, category, answer } objects
// Upsert questions in batches to the QuestionsTable (up to 100 at a time)

const BATCH_SIZE = 10;
const UPSERT_COUNT = 50_000;

const content = await Bun.file(
  join(import.meta.dir, "trivia-questions.tsv")
).text();

const questions = content
  .toString()
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .slice(1) // Skip header
  .map((line) => {
    const [category, question, answer] = line.split("\t");
    return { question, category, answer };
  });

for (let i = 0; i < UPSERT_COUNT; i += BATCH_SIZE) {
  if (i % 100 === 0) {
    console.log(`Processing question ${i} / ${UPSERT_COUNT}`);
  }

  const batch = questions.slice(i, i + BATCH_SIZE);
  if (batch.length === 0) {
    break;
  }

  const generated = await Promise.allSettled(
    batch.map(async (q) => {
      const difficulty = await rateQuestionDifficulty(
        q.question,
        q.category,
        q.answer
      );

      return <z.infer<typeof QuestionSchema>>{
        question: q.question,
        category: q.category,
        correct_answer: q.answer,
        type: "multiple",
        difficulty,
        incorrect_answers: await generateIncorrectAnswers(
          q.question,
          q.category,
          q.answer,
          difficulty
        ),
      };
    })
  ).then((results) =>
    results.filter((x) => x.status === "fulfilled").map((res) => res.value)
  );

  const result = await QuestionsTable.upsertRows({
    keyColumn: "question",
    rows: generated.filter(
      (x) =>
        ["easy", "medium", "hard"].includes(x.difficulty) &&
        x.incorrect_answers.length === 3 &&
        x.incorrect_answers.every((ans) => ans !== x.correct_answer) &&
        x.incorrect_answers.every((ans) => ans.trim().length > 0)
    ),
  });

  console.log(`Upserted batch ${i / BATCH_SIZE + 1}:`, result.inserted.length);
}

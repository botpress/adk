import { adk, z } from "@botpress/runtime";
import type { Question } from "./fetch-questions";

/**
 * Schema for translated question content
 */
const TranslatedQuestionSchema = z.object({
  text: z.string().describe("The translated question text"),
  correctAnswer: z.string().describe("The translated correct answer"),
  options: z
    .array(z.string())
    .optional()
    .describe("The translated answer options (if multiple choice)"),
  category: z.string().optional().describe("The translated category name"),
});

/**
 * Translate a single trivia question to the target language
 */
async function translateQuestion(
  question: Question,
  targetLanguage: string
): Promise<Question> {
  const optionsText = question.options
    ? `\nOptions: ${question.options.join(", ")}`
    : "";
  const categoryText = question.category
    ? `\nCategory: ${question.category}`
    : "";

  const prompt = `Translate this trivia question from English to ${targetLanguage}. Keep the same meaning and format.

Question: ${question.text}
Correct Answer: ${question.correctAnswer}${optionsText}${categoryText}

Provide the translation maintaining the exact same structure.`;

  const translated = await adk.zai.extract(prompt, TranslatedQuestionSchema);

  return {
    ...question,
    text: translated.text,
    correctAnswer: translated.correctAnswer,
    options: translated.options || question.options,
    category: translated.category || question.category,
  };
}

/**
 * Translate all questions to the target language
 * Only translates if language is not English
 */
export async function translateQuestions(
  questions: Question[],
  language: string
): Promise<Question[]> {
  // No translation needed for English
  if (language.toLowerCase() === "english") {
    return questions;
  }

  console.log(`[Translate] Translating ${questions.length} questions to ${language}...`);

  const translated = await Promise.all(
    questions.map((q) => translateQuestion(q, language))
  );

  console.log(`[Translate] Translation complete`);
  return translated;
}

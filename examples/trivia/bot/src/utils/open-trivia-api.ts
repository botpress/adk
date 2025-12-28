const API_BASE = "https://opentdb.com/api.php";

/**
 * Question structure from Open Trivia DB
 */
export interface Question {
  text: string;
  type: "true_false" | "multiple_choice" | "text_input";
  correctAnswer: string;
  options?: string[];
  category?: string;
  difficulty?: string;
}

/**
 * Open Trivia Database API response
 */
interface OpenTriviaResponse {
  response_code: number;
  results: Array<{
    category: string;
    type: "boolean" | "multiple";
    difficulty: "easy" | "medium" | "hard";
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
  }>;
}

/**
 * Category mapping for Open Trivia DB
 * See: https://opentdb.com/api_category.php
 */
export const CATEGORIES: Record<string, number> = {
  general: 9,
  books: 10,
  film: 11,
  music: 12,
  theatre: 13,
  television: 14,
  videogames: 15,
  boardgames: 16,
  science: 17,
  computers: 18,
  math: 19,
  mythology: 20,
  sports: 21,
  geography: 22,
  history: 23,
  politics: 24,
  art: 25,
  celebrities: 26,
  animals: 27,
  vehicles: 28,
  comics: 29,
  gadgets: 30,
  anime: 31,
  cartoons: 32,
};

/**
 * Decode HTML entities from API response
 */
function decodeHtml(html: string): string {
  const entities: Record<string, string> = {
    "&quot;": '"',
    "&#039;": "'",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&hellip;": "...",
    "&eacute;": "é",
    "&Eacute;": "É",
  };

  return html.replace(
    /&[#\w]+;/g,
    (match) => entities[match] || decodeURIComponent(match)
  );
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Fetch trivia questions from Open Trivia Database
 */
export async function fetchTriviaQuestions(opts: {
  count: number;
  category?: string;
  difficulty?: "easy" | "medium" | "hard" | "any";
}): Promise<Question[]> {
  const { count, category, difficulty } = opts;

  const params = new URLSearchParams({
    amount: count.toString(),
  });

  // Add category if specified
  if (category && category !== "any" && CATEGORIES[category.toLowerCase()]) {
    params.append("category", CATEGORIES[category.toLowerCase()].toString());
  }

  // Add difficulty if specified
  if (difficulty && difficulty !== "any") {
    params.append("difficulty", difficulty);
  }

  const url = `${API_BASE}?${params}`;
  console.log(`[OpenTriviaAPI] Fetching questions: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Trivia API error: ${response.status}`);
  }

  const data = (await response.json()) as OpenTriviaResponse;

  if (data.response_code !== 0) {
    const errorMessages: Record<number, string> = {
      1: "Not enough questions available for the requested parameters",
      2: "Invalid parameter in request",
      3: "Token not found",
      4: "Token exhausted",
    };
    throw new Error(
      errorMessages[data.response_code] || `API error code: ${data.response_code}`
    );
  }

  // Transform API response to our Question format
  return data.results.map((q) => {
    const text = decodeHtml(q.question);
    const correctAnswer = decodeHtml(q.correct_answer);

    if (q.type === "boolean") {
      return {
        text,
        type: "true_false" as const,
        correctAnswer,
        options: ["True", "False"],
        category: q.category,
        difficulty: q.difficulty,
      };
    }

    // Multiple choice - shuffle options with correct answer included
    const incorrectAnswers = q.incorrect_answers.map(decodeHtml);
    const allOptions = shuffleArray([correctAnswer, ...incorrectAnswers]);

    return {
      text,
      type: "multiple_choice" as const,
      correctAnswer,
      options: allOptions,
      category: q.category,
      difficulty: q.difficulty,
    };
  });
}

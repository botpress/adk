import { useState, useEffect, useRef, type FC } from "react";
import type { QuestionData } from "./types";
import {
  playTimerTick,
  playTimeExpired,
  playSubmit,
  playQuestionStart,
} from "../../lib/sounds";

interface QuestionCardProps {
  data: QuestionData;
}

const QuestionCard: FC<QuestionCardProps> = ({ data }) => {
  const {
    questionIndex,
    totalQuestions,
    question,
    questionType,
    options,
    category,
    difficulty,
    timerSeconds,
    delegate,
  } = data;

  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const displayTimeRef = useRef(Date.now());
  const hasAckedRef = useRef(false);

  // Acknowledge delegate on mount and play question start sound
  useEffect(() => {
    if (!hasAckedRef.current && delegate.ack_url) {
      hasAckedRef.current = true;
      fetch(delegate.ack_url, { method: "POST" }).catch(console.error);
      displayTimeRef.current = Date.now();
      playQuestionStart();
    }
  }, [delegate.ack_url]);

  // Timer countdown - keeps running even after submission
  useEffect(() => {
    if (isExpired) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          setIsExpired(true);
          playTimeExpired();
          return 0;
        }
        // Play timer tick sound in last 5 seconds
        if (newTime <= 5) {
          playTimerTick();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired]);

  const submitAnswer = async (answer: string) => {
    if (isSubmitted || isExpired) return;

    const timeToAnswerMs = Date.now() - displayTimeRef.current;
    setSelectedAnswer(answer);
    setIsSubmitted(true);
    playSubmit();

    try {
      await fetch(delegate.fulfill_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, timeToAnswerMs }),
      });
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  };

  const handleTextSubmit = () => {
    if (textAnswer.trim()) {
      submitAnswer(textAnswer.trim());
    }
  };

  const progress = (timeLeft / timerSeconds) * 100;
  const isLowTime = timeLeft <= 5;

  return (
    <div className={`trivia-question ${isExpired ? "expired" : ""}`}>
      {/* Header */}
      <div className="question-header">
        <span className="question-number">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        {category && (
          <span className="question-category">{category}</span>
        )}
        {difficulty && (
          <span className={`question-difficulty ${difficulty}`}>
            {difficulty}
          </span>
        )}
      </div>

      {/* Timer */}
      <div className="question-timer">
        <div
          className={`timer-bar ${isLowTime ? "low-time" : ""}`}
          style={{ width: `${progress}%` }}
        />
        <span className={`timer-text ${isLowTime ? "low-time" : ""}`}>
          {timeLeft}s
        </span>
      </div>

      {/* Question text */}
      <div className="question-text">{question}</div>

      {/* Answer controls */}
      <div className="question-answers">
        {isSubmitted ? (
          <div className="answer-submitted">
            <span className="submitted-icon">✓</span>
            <span>Answer submitted! Waiting for results...</span>
          </div>
        ) : isExpired ? (
          <div className="answer-expired">
            <span className="expired-icon">⏱</span>
            <span>Time's up!</span>
          </div>
        ) : questionType === "true_false" ? (
          <div className="answer-buttons tf-buttons">
            <button
              className={`answer-btn true-btn ${selectedAnswer === "True" ? "selected" : ""}`}
              onClick={() => submitAnswer("True")}
            >
              True
            </button>
            <button
              className={`answer-btn false-btn ${selectedAnswer === "False" ? "selected" : ""}`}
              onClick={() => submitAnswer("False")}
            >
              False
            </button>
          </div>
        ) : questionType === "multiple_choice" && options ? (
          <div className="answer-buttons mc-buttons">
            {options.map((option, index) => (
              <button
                key={index}
                className={`answer-btn mc-btn ${selectedAnswer === option ? "selected" : ""}`}
                onClick={() => submitAnswer(option)}
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="answer-input">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              placeholder="Type your answer..."
              autoFocus
            />
            <button
              className="submit-btn"
              onClick={handleTextSubmit}
              disabled={!textAnswer.trim()}
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionCard;

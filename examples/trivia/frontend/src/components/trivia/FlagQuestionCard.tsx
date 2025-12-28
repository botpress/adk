import { useState, useEffect, useRef, type FC } from "react";
import type { QuestionData } from "./types";
import {
  playTimerTick,
  playTimeExpired,
  playSubmit,
  playQuestionStart,
} from "../../lib/sounds";

interface FlagQuestionCardProps {
  data: QuestionData;
}

const FlagQuestionCard: FC<FlagQuestionCardProps> = ({ data }) => {
  const {
    questionIndex,
    totalQuestions,
    question,
    options,
    category,
    difficulty,
    timerSeconds,
    delegate,
    flagData,
  } = data;

  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
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

  // Timer countdown
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

  const progress = (timeLeft / timerSeconds) * 100;
  const isLowTime = timeLeft <= 5;

  // Get flag URL - prefer flagData.flagUrl, fallback to constructing it
  const flagUrl = flagData?.flagUrl ||
    (flagData?.countryCode
      ? `https://flagcdn.com/w320/${flagData.countryCode}.png`
      : null);

  return (
    <div className={`trivia-question flag-question ${isExpired ? "expired" : ""}`}>
      {/* Header */}
      <div className="question-header">
        <span className="question-number">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        {category && <span className="question-category">{category}</span>}
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

      {/* Flag Image */}
      <div className="flag-container">
        {flagUrl && (
          <>
            {!imageLoaded && (
              <div className="flag-loading">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={flagUrl}
              alt="Flag"
              className="flag-image"
              style={{ display: imageLoaded ? "block" : "none" }}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                // Fallback to a different size if the image fails
                const img = e.target as HTMLImageElement;
                if (!img.src.includes("w160")) {
                  img.src = `https://flagcdn.com/w160/${flagData?.countryCode}.png`;
                }
              }}
            />
          </>
        )}
      </div>

      {/* Answer controls - Multiple choice */}
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
        ) : options ? (
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
              placeholder="Type the country name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    submitAnswer(input.value.trim());
                  }
                }
              }}
              autoFocus
            />
            <button
              className="submit-btn"
              onClick={(e) => {
                const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                if (input.value.trim()) {
                  submitAnswer(input.value.trim());
                }
              }}
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlagQuestionCard;

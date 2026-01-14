import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Check, X, RotateCcw } from "lucide-react";

// Props for the Quiz component
interface QuizProps {
  postSlug: string; // Slug of the post to fetch quiz for
}

// Quiz state interface
interface QuizState {
  selectedAnswers: Map<string, number>; // questionId -> selected option index
}

// Quiz component for testing understanding of tutorials
// Displays multiple choice questions, validates answers, shows score
// Saves results to Convex for progress tracking
export default function Quiz({ postSlug }: QuizProps) {
  // Fetch quiz data
  const quiz = useQuery(api.quiz.getQuizByPostSlug, { postSlug });

  // Get or create session ID for anonymous quiz tracking
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem("quiz_session_id");
    if (stored) return stored;
    const newId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem("quiz_session_id", newId);
    return newId;
  });

  // Get previous submission if exists
  const previousSubmission = useQuery(api.quiz.getPreviousSubmission, {
    sessionId,
    postSlug,
  });

  // Submit mutation
  const submitQuiz = useMutation(api.quiz.submitQuiz);

  // Component state
  const [quizState, setQuizState] = useState<QuizState>({
    selectedAnswers: new Map(),
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    percentage: number;
    answers: Array<{ questionId: string; selectedAnswer: number; isCorrect: boolean }>;
  } | null>(null);

  // Initialize from previous submission if available
  useEffect(() => {
    if (previousSubmission && !submitted) {
      const savedAnswers = new Map<string, number>();
      previousSubmission.answers.forEach((ans) => {
        savedAnswers.set(ans.questionId, ans.selectedAnswer);
      });
      setQuizState({ selectedAnswers: savedAnswers });
      setSubmitted(true);
      setResult({
        score: previousSubmission.score,
        total: previousSubmission.totalQuestions,
        percentage: previousSubmission.percentage,
        answers: previousSubmission.answers,
      });
    }
  }, [previousSubmission, submitted]);

  // Handle option selection
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (submitted) return; // Prevent changes after submission
    setQuizState((prev: QuizState) => ({
      selectedAnswers: new Map(prev.selectedAnswers).set(questionId, optionIndex),
    }));
  };

  // Handle quiz submission
  const handleSubmit = async () => {
    if (!quiz || submitting) return;

    // Validate all questions are answered
    const unanswered = quiz.questions.filter(
      (q) => !quizState.selectedAnswers.has(q.id)
    );

    if (unanswered.length > 0) {
      alert(`Please answer all questions before submitting. (${unanswered.length} remaining)`);
      return;
    }

    setSubmitting(true);

    try {
      const answers: Array<{ questionId: string; selectedAnswer: number }> =
        Array.from(quizState.selectedAnswers.entries()).map(
          ([questionId, selectedAnswer]: [string, number]) => ({
            questionId,
            selectedAnswer,
          })
        );

      const submissionResult = await submitQuiz({
        quizId: quiz._id,
        sessionId,
        answers,
      });

      setResult({
        score: submissionResult.score,
        total: submissionResult.totalQuestions,
        percentage: submissionResult.percentage,
        answers: submissionResult.answers,
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit quiz:", error);
      alert("Failed to submit quiz. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle retry
  const handleRetry = () => {
    setQuizState({ selectedAnswers: new Map() });
    setSubmitted(false);
    setResult(null);
  };

  // Loading state
  if (quiz === undefined) {
    return (
      <div className="quiz">
        <div className="quiz__loading">Loading quiz...</div>
      </div>
    );
  }

  // No quiz available
  if (!quiz) {
    return null;
  }

  // Calculate progress
  const answeredCount = quizState.selectedAnswers.size;
  const totalCount = quiz.questions.length;
  const isComplete = answeredCount === totalCount;
  const canSubmit = isComplete && !submitted;

  // Render quiz
  return (
    <section className="quiz">
      <div className="quiz__content">
        {quiz.description && (
          <p className="quiz__description">{quiz.description}</p>
        )}

        {/* Progress indicator */}
        <div className="quiz__progress">
          <span className="quiz__progress-text">
            {answeredCount} of {totalCount} questions answered
          </span>
          <div className="quiz__progress-bar">
            <div
              className="quiz__progress-fill"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="quiz__questions">
          {quiz.questions.map((question, index) => {
            const selectedOption = quizState.selectedAnswers.get(question.id);
            const isCorrect = result?.answers.find(
              (a) => a.questionId === question.id
            )?.isCorrect;
            const showResult = submitted && isCorrect !== undefined;

            return (
              <div key={question.id} className="quiz__question">
                <h4 className="quiz__question-text">
                  <span className="quiz__question-number">{index + 1}.</span>
                  {question.question}
                </h4>

                <div className="quiz__options">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = selectedOption === optionIndex;
                    const isCorrectOption = question.correctAnswer === optionIndex;

                    let className = "quiz__option";
                    if (showResult) {
                      if (isCorrectOption) {
                        className += " quiz__option--correct";
                      } else if (isSelected && !isCorrectOption) {
                        className += " quiz__option--incorrect";
                      }
                    } else if (isSelected) {
                      className += " quiz__option--selected";
                    }

                    return (
                      <button
                        key={optionIndex}
                        className={className}
                        onClick={() =>
                          handleSelectOption(question.id, optionIndex)
                        }
                        disabled={submitted}
                        type="button"
                      >
                        <span className="quiz__option-marker">
                          {showResult && isCorrectOption ? (
                            <Check size={16} />
                          ) : showResult && isSelected && !isCorrectOption ? (
                            <X size={16} />
                          ) : (
                            <span className="quiz__option-letter">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                          )}
                        </span>
                        <span className="quiz__option-text">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation for incorrect answers */}
                {showResult &&
                  !isCorrect &&
                  question.explanation && (
                    <div className="quiz__explanation">
                      <strong>Explanation:</strong> {question.explanation}
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        {/* Results section */}
        {result && (
          <div className="quiz__results">
            <div
              className={`quiz__score ${
                result.percentage >= 80
                  ? "quiz__score--excellent"
                  : result.percentage >= 60
                    ? "quiz__score--good"
                    : "quiz__score--needs-review"
              }`}
            >
              <div className="quiz__score-number">{result.percentage}%</div>
              <div className="quiz__score-text">
                You got {result.score} out of {result.total} correct
              </div>
            </div>
            <button
              className="quiz__retry-button"
              onClick={handleRetry}
              type="button"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
          </div>
        )}

        {/* Submit button */}
        {!submitted && (
          <button
            className="quiz__submit-button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            type="button"
          >
            {submitting ? "Submitting..." : "Submit Answers"}
          </button>
        )}
      </div>
    </section>
  );
}

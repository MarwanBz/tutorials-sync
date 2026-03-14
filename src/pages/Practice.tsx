import { useQuery, useConvexAuth } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { CheckCircle, Clock, Play, TrendingUp } from "lucide-react";

function groupQuizzesByTopic(
  quizzes: Array<{
    _id: string;
    postSlug: string;
    title: string;
    description?: string;
    questionCount: number;
    createdAt: number;
    postTitle: string;
    postTags: string[];
    lastScore?: number;
    lastSubmittedAt?: number;
    nextReviewAt?: number;
    dueNow: boolean;
  }>,
): Record<string, Array<typeof quizzes[0]>> {
  const groups: Record<string, Array<typeof quizzes[0]>> = {
    React: [],
    "React Query": [],
    Databases: [],
    Git: [],
    HTTP: [],
    Express: [],
    Other: [],
  };

  for (const quiz of quizzes) {
    let grouped = false;
    for (const topic of Object.keys(groups)) {
      if (topic === "Other") continue;
      if (
        quiz.postTags.some(
          (tag) => tag.toLowerCase() === topic.toLowerCase() || tag.toLowerCase().includes(topic.toLowerCase()),
        )
      ) {
        groups[topic].push(quiz);
        grouped = true;
        break;
      }
    }

    if (!grouped) {
      groups.Other.push(quiz);
    }
  }

  return groups;
}

function getScoreColor(score?: number): string {
  if (score === undefined) return "";
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

function formatLastReviewed(lastSubmittedAt?: number): string {
  if (!lastSubmittedAt) return "Not taken";

  const date = new Date(lastSubmittedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default function Practice() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const overview = useQuery(api.quiz.getMyPracticeOverview, isAuthenticated ? {} : "skip");

  if (authLoading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Practice</h1>
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="page-content">
          <header className="page-header">
            <h1>Practice</h1>
            <p>Sign in to track quiz progress and spaced repetition review dates.</p>
          </header>
          <div className="empty-state">
            <Play size={48} />
            <h2>Authentication required</h2>
            <p>This page uses your account progress and review schedule.</p>
            <Link to="/" className="button-primary">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (overview === undefined) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Practice</h1>
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  const groupedQuizzes = groupQuizzesByTopic(overview.quizzes);

  return (
    <div className="page-container">
      <div className="page-content">
        <header className="page-header">
          <h1>Practice</h1>
          <p>Test your understanding with interactive quizzes. Track your progress and review with spaced repetition.</p>
        </header>

        {overview.totalQuizzes > 0 && (
          <div className="practice-stats">
            <div className="practice-stat">
              <CheckCircle size={20} />
              <div>
                <span className="practice-stat-value">{overview.completedQuizzes}</span>
                <span className="practice-stat-label">Completed</span>
              </div>
            </div>
            <div className="practice-stat">
              <TrendingUp size={20} />
              <div>
                <span className="practice-stat-value">{Math.round(overview.averageScore)}%</span>
                <span className="practice-stat-label">Avg Score</span>
              </div>
            </div>
            <div className="practice-stat">
              <Clock size={20} />
              <div>
                <span className="practice-stat-value">{overview.dueCount}</span>
                <span className="practice-stat-label">Due now</span>
              </div>
            </div>
            <div className="practice-stat">
              <Play size={20} />
              <div>
                <span className="practice-stat-value">{overview.totalQuizzes}</span>
                <span className="practice-stat-label">Total Quizzes</span>
              </div>
            </div>
          </div>
        )}

        {overview.totalQuizzes === 0 && (
          <div className="empty-state">
            <Play size={48} />
            <h2>No quizzes available yet</h2>
            <p>Quizzes will appear here as they're created for each tutorial.</p>
            <Link to="/blog" className="button-primary">
              Browse Tutorials
            </Link>
          </div>
        )}

        {Object.entries(groupedQuizzes).map(([topic, topicQuizzes]) => {
          if (topicQuizzes.length === 0) return null;

          return (
            <div key={topic} className="topic-section">
              <h2 className="topic-heading">{topic}</h2>
              <div className="quiz-list">
                {topicQuizzes.map((quiz) => (
                  <div key={quiz._id} className="quiz-card">
                    <div className="quiz-card-header">
                      <h3 className="quiz-card-title">{quiz.title}</h3>
                      {quiz.lastScore !== undefined && (
                        <span className={`quiz-score-badge ${getScoreColor(quiz.lastScore)}`}>
                          {quiz.lastScore}%
                        </span>
                      )}
                    </div>
                    {quiz.description && <p className="quiz-card-description">{quiz.description}</p>}
                    <div className="quiz-card-meta">
                      <span className="quiz-question-count">{quiz.questionCount} questions</span>
                      <span className="quiz-last-taken">
                        <Clock size={14} />
                        {formatLastReviewed(quiz.lastSubmittedAt)}
                      </span>
                    </div>
                    {quiz.nextReviewAt !== undefined && (
                      <div className="quiz-card-meta">
                        <span className="quiz-last-taken">
                          Review: {new Date(quiz.nextReviewAt).toLocaleDateString()}
                          {quiz.dueNow ? " (due)" : ""}
                        </span>
                      </div>
                    )}
                    <div className="quiz-card-actions">
                      <Link to={`/${quiz.postSlug}`} className="quiz-card-link">
                        Read Tutorial
                      </Link>
                      <Link to={`/${quiz.postSlug}#quiz`} className="button-primary button-small">
                        {quiz.lastSubmittedAt ? "Retake Quiz" : "Start Quiz"}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {overview.totalQuizzes > 0 && (
          <div className="practice-footer">
            <Link to="/blog" className="text-link">
              View all tutorials →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

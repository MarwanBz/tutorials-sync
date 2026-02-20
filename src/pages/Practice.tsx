import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { CheckCircle, Clock, Play, TrendingUp } from "lucide-react";

// Group quizzes by topic based on tags
function groupQuizzesByTopic(
  quizzes: Array<{
    _id: string;
    postSlug: string;
    title: string;
    description?: string;
    questionCount: number;
    createdAt: number;
  }>,
  posts: Array<{
    slug: string;
    title: string;
    tags: string[];
    understanding_score?: number | null;
    last_quizzed?: string | null;
  }>
): Record<string, Array<typeof quizzes[0] & { postTitle: string; postTags: string[]; score?: number | null; lastQuizzed?: string | null }>> {
  const groups: Record<
    string,
    Array<typeof quizzes[0] & { postTitle: string; postTags: string[]; score?: number | null; lastQuizzed?: string | null }>
  > = {
    React: [],
    "React Query": [],
    Databases: [],
    Git: [],
    HTTP: [],
    Express: [],
    Other: [],
  };

  for (const quiz of quizzes) {
    const post = posts.find((p) => p.slug === quiz.postSlug);
    if (!post) continue;

    const item = {
      ...quiz,
      postTitle: post.title,
      postTags: post.tags,
      score: post.understanding_score,
      lastQuizzed: post.last_quizzed,
    };

    // Group by topic based on tags
    let grouped = false;
    for (const topic of Object.keys(groups)) {
      if (topic === "Other") continue;
      if (
        post.tags.some(
          (tag) => tag.toLowerCase() === topic.toLowerCase() || tag.toLowerCase().includes(topic.toLowerCase())
        )
      ) {
        groups[topic].push(item);
        grouped = true;
        break;
      }
    }

    if (!grouped) {
      groups.Other.push(item);
    }
  }

  return groups;
}

// Get score color based on percentage
function getScoreColor(score?: number | null): string {
  if (!score) return "";
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

// Format date for last quizzed
function formatLastQuizzed(lastQuizzed?: string | null): string {
  if (!lastQuizzed) return "Not taken";
  const date = new Date(lastQuizzed);
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
  const quizzes = useQuery(api.quiz.getAllQuizzes);
  const posts = useQuery(api.posts.getAllPosts);

  if (quizzes === undefined || posts === undefined) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Practice</h1>
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  const groupedQuizzes = groupQuizzesByTopic(quizzes, posts);

  // Calculate stats
  const totalQuizzes = quizzes.length;
  const completedQuizzes = posts.filter((p) => p.understanding_score !== null && p.understanding_score !== undefined).length;
  const averageScore =
    completedQuizzes > 0
      ? posts
          .filter((p) => p.understanding_score !== null && p.understanding_score !== undefined)
          .reduce((sum, p) => sum + (p.understanding_score || 0), 0) / completedQuizzes
      : 0;

  return (
    <div className="page-container">
      <div className="page-content">
        <header className="page-header">
          <h1>Practice</h1>
          <p>Test your understanding with interactive quizzes. Track your progress and review with spaced repetition.</p>
        </header>

        {/* Stats Overview */}
        {totalQuizzes > 0 && (
          <div className="practice-stats">
            <div className="practice-stat">
              <CheckCircle size={20} />
              <div>
                <span className="practice-stat-value">{completedQuizzes}</span>
                <span className="practice-stat-label">Completed</span>
              </div>
            </div>
            <div className="practice-stat">
              <TrendingUp size={20} />
              <div>
                <span className="practice-stat-value">{Math.round(averageScore)}%</span>
                <span className="practice-stat-label">Avg Score</span>
              </div>
            </div>
            <div className="practice-stat">
              <Play size={20} />
              <div>
                <span className="practice-stat-value">{totalQuizzes}</span>
                <span className="practice-stat-label">Total Quizzes</span>
              </div>
            </div>
          </div>
        )}

        {/* No quizzes state */}
        {totalQuizzes === 0 && (
          <div className="empty-state">
            <Play size={48} />
            <h2>No quizzes available yet</h2>
            <p>Quizzes will appear here as they're created for each tutorial.</p>
            <Link to="/blog" className="button-primary">
              Browse Tutorials
            </Link>
          </div>
        )}

        {/* Quizzes by Topic */}
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
                      {quiz.score !== null && quiz.score !== undefined && (
                        <span className={`quiz-score-badge ${getScoreColor(quiz.score)}`}>
                          {quiz.score}%
                        </span>
                      )}
                    </div>
                    {quiz.description && <p className="quiz-card-description">{quiz.description}</p>}
                    <div className="quiz-card-meta">
                      <span className="quiz-question-count">{quiz.questionCount} questions</span>
                      <span className="quiz-last-taken">
                        <Clock size={14} />
                        {formatLastQuizzed(quiz.lastQuizzed)}
                      </span>
                    </div>
                    <div className="quiz-card-actions">
                      <Link to={`/${quiz.postSlug}`} className="quiz-card-link">
                        Read Tutorial
                      </Link>
                      <Link to={`/${quiz.postSlug}#quiz`} className="button-primary button-small">
                        {quiz.lastQuizzed ? "Retake Quiz" : "Start Quiz"}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* All Tutorials Link */}
        {totalQuizzes > 0 && (
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

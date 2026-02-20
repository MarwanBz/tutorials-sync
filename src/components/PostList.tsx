import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Clock } from "lucide-react";

interface Post {
  _id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime?: string;
  tags: string[];
  excerpt?: string;
  image?: string;
  understanding_score?: number | null;
  last_quizzed?: string | null;
}

interface PostListProps {
  posts: Post[];
  viewMode?: "list" | "cards";
  columns?: 2 | 3; // Number of columns for card view (default: 3)
  showExcerpts?: boolean; // Show excerpts in card view (default: true)
}

// Group posts by year
function groupByYear(posts: Post[]): Record<string, Post[]> {
  return posts.reduce(
    (acc, post) => {
      const year = post.date.substring(0, 4);
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(post);
      return acc;
    },
    {} as Record<string, Post[]>
  );
}

// Get score color class
function getScoreColorClass(score?: number | null): string {
  if (!score) return "";
  if (score >= 80) return "score-excellent";
  if (score >= 60) return "score-good";
  return "score-needs-review";
}

// Format last quizzed date
function formatLastQuizzed(lastQuizzed?: string | null): string {
  if (!lastQuizzed) return "";
  const date = new Date(lastQuizzed);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default function PostList({
  posts,
  viewMode = "list",
  columns = 3,
  showExcerpts = true,
}: PostListProps) {
  // Sort posts by date descending
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Card view: render all posts in a grid
  if (viewMode === "cards") {
    // Apply column class for 2 or 3 columns
    const cardGridClass =
      columns === 2 ? "post-cards post-cards-2col" : "post-cards";
    return (
      <div className={cardGridClass}>
        {sortedPosts.map((post) => (
          <Link key={post._id} to={`/${post.slug}`} className="post-card">
            {/* Thumbnail image displayed as square using object-fit: cover */}
            {post.image && (
              <div className="post-card-image-wrapper">
                <img
                  src={post.image}
                  alt={post.title}
                  className="post-card-image"
                  loading="lazy"
                />
              </div>
            )}
            <div className="post-card-content">
              <div className="post-card-header-row">
                <h3 className="post-card-title">{post.title}</h3>
                {post.understanding_score !== null && post.understanding_score !== undefined && (
                  <span className={`post-card-score ${getScoreColorClass(post.understanding_score)}`}>
                    {post.understanding_score}%
                  </span>
                )}
              </div>
              {/* Only show excerpt if showExcerpts is true */}
              {showExcerpts && (post.excerpt || post.description) && (
                <p className="post-card-excerpt">
                  {post.excerpt || post.description}
                </p>
              )}
              <div className="post-card-meta">
                {post.readTime && (
                  <span className="post-card-read-time">{post.readTime}</span>
                )}
                <span className="post-card-date">
                  {format(parseISO(post.date), "MMMM d, yyyy")}
                </span>
                {post.last_quizzed && (
                  <span className="post-card-last-quiz" title={`Last quizzed: ${formatLastQuizzed(post.last_quizzed)}`}>
                    <Clock size={14} />
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  // List view: group by year
  const groupedPosts = groupByYear(sortedPosts);
  const years = Object.keys(groupedPosts).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="post-list">
      {years.map((year) => (
        <div key={year} className="post-year-group">
          <h2 className="year-heading">{year}</h2>
          <ul className="posts">
            {groupedPosts[year].map((post) => (
              <li key={post._id} className="post-item">
                <Link to={`/${post.slug}`} className="post-link">
                  <div className="post-item-header">
                    <span className="post-title">{post.title}</span>
                    {post.understanding_score !== null && post.understanding_score !== undefined && (
                      <span className={`post-item-score ${getScoreColorClass(post.understanding_score)}`}>
                        {post.understanding_score}%
                      </span>
                    )}
                  </div>
                  <span className="post-meta">
                    {post.readTime && (
                      <span className="post-read-time">{post.readTime}</span>
                    )}
                    <span className="post-date">
                      {format(parseISO(post.date), "MMMM d")}
                    </span>
                    {post.last_quizzed && (
                      <span className="post-last-quiz" title={`Last quizzed: ${formatLastQuizzed(post.last_quizzed)}`}>
                        <Clock size={14} />
                        {formatLastQuizzed(post.last_quizzed)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}


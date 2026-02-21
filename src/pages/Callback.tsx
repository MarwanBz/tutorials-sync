// src/pages/Callback.tsx
// Handles OAuth callback from WorkOS and redirects to dashboard
import { useEffect, useState } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import { useNavigate } from "react-router-dom";

export default function Callback() {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [authFailed, setAuthFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Once authentication is complete, redirect to dashboard
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }

    // Detect authentication failure
    if (!isLoading && !user) {
      // Small delay to ensure auth check is complete
      const timeoutId = setTimeout(() => {
        if (!user && !isLoading) {
          setAuthFailed(true);

          // Check for common issues
          const redirectUri = import.meta.env.VITE_WORKOS_REDIRECT_URI;
          const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID;

          if (!redirectUri) {
            setErrorMessage("VITE_WORKOS_REDIRECT_URI is not configured");
          } else if (!clientId) {
            setErrorMessage("VITE_WORKOS_CLIENT_ID is not configured");
          } else {
            // Provide helpful context for CORS issues
            setErrorMessage(
              "Authentication failed. This is usually caused by CORS configuration. " +
                "Please add http://localhost:5173 to CORS in WorkOS Dashboard."
            );
          }
        }
      }, 3000);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, user, navigate]);

  // Error state
  if (authFailed) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "var(--bg-primary, #fff)",
          color: "var(--text-primary, #111)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "400px",
            padding: "2rem",
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "1rem",
            }}
          >
            ⚠️
          </div>
          <h2>Authentication Failed</h2>
          <p style={{ color: "var(--text-secondary, #666)", margin: "1rem 0" }}>
            {errorMessage ||
              "We couldn't complete your sign in. Please try again."}
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              onClick={() => navigate("/", { replace: true })}
              style={{
                padding: "0.75rem 1.5rem",
                border: "1px solid var(--border-color, #ddd)",
                borderRadius: "6px",
                background: "var(--bg-secondary, #f5f5f5)",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Go Home
            </button>
            <button
              onClick={() => {
                setAuthFailed(false);
                setErrorMessage(null);
                navigate("/", { replace: true });
              }}
              style={{
                padding: "0.75rem 1.5rem",
                border: "none",
                borderRadius: "6px",
                background: "var(--accent-color, #0070f3)",
                color: "white",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "var(--bg-primary, #fff)",
        color: "var(--text-primary, #111)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border-color, #ddd)",
            borderTopColor: "var(--accent-color, #0070f3)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem",
          }}
        />
        <h2>Signing you in...</h2>
        <p style={{ color: "var(--text-secondary, #666)" }}>
          Please wait while we complete your authentication.
        </p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

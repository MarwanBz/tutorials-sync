import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  SignIn,
  User,
  SignOut,
  Gear,
  House,
} from "@phosphor-icons/react";
import { isWorkOSConfigured } from "../utils/workos";
import { useAuth as useWorkOSAuth } from "@workos-inc/authkit-react";

interface AuthButtonProps {
  className?: string;
}

// Inner component that always calls hooks
function AuthButtonInner({ className = "" }: AuthButtonProps) {
  // When WorkOS is configured, use the real hook
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, signIn, signOut } = isWorkOSConfigured
    ? useWorkOSAuth()
    : { user: undefined, signIn: () => {}, signOut: () => {} };

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    setIsOpen(false);
  }, [signOut]);

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // When not authenticated, show Sign In button
  if (!user) {
    return (
      <button
        onClick={() => signIn()}
        className={`auth-button auth-sign-in ${className}`}
        aria-label="Sign in"
      >
        <SignIn size={18} weight="regular" />
        <span>Sign In</span>
      </button>
    );
  }

  // When authenticated, show user avatar with dropdown
  return (
    <div className="auth-user-container" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="auth-user-button"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div className="auth-avatar">
          <User size={18} weight="regular" />
        </div>
        <span className="auth-user-name">
          {user.firstName || user.email?.split("@")[0] || "User"}
        </span>
      </button>

      {isOpen && (
        <div className="auth-dropdown">
          <div className="auth-dropdown-header">
            <div className="auth-dropdown-avatar">
              <User size={20} weight="regular" />
            </div>
            <div className="auth-dropdown-user-info">
              <span className="auth-dropdown-name">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || user.email?.split("@")[0] || "User"}
              </span>
              {user.email && (
                <span className="auth-dropdown-email">{user.email}</span>
              )}
            </div>
          </div>

          <div className="auth-dropdown-divider" />

          <nav className="auth-dropdown-nav">
            <Link
              to="/dashboard"
              className="auth-dropdown-item"
              onClick={() => setIsOpen(false)}
            >
              <Gear size={18} weight="regular" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/"
              className="auth-dropdown-item"
              onClick={() => setIsOpen(false)}
            >
              <House size={18} weight="regular" />
              <span>Home</span>
            </Link>
          </nav>

          <div className="auth-dropdown-divider" />

          <button
            onClick={handleSignOut}
            className="auth-dropdown-item auth-dropdown-logout"
          >
            <SignOut size={18} weight="regular" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper that only renders when WorkOS is configured or shows nothing when not
export default function AuthButton(props: AuthButtonProps) {
  if (!isWorkOSConfigured) {
    return null;
  }
  return <AuthButtonInner {...props} />;
}

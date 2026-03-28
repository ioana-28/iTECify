import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../services/api";
import "../style/LoginPage.css";

type AuthMode = "register" | "login";

export function LoginPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const handleAuthSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    setIsSubmitting(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authMode === "login") {
        const result = await apiClient.login({ email, password });
        localStorage.setItem("authToken", result.token);
        localStorage.setItem("authUser", JSON.stringify(result.user));
        sessionStorage.removeItem("projectContextReady");
        form.reset();
        navigate("/projects", { replace: true, state: { fromLogin: true } });
      } else {
        await apiClient.register({
          name: firstName,
          lastName,
          email,
          password,
          confirmPassword,
        });
        form.reset();
        setAuthMode("login");
        setAuthSuccess("Registration successful. You can now sign in.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : authMode === "login"
            ? "Sign in failed. Please try again."
            : "Sign up failed. Please try again.";
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchToLogin = () => {
    setAuthMode("login");
    setAuthError(null);
    setAuthSuccess(null);
  };

  const switchToRegister = () => {
    setAuthMode("register");
    setAuthError(null);
    setAuthSuccess(null);
  };

  return (
    <section className="login-page">
      <div className="auth-card">
        <p className="auth-brand">iTECify</p>
        <p className="auth-welcome">Welcome to iTECify</p>

        <h1>{authMode === "register" ? "Sign up" : "Sign in"}</h1>
        <p className="auth-subtitle">
          {authMode === "register" ? "Join the community today!" : "Great to see you again."}
        </p>

        <form onSubmit={handleAuthSubmit} className="auth-form">
          {authError && <p className="auth-error">{authError}</p>}
          {authSuccess && <p className="auth-success">{authSuccess}</p>}

          {authMode === "register" && (
            <>
              <label>
                First name
                <input type="text" name="firstName" required disabled={isSubmitting} />
              </label>

              <label>
                Last name
                <input type="text" name="lastName" required disabled={isSubmitting} />
              </label>
            </>
          )}

          <label>
            Email
            <input type="email" name="email" required disabled={isSubmitting} />
          </label>

          <label>
            Password
            <input type="password" name="password" required disabled={isSubmitting} />
          </label>

          {authMode === "register" && (
            <label>
              Confirm password
              <input type="password" name="confirmPassword" required disabled={isSubmitting} />
            </label>
          )}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Loading..." : authMode === "register" ? "Sign up" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {authMode === "register" ? "Already have an account?" : "Don't have an account?"}
          {" "}
          <button
            type="button"
            className="auth-switch-button"
            onClick={authMode === "register" ? switchToLogin : switchToRegister}
            disabled={isSubmitting}
          >
            {authMode === "register" ? "Sign in" : "Register"}
          </button>
        </p>
      </div>
    </section>
  );
}

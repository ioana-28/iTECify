import { useState } from "react";
import type { SyntheticEvent } from "react";
import { apiClient } from "../services/api";
import "../style/LoginPage.css";

type DialogStep = "none" | "login" | "register";

export function LoginPage() {
  const [dialogStep, setDialogStep] = useState<DialogStep>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const closeDialog = () => {
    setDialogStep("none");
    setAuthError(null);
  };

  const openLoginDialog = () => {
    setDialogStep("login");
    setAuthError(null);
    setAuthNotice(null);
  };

  const openRegisterDialog = () => {
    setDialogStep("register");
    setAuthError(null);
    setAuthNotice(null);
  };

  const handleLoginSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    setAuthError(null);
    
    try {
      const result = await apiClient.login({ email, password });
      localStorage.setItem("authToken", result.token);
      localStorage.setItem("authUser", JSON.stringify(result.user));
      form.reset();
      closeDialog();
      setAuthNotice({ type: "success", message: "Login successful." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed. Please try again.";
      setAuthError(message);
      setAuthNotice({ type: "error", message: `Login failed: ${message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    setIsSubmitting(true);
    setAuthError(null);

    try {
      const result = await apiClient.register({
        name: firstName,
        lastName,
        email,
        password,
        confirmPassword,
      });
      localStorage.setItem("authToken", result.token);
      localStorage.setItem("authUser", JSON.stringify(result.user));
      form.reset();
      closeDialog();
      setAuthNotice({ type: "success", message: "Register successful." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Registration failed. Please try again.";
      setAuthError(message);
      setAuthNotice({ type: "error", message: `Register failed: ${message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="login-page">
      {authNotice && (
        <div className={`auth-toast ${authNotice.type}`} role="status" aria-live="polite">
          <span>{authNotice.message}</span>
          <button
            type="button"
            className="auth-toast-close"
            onClick={() => setAuthNotice(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="home-card">
        <h1>iTECify</h1>
        <p>Welcome to iTECify</p>

        <div className="home-actions">
          <button className="primary" onClick={openLoginDialog}>
            Login
          </button>
          <button className="secondary" onClick={openRegisterDialog}>
            Register
          </button>
        </div>
      </div>

      {dialogStep !== "none" && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="dialog-close"
              type="button"
              onClick={closeDialog}
              aria-label="Close dialog"
            >
              ×
            </button>

            {dialogStep === "login" && (
              <>
                <h2>Login</h2>
                <form onSubmit={handleLoginSubmit} className="auth-form">
                  {authError && <p className="auth-error">{authError}</p>}

                  <label>
                    Email
                    <input type="email" name="email" required disabled={isSubmitting} />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      name="password"
                      required
                      disabled={isSubmitting}
                    />
                  </label>

                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={closeDialog}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary" disabled={isSubmitting}>
                      {isSubmitting ? "Loading..." : "Login"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {dialogStep === "register" && (
              <>
                <h2>Register</h2>
                <form onSubmit={handleRegisterSubmit} className="auth-form">
                  {authError && <p className="auth-error">{authError}</p>}

                  <label>
                    First name
                    <input
                      type="text"
                      name="firstName"
                      required
                      disabled={isSubmitting}
                    />
                  </label>

                  <label>
                    Last name
                    <input type="text" name="lastName" required disabled={isSubmitting} />
                  </label>

                  <label>
                    Email
                    <input type="email" name="email" required disabled={isSubmitting} />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      name="password"
                      required
                      disabled={isSubmitting}
                    />
                  </label>

                  <label>
                    Confirm password
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      disabled={isSubmitting}
                    />
                  </label>

                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={closeDialog}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary" disabled={isSubmitting}>
                      {isSubmitting ? "Loading..." : "Register"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

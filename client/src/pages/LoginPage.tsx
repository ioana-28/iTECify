import { useState } from "react";
import type { FormEvent } from "react";
import "../style/LoginPage.css";

type DialogStep = "none" | "login" | "register";

export function LoginPage() {
  const [dialogStep, setDialogStep] = useState<DialogStep>("none");

  const closeDialog = () => setDialogStep("none");

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleRegisterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <section className="login-page">
      <div className="home-card">
        <h1>iTECify</h1>
        <p>Welcome to iTECify</p>

        <div className="home-actions">
          <button className="primary" onClick={() => setDialogStep("login")}>
            Login
          </button>
          <button className="secondary" onClick={() => setDialogStep("register")}>
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
                  <label>
                    Email
                    <input type="email" name="email" required />
                  </label>

                  <label>
                    Password
                    <input type="password" name="password" required />
                  </label>

                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={closeDialog}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Login
                    </button>
                  </div>
                </form>
              </>
            )}

            {dialogStep === "register" && (
              <>
                <h2>Register</h2>
                <form onSubmit={handleRegisterSubmit} className="auth-form">
                  <label>
                    First name
                    <input type="text" name="firstName" required />
                  </label>

                  <label>
                    Last name
                    <input type="text" name="lastName" required />
                  </label>

                  <label>
                    Email
                    <input type="email" name="email" required />
                  </label>

                  <label>
                    Password
                    <input type="password" name="password" required />
                  </label>

                  <label>
                    Confirm password
                    <input type="password" name="confirmPassword" required />
                  </label>

                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={closeDialog}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Register
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

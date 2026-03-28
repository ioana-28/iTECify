import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import "./App.css";
import { EditorPage } from "./pages/EditorPage";
import { HealthPage } from "./pages/HealthPage";
import { HelpPage } from "./pages/HelpPage.tsx";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";

function isAuthenticated() {
  return Boolean(localStorage.getItem("authToken"));
}

function hasProjectContext() {
  return sessionStorage.getItem("projectContextReady") === "true";
}

function RequireAuth({ children }: { children: ReactElement }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireProjectContext({ children }: { children: ReactElement }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!hasProjectContext()) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}

function App() {
  const location = useLocation();
  const isHomeRoute = location.pathname === "/";
  const isLoginRoute = location.pathname === "/login";
  const isProjectsRoute = location.pathname === "/projects";
  const isHelpRoute = location.pathname === "/help";
  const hideTopbar = isHomeRoute || isLoginRoute || isProjectsRoute || isHelpRoute;
  const isLandingShell = isHomeRoute || isLoginRoute;

  return (
    <div className={`app-shell ${isLandingShell ? "login-shell" : ""}`}>
      {!hideTopbar && (
        <header className="topbar">
          <h1>iTECify</h1>

          <nav>
            <Link to="/">Home</Link>
            <Link to="/projects">Projectpage</Link>
            <Link to="/editor">Editor</Link>
            <Link to="/health">Health</Link>
          </nav>
        </header>
      )}

      <main className="app-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/help"
            element={
              <RequireAuth>
                <HelpPage />
              </RequireAuth>
            }
          />
          <Route
            path="/editor"
            element={
              <RequireProjectContext>
                <EditorPage />
              </RequireProjectContext>
            }
          />
          <Route path="/health" element={<HealthPage />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

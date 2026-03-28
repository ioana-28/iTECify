import type { ReactElement } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { EditorPage } from "./pages/EditorPage";
import { HealthPage } from "./pages/HealthPage";
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
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequireProjectContext({ children }: { children: ReactElement }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  if (!hasProjectContext()) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}

function App() {
  const location = useLocation();
  const isLoginRoute = location.pathname === "/";
  const isProjectsRoute = location.pathname === "/projects";
  const hideTopbar = isLoginRoute || isProjectsRoute;

  return (
    <div className={`app-shell ${isLoginRoute ? "login-shell" : ""}`}>
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
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
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

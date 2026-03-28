import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "../style/HelpPage.css";

type Capability = {
  id: string;
  icon: string;
  title: string;
  description: string;
  bullets: string[];
};

const capabilities: Capability[] = [
  {
    id: "collaboration",
    icon: "◎",
    title: "Live Collaboration",
    description: "Code with your team in the same workspace and keep everyone in sync.",
    bullets: [
      "Join shared coding sessions quickly",
      "See real-time updates from teammates",
      "Coordinate edits without context switching",
    ],
  },
  {
    id: "editor-workflow",
    icon: "◫",
    title: "Focused Editor Workflow",
    description: "Move from project selection to execution without leaving the platform.",
    bullets: [
      "Open projects and continue where you left off",
      "Use editor tabs and terminal in one place",
      "Keep your coding flow uninterrupted",
    ],
  },
  {
    id: "code-execution",
    icon: "▶",
    title: "Run Code Securely",
    description: "Execute snippets and validate behavior with a safer sandbox approach.",
    bullets: [
      "Quickly test ideas and prototypes",
      "Inspect output and iterate faster",
      "Reduce risk with controlled execution",
    ],
  },
  {
    id: "ai-assistant",
    icon: "✧",
    title: "AI-Powered Assistance",
    description: "Speed up development with support for generation, refactoring, and debugging.",
    bullets: [
      "Generate boilerplate and utilities faster",
      "Refine logic with guided suggestions",
      "Troubleshoot issues with less friction",
    ],
  },
  {
    id: "project-control",
    icon: "↻",
    title: "Project Continuity",
    description: "Keep momentum with recent workspaces and streamlined project actions.",
    bullets: [
      "Start new workspaces from clean templates",
      "Reopen recent projects in seconds",
      "Resume progress without setup overhead",
    ],
  },
  {
    id: "stability",
    icon: "✔",
    title: "Health and Reliability",
    description: "Monitor service health and keep your coding environment dependable.",
    bullets: [
      "Check platform health endpoints",
      "Spot issues early and recover quickly",
      "Work with confidence during sessions",
    ],
  },
];

export function HelpPage() {
  const navigate = useNavigate();

  const goBack = () => {
    navigate("/projects");
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/");
  };

  return (
    <section className="help-page">
      <div className="help-topbar">
        <button type="button" className="help-back" onClick={goBack}>
          Back to Projects
        </button>
        <button type="button" className="help-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="help-shell">
        <header className="help-hero">
          <img className="help-logo" src={logo} alt="iTECify logo" />
          <div className="help-copy">
            <h1>What iTECify Can Do</h1>
            <p>
              Explore the core features designed to help you code faster, collaborate better,
              and keep your projects moving with clarity.
            </p>
          </div>
        </header>

        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article key={capability.id} className="capability-card">
              <span className="capability-icon" aria-hidden="true">
                {capability.icon}
              </span>
              <h2>{capability.title}</h2>
              <p>{capability.description}</p>
              <ul>
                {capability.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useNavigate } from "react-router-dom";
import "../style/ProjectsPage.css";

type RecentProject = {
  id: string;
  title: string;
};

type WorkspaceAction = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
};

type InsightCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  caption: string;
};

const recentProjects: RecentProject[] = [
  { id: "midnight-python-hack", title: "Midnight Python Hack" },
  { id: "react-ui-tweaks", title: "React UI Tweaks" },
  { id: "ai-backend-routes-mvp", title: "AI Backend Routes MVP" },
];

const workspaceActions: WorkspaceAction[] = [
  { id: "new-project", title: "New Project", subtitle: "Start from a clean workspace", icon: "＋" },
  { id: "open-project", title: "Open Project", subtitle: "Return to a saved workspace", icon: "◫" },
  { id: "join-session", title: "Join Session", subtitle: "Collaborate with your team live", icon: "◎" },
  { id: "continue-working", title: "Continue Working", subtitle: "Pick up right where you left off", icon: "↻" },
];

const insightCards: InsightCard[] = [
  {
    id: "recent-projects",
    title: "Recent Projects",
    description: "Quickly jump back into your latest ideas and keep shipping.",
    icon: "✦",
    caption: "3 active workspaces",
  },
  {
    id: "team-collaboration",
    title: "Team Collaboration",
    description: "Share sessions, review changes, and build together in real time.",
    icon: "❉",
    caption: "2 teammates online",
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    description: "Generate code, debug faster, and refine solutions instantly.",
    icon: "✧",
    caption: "Ready to assist",
  },
  {
    id: "focus-flow",
    title: "Focus Flow",
    description: "Stay organized with smooth transitions from planning to editing.",
    icon: "✿",
    caption: "Calm productivity mode",
  },
];

export function ProjectsPage() {
  const navigate = useNavigate();

  const openWorkspace = () => {
    sessionStorage.setItem("projectContextReady", "true");
    navigate("/editor");
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/");
  };

  return (
    <section className="projects-page">
      <div className="projects-topbar">
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="projects-shell">
        <div className="projects-left soft-panel">
          <div className="left-intro">
            <h1>iTECify</h1>
            <p>Welcome back. Build, collaborate, and launch ideas with your team.</p>
          </div>

          <div className="action-list">
            {workspaceActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="action-item"
                onClick={openWorkspace}
              >
                <span className="action-icon" aria-hidden="true">
                  {action.icon}
                </span>
                <span className="action-copy">
                  <span className="action-title">{action.title}</span>
                  <span className="action-subtitle">{action.subtitle}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="recent-projects">
            <h2>Recent Projects</h2>
            <div className="project-list">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="project-entry"
                  onClick={openWorkspace}
                >
                  <span className="project-name">{project.title}</span>
                  <span className="project-link">Open workspace</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="projects-right soft-panel">
          <div className="right-intro">
            <h2>Workspace Highlights</h2>
            <p>A calm dashboard designed for creative coding and smooth collaboration.</p>
          </div>

          <div className="insight-grid">
            {insightCards.map((card) => (
              <article key={card.id} className="insight-card">
                <span className="insight-icon" aria-hidden="true">
                  {card.icon}
                </span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="insight-caption">{card.caption}</span>
              </article>
            ))}
          </div>

          <button type="button" className="launch-project" onClick={openWorkspace}>
            Create and Launch Project
          </button>
        </div>
      </div>
    </section>
  );
}

import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
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

  const handleHelp = () => {
    navigate("/help");
  };

  return (
    <section className="projects-page">
      <div className="projects-topbar">
        <button type="button" className="help-btn" onClick={handleHelp} aria-label="Open help page">
          ?
        </button>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="projects-shell">
        <div className="projects-right soft-panel projects-right-full">
          <div className="left-intro">
            <img className="projects-logo" src={logo} alt="iTECify logo" />
          
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

       

          

          
        </div>
   
    </section>
  );
}

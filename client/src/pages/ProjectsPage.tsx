import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { apiClient, type Project, type Room } from "../services/api";
import "../style/ProjectsPage.css";

const PROJECT_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "rust", label: "Rust" },
];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectLanguage, setProjectLanguage] = useState(PROJECT_LANGUAGES[0]?.value ?? "javascript");
  const [joinCode, setJoinCode] = useState("");

  const enterEditor = (project: Project, room: Room) => {
    sessionStorage.setItem("projectContextReady", "true");
    sessionStorage.setItem("activeProjectId", project.id);
    sessionStorage.setItem("activeRoomId", room.id);
    sessionStorage.setItem("activeRoomInviteCode", room.invite_code);
    navigate("/editor");
  };

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const result = await apiClient.listProjects();
      setRecentProjects(result.projects);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load projects";
      setProjectsError(message);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects().catch(() => {
      // handled in loadProjects
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const handleHelp = () => {
    navigate("/help");
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setActionError("Project name is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const result = await apiClient.createProject({
        name: trimmedName,
        primaryLanguage: projectLanguage,
        treeSnapshot: {},
      });
      setIsCreateModalOpen(false);
      setProjectName("");
      setProjectLanguage(PROJECT_LANGUAGES[0]?.value ?? "javascript");
      await loadProjects();
      enterEditor(result.project, result.room);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      setActionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) {
      setActionError("Room code is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const result = await apiClient.joinProjectByCode(normalizedCode);
      setIsJoinModalOpen(false);
      setJoinCode("");
      await loadProjects();
      enterEditor(result.project, result.room);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join session";
      setActionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRecentProject = async (projectId: string) => {
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const result = await apiClient.openProject(projectId);
      await loadProjects();
      enterEditor(result.project, result.room);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open project";
      setActionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openLatestProject = () => {
    const latest = recentProjects[0];
    if (!latest) {
      setActionError("No recent projects yet. Create one first.");
      return;
    }
    handleOpenRecentProject(latest.id).catch(() => {
      // handled in method
    });
  };

  const openCreateModal = () => {
    setActionError(null);
    setIsCreateModalOpen(true);
  };

  const openJoinModal = () => {
    setActionError(null);
    setIsJoinModalOpen(true);
  };

  const closeModals = () => {
    if (isSubmitting) {
      return;
    }
    setIsCreateModalOpen(false);
    setIsJoinModalOpen(false);
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
            <button type="button" className="action-item" onClick={openCreateModal}>
              <span className="action-icon" aria-hidden="true">＋</span>
              <span className="action-copy">
                <span className="action-title">New Project</span>
                <span className="action-subtitle">Choose a name and language, then start coding</span>
              </span>
            </button>

            <button type="button" className="action-item" onClick={openLatestProject}>
              <span className="action-icon" aria-hidden="true">◫</span>
              <span className="action-copy">
                <span className="action-title">Open Project</span>
                <span className="action-subtitle">Open your most recently used project</span>
              </span>
            </button>

            <button type="button" className="action-item" onClick={openJoinModal}>
              <span className="action-icon" aria-hidden="true">◎</span>
              <span className="action-copy">
                <span className="action-title">Join Session</span>
                <span className="action-subtitle">Enter a room code and jump into collaboration</span>
              </span>
            </button>
          </div>

          <div className="recent-projects">
            <h2>Recent Projects</h2>
            {isLoadingProjects ? <p className="projects-info">Loading recent projects…</p> : null}
            {projectsError ? <p className="projects-error">{projectsError}</p> : null}
            {actionError ? <p className="projects-error">{actionError}</p> : null}
            <div className="project-list">
              {!isLoadingProjects && recentProjects.length === 0 ? (
                <div className="project-empty">No recent projects yet. Create or join one to get started.</div>
              ) : null}
              {recentProjects.map((project) => (
                <button key={project.id} type="button" className="project-entry" onClick={() => handleOpenRecentProject(project.id)}>
                  <span className="project-name">{project.name}</span>
                  <span className="project-link">
                    Open workspace ({project.primaryLanguage} • {project.roomInviteCode})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {(isCreateModalOpen || isJoinModalOpen) && (
          <div className="projects-modal-backdrop" onClick={closeModals}>
            {isCreateModalOpen ? (
              <div className="projects-modal" onClick={(event) => event.stopPropagation()}>
                <h3>Create project</h3>
                <form onSubmit={handleCreateProject} className="projects-modal-form">
                  <label>
                    Project name
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      disabled={isSubmitting}
                      placeholder="My awesome project"
                    />
                  </label>
                  <label>
                    Primary language
                    <select
                      value={projectLanguage}
                      onChange={(event) => setProjectLanguage(event.target.value)}
                      disabled={isSubmitting}
                    >
                      {PROJECT_LANGUAGES.map((language) => (
                        <option key={language.value} value={language.value}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="projects-modal-actions">
                    <button type="button" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating..." : "Create & open"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {isJoinModalOpen ? (
              <div className="projects-modal" onClick={(event) => event.stopPropagation()}>
                <h3>Join session</h3>
                <form onSubmit={handleJoinProject} className="projects-modal-form">
                  <label>
                    Room code
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.replace(/\s+/g, "").toUpperCase())}
                      disabled={isSubmitting}
                      placeholder="ABCDE12345"
                    />
                  </label>
                  <div className="projects-modal-actions">
                    <button type="button" onClick={() => setIsJoinModalOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Joining..." : "Join & open"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

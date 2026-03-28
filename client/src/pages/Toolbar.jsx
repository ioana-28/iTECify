import { useNavigate } from 'react-router-dom'
import '../style/Toolbar.css'

export const Toolbar = ({
  onRun,
  onRunStep,
  onStop,
  onAiUpdate: _onAiUpdate,
  onToggleSidebar,
  isCopilotOpen,
  onToggleCopilot,
}) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    navigate('/')
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button 
          className="hamburger-btn" 
          onClick={onToggleSidebar}
          title="Toggle sidebar (Ctrl+B)"
        >
          ☰
        </button>
        <span className="separator"></span>
        <button className="toolbar-btn run" onClick={onRun} title="Run (F5)">
          ▶ Run
        </button>
        <button className="toolbar-btn step" onClick={onRunStep} title="Step Run (F6)">
          ⏭ Step
        </button>
        <button
          className="toolbar-btn stop"
          onClick={onStop}
          title="Stop (Shift+F5)"
        >
          ⏹ Stop
        </button>
      </div>

      <div className="toolbar-center">
        <span className="project-name">iTECify</span>
      </div>

      <div className="toolbar-right">
        <button
          className={`toolbar-btn copilot ${isCopilotOpen ? 'active' : ''}`}
          onClick={onToggleCopilot}
          title="Toggle Copilot panel"
        >
          {isCopilotOpen ? 'Copilot: ON' : 'Copilot: OFF'}
        </button>
        <button className="toolbar-logout-btn" onClick={handleLogout} title="Logout">
          Logout
        </button>
      </div>
    </div>
  )
}

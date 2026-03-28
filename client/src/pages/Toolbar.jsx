import { useNavigate } from 'react-router-dom'
import '../style/Toolbar.css'

export const Toolbar = ({
  onRun,
  onStop,
  onAiUpdate: _onAiUpdate,
  isTerminalOpen,
  onToggleTerminal: _onToggleSidebar,
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
        <button className="toolbar-btn run" onClick={onRun} title="Run (F5)">
          ▶ Run
        </button>
        <button
          className="toolbar-btn stop"
          onClick={onStop}
          title="Stop (Shift+F5)"
        >
          ⏹ Stop
        </button>
        <button
          className={`toolbar-btn terminal ${isTerminalOpen ? 'active' : ''}`}
          onClick={onToggleTerminal}
          title="Toggle terminal"
        >
          {isTerminalOpen ? 'Terminal: ON' : 'Terminal: OFF'}
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

import '../style/Toolbar.css'

export const Toolbar = ({ onRun, onStop, onAddAI, onToggleSidebar }) => {
  // Mock collaborative users - in real implementation, this would come from state
  const collaborators = [
    { id: 1, name: 'You', color: 'user-1', status: 'active' },
    { id: 2, name: 'Alex', color: 'user-2', status: 'active' },
    { id: 3, name: 'Sam', color: 'user-3', status: 'idle' },
    { id: 4, name: 'Jordan', color: 'user-4', status: 'active' },
  ]

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
        <button className="toolbar-btn" onClick={onRun} title="Run (F5)">
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
          className="toolbar-btn ai"
          onClick={onAddAI}
          title="AI Assistant (Ctrl+Shift+A)"
        >
          ✨ AI
        </button>
      </div>

      <div className="toolbar-center">
        <span className="project-name">iTECify</span>
      </div>

      <div className="toolbar-right">
        <ul className="users-list">
          {collaborators.map((user) => (
            <li 
              key={user.id} 
              className={`user-avatar ${user.color}`}
              title={`${user.name} (${user.status})`}
            >
              {user.name.charAt(0).toUpperCase()}
              <span className="user-status"></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

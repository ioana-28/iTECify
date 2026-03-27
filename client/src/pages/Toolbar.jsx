import '../style/Toolbar.css'

export const Toolbar = ({ onRun, onStop, onAddAI, onToggleSidebar }) => {
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
        {/* Placeholder for user presence - can be added later */}
      </div>
    </div>
  )
}

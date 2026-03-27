import '../style/Terminal.css'

export const Terminal = ({ output, isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-icon">▶</span>
          <span>Terminal</span>
        </div>
        <button
          className="terminal-close-btn"
          onClick={onClose}
          title="Close terminal (Ctrl+J)"
        >
          ✕
        </button>
      </div>
      <div className="terminal-content">
        {output.length === 0 ? (
          <div className="terminal-line terminal-empty">Ready...</div>
        ) : (
          output.map((line, idx) => (
            <div key={idx} className={`terminal-line ${line.type}`}>
              {line.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

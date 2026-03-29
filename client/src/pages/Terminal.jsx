import { useEffect, useRef } from 'react'
import '../style/Terminal.css'

export const Terminal = ({ output, isOpen, onClose, height, isResizing, onResizeStart }) => {
  const terminalContentRef = useRef(null)

  useEffect(() => {
    if (isOpen && terminalContentRef.current && output.length > 0) {
      // Auto-scroll to bottom when new output arrives
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight
    }
  }, [output, isOpen])

  if (!isOpen) return null

  return (
    <div
      className={`terminal-panel ${isResizing ? 'resizing' : ''}`}
      style={typeof height === 'number' ? { height: `${height}px` } : undefined}
    >
      <button
        className="terminal-resize-handle"
        onMouseDown={onResizeStart}
        title="Resize terminal"
        aria-label="Resize terminal"
      >
        <span className="terminal-resize-grip" aria-hidden="true" />
      </button>
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
      <div className="terminal-content" ref={terminalContentRef}>
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

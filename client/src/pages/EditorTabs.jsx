import '../style/EditorTabs.css'

export const EditorTabs = ({ files, currentFile, onSelectFile, onCloseFile }) => {
  if (!files || files.length === 0) return null

  return (
    <ul className="editor-tabs">
      {files.map((file) => (
        <li
          key={file.id}
          className={`tab ${currentFile?.id === file.id ? 'active' : ''}`}
          onClick={() => onSelectFile(file)}
        >
          <span className="tab-icon">
            {file.language === 'javascript' ? '⚛' : 
             file.language === 'css' ? '🎨' : 
             file.language === 'json' ? '⚙' : 
             file.language === 'html' ? '🌐' : '📄'}
          </span>
          <span className="tab-name">{file.name}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              onCloseFile(file.id)
            }}
            title="Close"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}

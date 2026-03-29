import { useEffect, useRef, useState } from 'react'
import { getLanguageFromPath } from '../services/language'
import '../style/Sidebar.css'

export const Sidebar = ({
  fileSystem,
  onSelectFile,
  sidebarOpen,
  onToggleSidebar,
  onCreateFile,
  onCreateFolder,
  snapshots = [],
  onCreateSnapshot,
  onPreviewSnapshot,
  onRestoreSnapshot,
}) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['src']))
  const [pendingCreate, setPendingCreate] = useState(null)
  const [pendingCreateName, setPendingCreateName] = useState('')
  const pendingInputRef = useRef(null)

  useEffect(() => {
    if (!pendingCreate || !pendingInputRef.current) {
      return
    }

    pendingInputRef.current.focus()
    pendingInputRef.current.select()
  }, [pendingCreate])

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const renderInlineRow = (parentPath) => {
    if (!pendingCreate || pendingCreate.parentPath !== parentPath) {
      return null
    }

    return (
      <div className="file-item create-inline-row">
        <span className="file-icon">{pendingCreate.type === 'file' ? '📄' : '📁'}</span>
        <input
          ref={pendingInputRef}
          className="create-inline-input"
          value={pendingCreateName}
          onChange={(event) => setPendingCreateName(event.target.value)}
          placeholder={`New ${pendingCreate.type} name`}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submitInlineCreate()
            }
            if (event.key === 'Escape') {
              cancelInlineCreate()
            }
          }}
          onBlur={cancelInlineCreate}
        />
      </div>
    )
  }

  const renderActionButtons = (parentPath, compact = false) => (
    <div className={`node-actions ${compact ? 'compact' : ''}`}>
      <button
        className="node-action-btn file-action"
        onClick={(event) => {
          event.stopPropagation()
          startInlineCreate('file', parentPath)
        }}
        title="New file"
        aria-label="New file"
      >
        <span className="sidebar-action-icon" aria-hidden="true">📄</span>
        <span className="sidebar-action-plus" aria-hidden="true">+</span>
      </button>
      <button
        className="node-action-btn folder-action"
        onClick={(event) => {
          event.stopPropagation()
          startInlineCreate('folder', parentPath)
        }}
        title="New folder"
        aria-label="New folder"
      >
        <span className="sidebar-action-icon" aria-hidden="true">📁</span>
        <span className="sidebar-action-plus" aria-hidden="true">+</span>
      </button>
    </div>
  )

  const renderFileTree = (items, parentPath = '') => {
    return Object.entries(items).map(([name, item]) => {
      const fullPath = parentPath ? `${parentPath}/${name}` : name
      const isExpanded = expandedFolders.has(fullPath)

      if (item.type === 'folder') {
        return (
          <div key={fullPath}>
            <div
              className="file-item folder-item"
              onClick={() => toggleFolder(fullPath)}
            >
              <span className="file-icon">{isExpanded ? '▼' : '▶'}</span>
              <span className="file-name">{name}</span>
              {renderActionButtons(fullPath, true)}
            </div>
            {isExpanded && item.files && (
              <div className="folder-contents">
                {renderInlineRow(fullPath)}
                {renderFileTree(item.files, fullPath)}
              </div>
            )}
          </div>
        )
      } else {
        const getFileIcon = (fileName) => {
          if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return '⚛'
          if (fileName.endsWith('.css')) return '🎨'
          if (fileName.endsWith('.json')) return '⚙'
          if (fileName.endsWith('.html')) return '🌐'
          if (fileName.endsWith('.md')) return '📝'
          return '📄'
        }

        return (
          <div
            key={fullPath}
            className="file-item"
            onClick={() => onSelectFile(name, fullPath, getLanguageFromPath(fullPath))}
          >
            <span className="file-icon">{getFileIcon(name)}</span>
            <span className="file-name">{name}</span>
          </div>
        )
      }
    })
  }

  const startInlineCreate = (nodeType, parentPath = null) => {
    const normalizedParentPath = parentPath && parentPath.trim() ? parentPath : null
    if (normalizedParentPath) {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        next.add(normalizedParentPath)
        return next
      })
    }

    setPendingCreate({
      type: nodeType,
      parentPath: normalizedParentPath,
    })
    setPendingCreateName('')
  }

  const cancelInlineCreate = () => {
    setPendingCreate(null)
    setPendingCreateName('')
  }

  const submitInlineCreate = () => {
    if (!pendingCreate) {
      return
    }

    const trimmedName = pendingCreateName.trim()
    if (!trimmedName) {
      cancelInlineCreate()
      return
    }

    const payload = {
      name: trimmedName,
      parentPath: pendingCreate.parentPath,
    }

    if (pendingCreate.type === 'file') {
      onCreateFile(payload)
    } else {
      onCreateFolder(payload)
    }

    cancelInlineCreate()
  }

  return (
    <>
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>Explorer</span>
          </div>
          <div className="sidebar-section">
            <div className="section-title-row">
              <div className="section-title">PROJECT</div>
              {renderActionButtons(null)}
            </div>
            <div className="file-tree">
              {renderInlineRow(null)}
              {renderFileTree(fileSystem)}
            </div>

            <div className="memory-section">
              <div className="section-title-row">
                <div className="section-title">Diva's Memory</div>
                <button
                  type="button"
                  className="sidebar-action-btn"
                  onClick={onCreateSnapshot}
                  title="Save snapshot"
                >
                  Save
                </button>
              </div>
              {snapshots.length === 0 ? (
                <div className="memory-empty">No snapshots yet.</div>
              ) : (
                <div className="memory-list">
                  {snapshots.map((snapshot) => (
                    <div key={snapshot.id} className="memory-item">
                      <div className="memory-item-title">{snapshot.name || 'Untitled snapshot'}</div>
                      <div className="memory-item-meta">
                        by {snapshot.author || 'Unknown'} · {new Date(snapshot.createdAt).toLocaleString()}
                      </div>
                      <div className="memory-item-actions">
                        <button type="button" className="memory-btn" onClick={() => onPreviewSnapshot?.(snapshot)}>
                          Preview
                        </button>
                        <button type="button" className="memory-btn restore" onClick={() => onRestoreSnapshot?.(snapshot)}>
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}


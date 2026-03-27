import { useState } from 'react'
import '../style/Sidebar.css'

export const Sidebar = ({ fileSystem, onSelectFile, sidebarOpen, onToggleSidebar }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['src']))

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

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
              <span className="file-icon">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="file-name">{name}</span>
            </div>
            {isExpanded && item.files && (
              <div className="folder-contents">
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

        const getLanguage = (fileName) => {
          if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript'
          if (fileName.endsWith('.css')) return 'css'
          if (fileName.endsWith('.json')) return 'json'
          if (fileName.endsWith('.html')) return 'html'
          if (fileName.endsWith('.md')) return 'markdown'
          return 'plaintext'
        }

        return (
          <div
            key={fullPath}
            className="file-item"
            onClick={() => onSelectFile(name, fullPath, getLanguage(name))}
          >
            <span className="file-icon">{getFileIcon(name)}</span>
            <span className="file-name">{name}</span>
          </div>
        )
      }
    })
  }

  return (
    <>
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>Explorer</span>
          </div>
          <div className="sidebar-section">
            <div className="section-title">PROJECT</div>
            <div className="file-tree">
              {renderFileTree(fileSystem)}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}


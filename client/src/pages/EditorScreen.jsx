import { useState, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EditorTabs } from './EditorTabs'
import { Terminal } from './Terminal'
import { runCodeExecutor } from './runCodeExecutor'
import '../style/Editor.css'

export function EditorScreen() {
  const editorRef = useRef(null)
  
  // File system structure
  const [fileSystem] = useState({
    'src': {
      type: 'folder',
      files: {
        'index.js': { type: 'file', language: 'javascript', content: '' },
        'App.jsx': { type: 'file', language: 'javascript', content: '' },
        'styles': {
          type: 'folder',
          files: {
            'main.css': { type: 'file', language: 'css', content: '' },
            'variables.css': { type: 'file', language: 'css', content: '' }
          }
        },
        'components': {
          type: 'folder',
          files: {
            'Header.jsx': { type: 'file', language: 'javascript', content: '' },
            'Footer.jsx': { type: 'file', language: 'javascript', content: '' }
          }
        }
      }
    },
    'public': {
      type: 'folder',
      files: {
        'index.html': { type: 'file', language: 'html', content: '' }
      }
    },
    'package.json': { type: 'file', language: 'json', content: '' },
    'README.md': { type: 'file', language: 'markdown', content: '' }
  })

  const [openFiles, setOpenFiles] = useState([
    { id: 1, name: 'App.jsx', path: 'src/App.jsx', language: 'javascript', active: true }
  ])
  
  const [currentFile, setCurrentFile] = useState(openFiles[0])
  const [code, setCode] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState([])

  const handleOpenFile = (name, path, language) => {
    // Check if file is already open
    const existing = openFiles.find(f => f.path === path)
    if (existing) {
      setCurrentFile(existing)
    } else {
      // Add new file
      const newFile = {
        id: Date.now(),
        name,
        path,
        language,
        active: true
      }
      setOpenFiles(prev => [...prev, newFile])
      setCurrentFile(newFile)
    }
  }

  const handleCloseFile = (fileId) => {
    setOpenFiles(prev => prev.filter(f => f.id !== fileId))
    
    if (currentFile.id === fileId) {
      const remaining = openFiles.filter(f => f.id !== fileId)
      if (remaining.length > 0) {
        setCurrentFile(remaining[0])
      } else {
        setCurrentFile(null)
      }
    }
  }

  const handleRun = async () => {
    try {
      await runCodeExecutor({
        language: currentFile?.language,
        source: code,
        setTerminalOpen: setIsTerminalOpen,
        addTerminalOutput,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown run error'
      setIsTerminalOpen(true)
      addTerminalOutput(`Execution failed: ${message}`, 'error')
    }
  }

  const handleStop = () => {
    addTerminalOutput('$ npm stop', 'info')
    setTimeout(() => {
      addTerminalOutput('Server stopped', 'warning')
    }, 300)
  }

  const handleAddAI = () => {
    setIsTerminalOpen(true)
    addTerminalOutput('🤖 AI Assistant: Ready to help!', 'info')
  }

  const addTerminalOutput = (text, type = 'info') => {
    setTerminalOutput((prev) => [...prev, { type, text }])
  }

  const handleEditorChange = (value) => {
    setCode(value || '')
  }

  return (
    <div className="editor-screen">
      {/* Sidebar - File Explorer */}
      <Sidebar 
        fileSystem={fileSystem}
        onSelectFile={handleOpenFile}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main editor area */}
      <div className="editor-main">
        {/* Toolbar */}
        <Toolbar 
          onRun={handleRun} 
          onStop={handleStop} 
          onAddAI={handleAddAI}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Editor Tabs */}
        <EditorTabs 
          files={openFiles} 
          currentFile={currentFile}
          onSelectFile={(file) => setCurrentFile(file)}
          onCloseFile={handleCloseFile}
        />

        {/* Monaco Editor Container */}
        {currentFile ? (
          <div className="editor-container">
            <div className="monaco-editor-wrapper">
              <Editor
                height="100%"
                language={currentFile.language || 'javascript'}
                value={code}
                onChange={handleEditorChange}
                onMount={(editor) => {
                  editorRef.current = editor
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  formatOnPaste: true,
                  formatOnType: true,
                  renderWhitespace: 'none',
                  cursorBlinking: 'blink',
                  smoothScrolling: true,
                  bracketPairColorization: true,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="editor-empty">
            <div className="empty-state">
              <h2>No file open</h2>
              <p>Select a file from the explorer to start editing</p>
            </div>
          </div>
        )}

        {/* Terminal Panel */}
        <Terminal
          output={terminalOutput}
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
        />
      </div>
    </div>
  )
}

export default EditorScreen

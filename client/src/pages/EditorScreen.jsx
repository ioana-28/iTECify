import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EditorTabs } from './EditorTabs'
import { Terminal } from './Terminal'
import { createCollabSocket } from '../services/socket'
import '../style/Editor.css'

export function EditorScreen() {
  const editorRef = useRef(null)
  const socketRef = useRef(null)
  const roomIdRef = useRef('main-room')
  const userIdRef = useRef(`user-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`)
  const isRemoteChangeRef = useRef(false)
  const remoteCursorsRef = useRef(new Map())
  const codeRef = useRef('')
  const currentFilePathRef = useRef('src/App.jsx')
  const versionRef = useRef(0)
  const selectionDisposableRef = useRef(null)
  
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

  useEffect(() => {
    currentFilePathRef.current = currentFile?.path || ''
  }, [currentFile])

  const applyTextOperation = useCallback((content, operation) => {
    if (!operation || typeof operation.pos !== 'number') {
      return content
    }

    if (operation.type === 'insert' && typeof operation.text === 'string') {
      return `${content.slice(0, operation.pos)}${operation.text}${content.slice(operation.pos)}`
    }

    if (operation.type === 'delete' && typeof operation.length === 'number') {
      return `${content.slice(0, operation.pos)}${content.slice(operation.pos + operation.length)}`
    }

    return content
  }, [])

  const buildEditorOperations = useCallback((previousCode, nextCode) => {
    if (previousCode === nextCode) {
      return []
    }

    let prefixLength = 0
    while (
      prefixLength < previousCode.length &&
      prefixLength < nextCode.length &&
      previousCode[prefixLength] === nextCode[prefixLength]
    ) {
      prefixLength += 1
    }

    let previousSuffix = previousCode.length - 1
    let nextSuffix = nextCode.length - 1
    while (
      previousSuffix >= prefixLength &&
      nextSuffix >= prefixLength &&
      previousCode[previousSuffix] === nextCode[nextSuffix]
    ) {
      previousSuffix -= 1
      nextSuffix -= 1
    }

    const removedLength = Math.max(0, previousSuffix - prefixLength + 1)
    const insertedText =
      nextSuffix >= prefixLength ? nextCode.slice(prefixLength, nextSuffix + 1) : ''

    const operations = []
    if (removedLength > 0) {
      operations.push({
        type: 'delete',
        pos: prefixLength,
        length: removedLength,
      })
    }

    if (insertedText.length > 0) {
      operations.push({
        type: 'insert',
        pos: prefixLength,
        text: insertedText,
      })
    }

    return operations
  }, [])

  const addTerminalOutput = useCallback((text, type = 'info') => {
    setTerminalOutput((prev) => [...prev, { type, text }])
  }, [])

  const applyRemoteCodeUpdate = useCallback((nextCode) => {
    isRemoteChangeRef.current = true
    codeRef.current = nextCode
    setCode(nextCode)
    setTimeout(() => {
      isRemoteChangeRef.current = false
    }, 0)
  }, [])

  useEffect(() => {
    const socket = createCollabSocket(roomIdRef.current)
    socketRef.current = socket

    const emitRoomJoin = () => {
      socket.emit('room:join', {
        roomId: roomIdRef.current,
        userId: userIdRef.current,
      })
    }

    socket.on('connect', emitRoomJoin)
    if (socket.connected) {
      emitRoomJoin()
    }

    const handleStateSync = (payload) => {
      if (!payload || payload.roomId !== roomIdRef.current || typeof payload.content !== 'string') {
        return
      }

      const normalizedContent = payload.content.replace(/\r\n/g, '\n')
      if (typeof payload.baseVersion === 'number') {
        versionRef.current = payload.baseVersion
      } else {
        versionRef.current = 0
      }
      applyRemoteCodeUpdate(normalizedContent)
    }

    const handleEditorPatch = (payload) => {
      if (!payload || payload.roomId !== roomIdRef.current || !payload.op) {
        return
      }

      if (payload.userId === userIdRef.current) {
        return
      }

      const currentCode = codeRef.current
      const nextCode = applyTextOperation(currentCode, payload.op)
      if (nextCode === currentCode) {
        return
      }

      if (typeof payload.baseVersion === 'number') {
        versionRef.current = payload.baseVersion + 1
      } else {
        versionRef.current += 1
      }
      codeRef.current = nextCode
      applyRemoteCodeUpdate(nextCode)
    }

    const handleTerminalOutput = (payload) => {
      if (!payload || payload.roomId !== roomIdRef.current || typeof payload.chunk !== 'string') {
        return
      }

      setIsTerminalOpen(true)
      addTerminalOutput(payload.chunk, payload.source === 'stderr' ? 'warning' : 'info')
    }

    const handleCursorUpdate = (payload) => {
      if (!payload || payload.roomId !== roomIdRef.current || payload.userId === userIdRef.current) {
        return
      }

      remoteCursorsRef.current.set(payload.userId, payload)
    }

    socket.on('room:state-sync', handleStateSync)
    socket.on('editor:patch', handleEditorPatch)
    socket.on('terminal:output', handleTerminalOutput)
    socket.on('cursor:update', handleCursorUpdate)

    return () => {
      if (selectionDisposableRef.current) {
        selectionDisposableRef.current.dispose()
        selectionDisposableRef.current = null
      }

      socket.off('connect', emitRoomJoin)
      socket.off('room:state-sync', handleStateSync)
      socket.off('editor:patch', handleEditorPatch)
      socket.off('terminal:output', handleTerminalOutput)
      socket.off('cursor:update', handleCursorUpdate)
      socket.disconnect()
      socketRef.current = null
    }
  }, [addTerminalOutput, applyRemoteCodeUpdate, applyTextOperation])

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

  const handleRun = () => {
    setIsTerminalOpen(true)
    addTerminalOutput('$ npm start', 'info')
    setTimeout(() => {
      addTerminalOutput('Starting development server...', 'info')
      addTerminalOutput('✓ Compiled successfully!', 'success')
      addTerminalOutput('Local: http://localhost:3000', 'info')
    }, 1000)
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

  const handleEditorChange = (value) => {
    const nextCode = (value || '').replace(/\r\n/g, '\n')

    if (isRemoteChangeRef.current) {
      isRemoteChangeRef.current = false
      codeRef.current = nextCode
      setCode(nextCode)
      return
    }

    const previousCode = codeRef.current
    codeRef.current = nextCode
    setCode(nextCode)

    const socket = socketRef.current
    if (!socket || !currentFilePathRef.current) {
      return
    }

    const operations = buildEditorOperations(previousCode, nextCode)
    operations.forEach((op, index) => {
      const payload = {
        roomId: roomIdRef.current,
        docId: currentFilePathRef.current,
        userId: userIdRef.current,
        baseVersion: versionRef.current,
        opId: `${userIdRef.current}-${Date.now()}-${index}`,
        op,
      }

      socket.emit('editor:change', payload)
      versionRef.current += 1
    })
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
                  if (selectionDisposableRef.current) {
                    selectionDisposableRef.current.dispose()
                  }

                  selectionDisposableRef.current = editor.onDidChangeCursorSelection((event) => {
                    const socket = socketRef.current
                    if (!socket || !currentFilePathRef.current) {
                      return
                    }

                    const position = event.selection?.getPosition()
                    if (!position) {
                      return
                    }

                    socket.emit('cursor:move', {
                      roomId: roomIdRef.current,
                      userId: userIdRef.current,
                      docId: currentFilePathRef.current,
                      line: position.lineNumber,
                      column: position.column,
                      selectionStart: editor.getModel()?.getOffsetAt(event.selection.getStartPosition()),
                      selectionEnd: editor.getModel()?.getOffsetAt(event.selection.getEndPosition()),
                      timestamp: Date.now(),
                    })
                  })
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                  eol: '\n',
                  trimAutoWhitespace: false,
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

import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EditorTabs } from './EditorTabs'
import { Terminal } from './Terminal'
import { SecurityPopup } from './SecurityPopup'
import { runCodeExecutor } from './runCodeExecutor'
import { createCollabSocket } from '../services/socket'
import { apiClient } from '../services/api'
import '../style/Editor.css'

export function EditorScreen() {
  const editorRef = useRef(null)
  const socketRef = useRef(null)
  const roomIdRef = useRef('')
  const userIdRef = useRef(`user-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`)
  const isRemoteChangeRef = useRef(false)
  const remoteCursorsRef = useRef(new Map())
  const codeRef = useRef('')
  const currentFilePathRef = useRef('src/App.jsx')
  const versionRef = useRef(0)
  const selectionDisposableRef = useRef(null)
  const runControllerRef = useRef(null)
  
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
  const [isRunning, setIsRunning] = useState(false)
  const [rooms, setRooms] = useState([])
  const [currentRoomId, setCurrentRoomId] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomError, setRoomError] = useState('')
  const [isRoomBusy, setIsRoomBusy] = useState(false)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)
  const [isSecurityPopupOpen, setIsSecurityPopupOpen] = useState(false)
  const [securityPopupMessage, setSecurityPopupMessage] = useState('')
  const [securityPopupType, setSecurityPopupType] = useState('')

  const currentRoom = rooms.find((room) => room.id === currentRoomId) || null

  const loadRooms = useCallback(async () => {
    const result = await apiClient.listRooms()
    setRooms(result.rooms)
    if (result.rooms.length > 0 && !currentRoomId) {
      setCurrentRoomId(result.rooms[0].id)
    }
  }, [currentRoomId])

  useEffect(() => {
    currentFilePathRef.current = currentFile?.path || ''
  }, [currentFile])

  useEffect(() => {
    const rawAuthUser = localStorage.getItem('authUser')
    if (rawAuthUser) {
      try {
        const parsed = JSON.parse(rawAuthUser)
        if (parsed && parsed.id) {
          userIdRef.current = `user-${parsed.id}`
        }
      } catch {
        // Keep fallback generated user id
      }
    }
  }, [])

  useEffect(() => {
    loadRooms().catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to load rooms'
      setRoomError(message)
    })
  }, [loadRooms])

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
    if (!currentRoomId) {
      return
    }

    roomIdRef.current = currentRoomId
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

      if (typeof payload.baseVersion === 'number') {
        versionRef.current = payload.baseVersion
      } else {
        versionRef.current = 0
      }
      applyRemoteCodeUpdate(payload.content)
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

    const handleChaosDetected = (payload) => {
      if (!payload || typeof payload.message !== 'string') {
        return
      }

      setSecurityPopupMessage(payload.message)
      setSecurityPopupType(typeof payload.type === 'string' ? payload.type : '')
      setIsSecurityPopupOpen(true)
    }

    socket.on('room:state-sync', handleStateSync)
    socket.on('editor:patch', handleEditorPatch)
    socket.on('terminal:output', handleTerminalOutput)
    socket.on('cursor:update', handleCursorUpdate)
    socket.on('security:chaos_detected', handleChaosDetected)

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
      socket.off('security:chaos_detected', handleChaosDetected)
      socket.disconnect()
      socketRef.current = null
    }
  }, [addTerminalOutput, applyRemoteCodeUpdate, applyTextOperation, currentRoomId])

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

  const startRun = async (mode = 'run') => {
    if (isRunning) {
      addTerminalOutput('Execution already running. Stop first to run again.', 'warning')
      return
    }

    try {
      setIsRunning(true)
      setTerminalOutput([])
      const socket = socketRef.current
      if (socket && roomIdRef.current && currentFilePathRef.current) {
        socket.emit('code:execute', {
          roomId: roomIdRef.current,
          userId: userIdRef.current,
          language: currentFile?.language === 'javascript' ? 'node' : currentFile?.language || 'node',
          source: code,
          stdin: '',
          stepMode: mode === 'step',
        })
      }
      const controller = await runCodeExecutor({
        language: currentFile?.language,
        source: code,
        mode,
        onComplete: () => {
          setIsRunning(false)
          runControllerRef.current = null
        },
        setTerminalOpen: setIsTerminalOpen,
        addTerminalOutput,
      })
      runControllerRef.current = controller
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown run error'
      setIsTerminalOpen(true)
      addTerminalOutput(`Execution failed: ${message}`, 'error')
      setIsRunning(false)
      runControllerRef.current = null
    }
  }

  const handleRun = async () => {
    await startRun('run')
  }

  const handleRunStep = async () => {
    const controller = runControllerRef.current
    if (controller?.isStepMode) {
      controller.step()
      addTerminalOutput('Step advanced.', 'info')
      return
    }

    await startRun('step')
  }

  const handleStop = async () => {
    const controller = runControllerRef.current
    if (!controller) {
      addTerminalOutput('No running execution session to stop.', 'warning')
      return
    }

    try {
      await controller.stop()
      addTerminalOutput('Stopping execution...', 'warning')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to stop execution'
      addTerminalOutput(message, 'error')
      setIsRunning(false)
      runControllerRef.current = null
    }
  }

  const handleAddAI = async () => {
    const instruction = window.prompt('Describe what changes you want in the current file:')
    if (instruction === null) {
      return
    }

    const trimmedInstruction = instruction.trim()
    if (!trimmedInstruction) {
      setIsTerminalOpen(true)
      addTerminalOutput('AI edit cancelled: instruction is required.', 'warning')
      return
    }

    if (!currentFile) {
      setIsTerminalOpen(true)
      addTerminalOutput('AI edit failed: no file is currently open.', 'error')
      return
    }

    try {
      setIsTerminalOpen(true)
      addTerminalOutput('Sending AI edit request...', 'info')

      const response = await apiClient.editFileWithAi({
        content: codeRef.current,
        instruction: trimmedInstruction,
        language: currentFile.language || 'javascript',
      })

      handleAiUpdate(response.content)
      addTerminalOutput('AI edit applied successfully.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI edit failed'
      addTerminalOutput(`AI edit failed: ${message}`, 'error')
    }
  }

  const handleAiUpdate = (newFullCode) => {
    const nextCode = newFullCode || ''
    const previousCode = codeRef.current
    if (previousCode === nextCode) {
      return
    }

    codeRef.current = nextCode
    setCode(nextCode)

    const socket = socketRef.current
    if (!socket || !currentFilePathRef.current || !roomIdRef.current) {
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

  const handleCreateRoom = async () => {
    try {
      setIsRoomBusy(true)
      setRoomError('')
      const created = await apiClient.createRoom(newRoomName || undefined)
      const nextRooms = [created.room, ...rooms]
      setRooms(nextRooms)
      setCurrentRoomId(created.room.id)
      setNewRoomName('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create room'
      setRoomError(message)
    } finally {
      setIsRoomBusy(false)
    }
  }

  const handleJoinRoom = async () => {
    try {
      setIsRoomBusy(true)
      setRoomError('')
      const joined = await apiClient.joinRoom(joinCode)
    await loadRooms()
      setCurrentRoomId(joined.room.id)
      setJoinCode('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join room'
      setRoomError(message)
    } finally {
      setIsRoomBusy(false)
    }
  }

  const handleEditorChange = (value) => {
    const nextCode = value || ''

    if (isRemoteChangeRef.current) {
      isRemoteChangeRef.current = false
      if (codeRef.current === nextCode) {
        return
      }
      codeRef.current = nextCode
      setCode(nextCode)
      return
    }

    handleAiUpdate(nextCode)
  }

  return (
    <div className="editor-screen">
      <SecurityPopup
        open={isSecurityPopupOpen}
        message={securityPopupMessage}
        attackType={securityPopupType}
        onClose={() => setIsSecurityPopupOpen(false)}
      />

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
          onRunStep={handleRunStep}
          onStop={handleStop} 
          onAddAI={handleAddAI}
          onAiUpdate={handleAiUpdate}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isCopilotOpen={isCopilotOpen}
          onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
        />

        <div className={`editor-content ${isCopilotOpen ? 'with-copilot' : ''}`}>
          <div className="editor-center-column">
            <div className="room-controls">
              <div className="room-controls-heading">Collaboration Rooms</div>
              <div className="room-controls-row">
                <input
                  className="room-input"
                  type="text"
                  placeholder="Room name (optional)"
                  value={newRoomName}
                  onChange={(event) => setNewRoomName(event.target.value)}
                  disabled={isRoomBusy}
                />
                <button className="room-btn" onClick={handleCreateRoom} disabled={isRoomBusy}>
                  Create room
                </button>
                <input
                  className="room-input code"
                  type="text"
                  placeholder="Invite code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.replace(/\s+/g, '').toUpperCase())}
                  disabled={isRoomBusy}
                />
                <button className="room-btn" onClick={handleJoinRoom} disabled={isRoomBusy || !joinCode.trim()}>
                  Join by code
                </button>
              </div>

              <div className="room-controls-row">
                <select
                  className="room-select"
                  value={currentRoomId}
                  onChange={(event) => setCurrentRoomId(event.target.value)}
                >
                  {rooms.length === 0 ? <option value="">No rooms yet</option> : null}
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name || 'Untitled room'} ({room.invite_code})
                    </option>
                  ))}
                </select>
                {currentRoom ? (
                  <span className="room-invite">Invite code: <strong>{currentRoom.invite_code}</strong></span>
                ) : (
                  <span className="room-invite">Create or join a room to start collaboration.</span>
                )}
              </div>
              {roomError ? <div className="room-error">{roomError}</div> : null}
            </div>

            <div className="editor-workspace">
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
                      theme="vs-light"
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
                        formatOnType: false,
                        renderWhitespace: 'none',
                        cursorBlinking: 'blink',
                        smoothScrolling: true,
                        bracketPairColorization: true,
                        autoClosingBrackets: 'beforeWhitespace',
                        autoClosingQuotes: 'beforeWhitespace',
                        autoSurround: 'languageDefined',
                        linkedEditing: true,
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
            </div>

            {/* Terminal Panel */}
            <Terminal
              output={terminalOutput}
              isOpen={isTerminalOpen}
              onClose={() => setIsTerminalOpen(false)}
            />
          </div>

          {isCopilotOpen ? (
            <aside className="copilot-panel">
              <div className="copilot-header">
                <h3>AI Copilot</h3>
                <button
                  className="copilot-close-btn"
                  onClick={() => setIsCopilotOpen(false)}
                  title="Close Copilot panel"
                >
                  ✕
                </button>
              </div>

              <div className="copilot-body">
                <div className="copilot-suggestion-card">
                  <h4>Quick suggestion</h4>
                  <p>Improve your runtime logs and include context metadata for easier debugging.</p>
                  <button className="copilot-primary-action">Generate better logging</button>
                </div>

                <div className="copilot-suggestion-card">
                  <h4>Assistant note</h4>
                  <p>I can help outline refactors for this file and suggest safer incremental changes.</p>
                  <div className="copilot-chip-group">
                    <button className="copilot-chip">Apply code</button>
                    <button className="copilot-chip">Refactor</button>
                    <button className="copilot-chip">Suggest changes</button>
                  </div>
                </div>

                <div className="copilot-conversation">
                  <div className="copilot-msg assistant">
                    Hi! I am ready when you are. Ask for explanations, cleanup ideas, or testing suggestions.
                  </div>
                  <div className="copilot-msg user">Can you help improve readability in this file?</div>
                </div>
              </div>

              <div className="copilot-input-wrap">
                <input
                  className="copilot-input"
                  type="text"
                  placeholder="Ask Copilot..."
                  readOnly
                />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default EditorScreen

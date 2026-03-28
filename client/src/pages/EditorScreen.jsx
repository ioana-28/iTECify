import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { EditorTabs } from './EditorTabs'
import { Terminal } from './Terminal'
import { runCodeExecutor } from './runCodeExecutor'
import { createCollabSocket } from '../services/socket'
import { getLanguageFromPath } from '../services/language'
import { apiClient } from '../services/api'
import '../style/Editor.css'

function toTreeMap(nodes) {
  const map = new Map()
  ;(nodes || []).forEach((node) => {
    if (!node || typeof node.path !== 'string') {
      return
    }

    map.set(node.path, {
      path: node.path,
      name: typeof node.name === 'string' && node.name ? node.name : node.path.split('/').pop() || node.path,
      type: node.type === 'folder' ? 'folder' : 'file',
      parentPath: typeof node.parentPath === 'string' && node.parentPath ? node.parentPath : null,
    })
  })

  return map
}

function toFileSystemFromTree(treeMap) {
  const root = {}
  const nodes = Array.from(treeMap.values()).sort((a, b) => a.path.localeCompare(b.path))

  for (const node of nodes) {
    const parts = node.path.split('/').filter(Boolean)
    if (parts.length === 0) {
      continue
    }

    let cursor = root
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      const isLeaf = i === parts.length - 1

      if (!isLeaf) {
        if (!cursor[part] || cursor[part].type !== 'folder') {
          cursor[part] = { type: 'folder', files: {} }
        }
        cursor = cursor[part].files
        continue
      }

      if (node.type === 'folder') {
        if (!cursor[part] || cursor[part].type !== 'folder') {
          cursor[part] = { type: 'folder', files: {} }
        }
      } else {
        cursor[part] = {
          type: 'file',
          language: getLanguageFromPath(node.path),
          content: '',
        }
      }
    }
  }

  return root
}

export function EditorScreen() {
  const editorRef = useRef(null)
  const socketRef = useRef(null)
  const copilotInputRef = useRef(null)
  const copilotConversationEndRef = useRef(null)
  const roomIdRef = useRef('')
  const userIdRef = useRef(`user-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`)
  const isRemoteChangeRef = useRef(false)
  const remoteCursorsRef = useRef(new Map())
  const codeRef = useRef('')
  const currentFilePathRef = useRef('')
  const versionRef = useRef(0)
  const selectionDisposableRef = useRef(null)
  const runControllerRef = useRef(null)
  
  const [treeNodes, setTreeNodes] = useState(() => new Map())
  const fileSystem = toFileSystemFromTree(treeNodes)

  const [openFiles, setOpenFiles] = useState([])
  
  const [currentFile, setCurrentFile] = useState(null)
  const [code, setCode] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState([])
  const [terminalHeight, setTerminalHeight] = useState(240)
  const [isTerminalResizing, setIsTerminalResizing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [rooms, setRooms] = useState([])
  const [currentRoomId, setCurrentRoomId] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomError, setRoomError] = useState('')
  const [isRoomBusy, setIsRoomBusy] = useState(false)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)
  const [copilotDraft, setCopilotDraft] = useState('')
  const [isCopilotBusy, setIsCopilotBusy] = useState(false)
  const [copilotMessages, setCopilotMessages] = useState([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: 'Hi! Ask Copilot to edit the current file and I will apply the changes directly.',
    },
  ])

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
    setTreeNodes(new Map())
    setOpenFiles([])
    setCurrentFile(null)
    currentFilePathRef.current = ''
    codeRef.current = ''
    setCode('')
    versionRef.current = 0
  }, [currentRoomId])

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
    if (!isCopilotOpen || !copilotInputRef.current) {
      return
    }

    copilotInputRef.current.focus()
  }, [isCopilotOpen])

  useEffect(() => {
    if (!copilotConversationEndRef.current) {
      return
    }

    copilotConversationEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [copilotMessages, isCopilotBusy])

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

  useEffect(() => {
    if (!isTerminalResizing) {
      return
    }

    const minHeight = 180
    const maxHeight = 520

    const onMouseMove = (event) => {
      const viewportHeight = window.innerHeight || 0
      const nextHeight = Math.min(maxHeight, Math.max(minHeight, viewportHeight - event.clientY))
      setTerminalHeight(nextHeight)
    }

    const onMouseUp = () => {
      setIsTerminalResizing(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isTerminalResizing])

  useEffect(() => {
    if (!isTerminalResizing) {
      return
    }

    const previousSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'

    return () => {
      document.body.style.userSelect = previousSelect
      document.body.style.cursor = previousCursor
    }
  }, [isTerminalResizing])

  const handleTerminalResizeStart = useCallback((event) => {
    event.preventDefault()
    setIsTerminalResizing(true)
  }, [])

  const requestTreeSync = useCallback(() => {
    const socket = socketRef.current
    const roomId = roomIdRef.current
    if (!socket || !roomId) {
      return
    }

    socket.emit('tree:sync', { roomId })
  }, [])

  const requestRoomFileSync = useCallback(() => {
    const socket = socketRef.current
    const roomId = roomIdRef.current
    const docId = currentFilePathRef.current
    if (!socket || !roomId || !docId) {
      return
    }

    socket.emit('room:join', {
      roomId,
      userId: userIdRef.current,
      docId,
    })
  }, [])

  const addCopilotMessage = useCallback((role, text) => {
    setCopilotMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
      },
    ])
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
      requestTreeSync()
      requestRoomFileSync()
    }

    socket.on('connect', emitRoomJoin)
    if (socket.connected) {
      emitRoomJoin()
    }

    const handleStateSync = (payload) => {
      if (
        !payload ||
        payload.roomId !== roomIdRef.current ||
        payload.filePath !== currentFilePathRef.current ||
        typeof payload.content !== 'string'
      ) {
        return
      }

      if (typeof payload.baseVersion === 'number') {
        versionRef.current = payload.baseVersion
      } else {
        versionRef.current = 0
      }
      applyRemoteCodeUpdate(payload.content)
    }

    const handleTreeStateSync = (payload) => {
      if (!payload || payload.roomId !== roomIdRef.current || !Array.isArray(payload.nodes)) {
        return
      }

      const nextTree = toTreeMap(payload.nodes)
      setTreeNodes(nextTree)

      const filePaths = Array.from(nextTree.values())
        .filter((node) => node.type === 'file')
        .map((node) => node.path)
      if (filePaths.length === 0) {
        setOpenFiles([])
        setCurrentFile(null)
        currentFilePathRef.current = ''
        codeRef.current = ''
        setCode('')
        versionRef.current = 0
        return
      }

      const filePathSet = new Set(filePaths)
      setOpenFiles((prev) =>
        prev
          .filter((file) => filePathSet.has(file.path))
          .map((file) => ({
            ...file,
            id: file.path,
            name: file.path.split('/').pop() || file.name,
            language: getLanguageFromPath(file.path),
          })),
      )

      if (!currentFilePathRef.current || !filePathSet.has(currentFilePathRef.current)) {
        const nextPath = filePaths[0]
        const nextFile = {
          id: nextPath,
          name: nextPath.split('/').pop() || nextPath,
          path: nextPath,
          language: getLanguageFromPath(nextPath),
          active: true,
        }
        setCurrentFile(nextFile)
        currentFilePathRef.current = nextPath
        requestRoomFileSync()
      }
    }

    const handleTreeNodeCreated = (payload) => {
      if (!payload || payload.roomId !== roomIdRef.current || !payload.node || typeof payload.node.path !== 'string') {
        return
      }

      setTreeNodes((prev) => {
        const next = new Map(prev)
        next.set(payload.node.path, {
          path: payload.node.path,
          name: payload.node.name,
          type: payload.node.type,
          parentPath: payload.node.parentPath ?? null,
        })
        return next
      })

      if (payload.node.type === 'file') {
        const language = getLanguageFromPath(payload.node.path)
        const newFile = {
          id: payload.node.path,
          name: payload.node.name,
          path: payload.node.path,
          language,
          active: true,
        }

        setOpenFiles((prev) => {
          if (prev.some((file) => file.path === newFile.path)) {
            return prev
          }
          return [...prev, newFile]
        })
        setCurrentFile(newFile)
        currentFilePathRef.current = newFile.path
        requestRoomFileSync()
      }
    }

    const handleSocketError = (payload) => {
      if (!payload || typeof payload.message !== 'string' || typeof payload.event !== 'string') {
        return
      }

      addTerminalOutput(`${payload.event}: ${payload.message}`, 'warning')
      setIsTerminalOpen(true)
    }

    const handleEditorPatch = (payload) => {
      if (
        !payload ||
        payload.roomId !== roomIdRef.current ||
        payload.docId !== currentFilePathRef.current ||
        !payload.op
      ) {
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
    socket.on('tree:state-sync', handleTreeStateSync)
    socket.on('tree:node-created', handleTreeNodeCreated)
    socket.on('socket:error', handleSocketError)
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
      socket.off('tree:state-sync', handleTreeStateSync)
      socket.off('tree:node-created', handleTreeNodeCreated)
      socket.off('socket:error', handleSocketError)
      socket.off('editor:patch', handleEditorPatch)
      socket.off('terminal:output', handleTerminalOutput)
      socket.off('cursor:update', handleCursorUpdate)
      socket.disconnect()
      socketRef.current = null
    }
  }, [addTerminalOutput, applyRemoteCodeUpdate, applyTextOperation, currentRoomId, requestRoomFileSync, requestTreeSync])

  const handleOpenFile = (name, path, language) => {
    // Check if file is already open
    const existing = openFiles.find(f => f.path === path)
    if (existing) {
      setCurrentFile(existing)
    } else {
      // Add new file
      const newFile = {
        id: path,
        name,
        path,
        language,
        active: true
      }
      setOpenFiles(prev => [...prev, newFile])
      setCurrentFile(newFile)
    }

    currentFilePathRef.current = path
    requestRoomFileSync()
  }

  const handleCreateNode = (nodeType, options = null) => {
    const socket = socketRef.current
    const roomId = roomIdRef.current
    if (!socket || !roomId) {
      addTerminalOutput('Create failed: connect to a room first.', 'warning')
      return
    }

    const providedName = typeof options?.name === 'string' ? options.name : null
    const providedParentPath =
      options?.parentPath === null || typeof options?.parentPath === 'string'
        ? options.parentPath
        : undefined

    let trimmedName = providedName?.trim() ?? ''
    if (!trimmedName) {
      const defaultName = nodeType === 'folder' ? 'new-folder' : 'new-file.js'
      const promptName = window.prompt(`Enter ${nodeType} name:`, defaultName)
      if (promptName === null) {
        return
      }
      trimmedName = promptName.trim()
    }

    if (!trimmedName) {
      addTerminalOutput('Create failed: name is required.', 'warning')
      return
    }

    let normalizedParentPath = null
    if (providedParentPath !== undefined) {
      normalizedParentPath = providedParentPath && providedParentPath.trim() ? providedParentPath.trim() : null
    } else {
      const parentPath = window.prompt('Parent folder path (leave empty for root):', '')
      if (parentPath === null) {
        return
      }
      normalizedParentPath = parentPath.trim() || null
    }

    socket.emit('tree:create', {
      roomId,
      name: trimmedName,
      nodeType,
      parentPath: normalizedParentPath,
    })
  }

  const handleCloseFile = (fileId) => {
    setOpenFiles(prev => prev.filter(f => f.id !== fileId))
    
    if (currentFile?.id === fileId) {
      const remaining = openFiles.filter(f => f.id !== fileId)
      if (remaining.length > 0) {
        setCurrentFile(remaining[0])
        currentFilePathRef.current = remaining[0].path
        requestRoomFileSync()
      } else {
        setCurrentFile(null)
        currentFilePathRef.current = ''
        codeRef.current = ''
        setCode('')
        versionRef.current = 0
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

  const requestAiEdit = async (instruction) => {
    const trimmedInstruction = instruction.trim()
    if (!trimmedInstruction) {
      setIsTerminalOpen(true)
      addTerminalOutput('AI edit cancelled: instruction is required.', 'warning')
      addCopilotMessage('assistant', 'Please enter a request before sending.')
      return
    }

    if (!currentFile) {
      setIsTerminalOpen(true)
      addTerminalOutput('AI edit failed: no file is currently open.', 'error')
      addCopilotMessage('assistant', 'AI edit failed: no file is currently open.')
      return
    }

    try {
      setIsCopilotBusy(true)
      setIsTerminalOpen(true)
      addTerminalOutput('Sending AI edit request...', 'info')
      const previousContent = codeRef.current

      const response = await apiClient.editFileWithAi({
        content: previousContent,
        instruction: trimmedInstruction,
        language: currentFile.language || 'javascript',
      })

      handleAiUpdate(response.content)
      const hasCodeChanges = response.content !== previousContent
      addTerminalOutput('AI edit applied successfully.', 'success')
      addCopilotMessage(
        'assistant',
        hasCodeChanges
          ? 'Done. I applied the AI edit to the current file.'
          : 'Done. AI returned the current content with no code changes.'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI edit failed'
      addTerminalOutput(`AI edit failed: ${message}`, 'error')
      addCopilotMessage('assistant', `AI edit failed: ${message}`)
    } finally {
      setIsCopilotBusy(false)
    }
  }

  const handleAddAI = () => {
    setIsCopilotOpen(true)
  }

  const handleCopilotSubmit = async (event) => {
    event.preventDefault()

    if (isCopilotBusy) {
      return
    }

    const instruction = copilotDraft
    setCopilotDraft('')
    if (instruction.trim()) {
      addCopilotMessage('user', instruction.trim())
    }
    await requestAiEdit(instruction)
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
      {/* Sidebar - File Explorer */}
      <Sidebar 
        fileSystem={fileSystem}
        onSelectFile={handleOpenFile}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onCreateFile={(options) => handleCreateNode('file', options)}
        onCreateFolder={(options) => handleCreateNode('folder', options)}
      />

      {/* Main editor area */}
      <div className="editor-main">
        {/* Toolbar */}
        <Toolbar 
          onRun={handleRun} 
          onRunStep={handleRunStep}
          onStop={handleStop} 
          onAiUpdate={handleAiUpdate}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isTerminalOpen={isTerminalOpen}
          onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
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
                onSelectFile={(file) => {
                  setCurrentFile(file)
                  currentFilePathRef.current = file.path
                  requestRoomFileSync()
                }}
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
              height={terminalHeight}
              isResizing={isTerminalResizing}
              onResizeStart={handleTerminalResizeStart}
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
                  Γ£ò
                </button>
              </div>

              <div className="copilot-body">
                <div className="copilot-conversation">
                  {copilotMessages.map((message) => (
                    <div key={message.id} className={`copilot-msg ${message.role}`}>
                      {message.text}
                    </div>
                  ))}
                  {isCopilotBusy ? (
                    <div className="copilot-msg assistant">Working on your request...</div>
                  ) : null}
                  <div ref={copilotConversationEndRef} />
                </div>
              </div>

              <div className="copilot-input-wrap">
                <form className="copilot-input-form" onSubmit={handleCopilotSubmit}>
                  <input
                    ref={copilotInputRef}
                    className="copilot-input"
                    type="text"
                    placeholder="Ask Copilot..."
                    value={copilotDraft}
                    onChange={(event) => setCopilotDraft(event.target.value)}
                    disabled={isCopilotBusy}
                  />
                  <button
                    className="copilot-send-btn"
                    type="submit"
                    disabled={isCopilotBusy || !copilotDraft.trim()}
                  >
                    Send
                  </button>
                </form>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default EditorScreen

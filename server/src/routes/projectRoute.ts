import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import { listRoomFileNodes } from '../services/roomFileNodeRepository'
import {
  createProject,
  ensureProjectForJoinedRoom,
  findProjectByIdForUser,
  listAllProjectsForUser,
  listRecentProjectsForUser,
  touchProjectLastOpened,
  type ProjectWithRoomRow,
} from '../services/projectRepository'
import { addMember, createRoom, findRoomByInviteCode, getRoomById, type RoomRow } from '../services/roomRepository'

type CreateProjectRequest = {
  name: string
  primaryLanguage: string
  treeSnapshot?: unknown
}

type JoinProjectRequest = {
  code: string
}

type ProjectResponse = {
  id: string
  name: string
  primaryLanguage: string
  roomId: string
  roomInviteCode: string
  treeSnapshot: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
}

function toProjectResponse(project: ProjectWithRoomRow): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    primaryLanguage: project.primary_language,
    roomId: project.room_id,
    roomInviteCode: project.room_invite_code,
    treeSnapshot: project.tree_snapshot,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    lastOpenedAt: project.last_opened_at,
  }
}

function serializeTreeSnapshot(value: unknown): string {
  if (value === undefined) {
    return '{}'
  }
  return JSON.stringify(value)
}

async function buildTreeSnapshotFromRoom(roomId: string): Promise<string> {
  const nodes = await listRoomFileNodes(roomId)
  const payload = {
    nodes: nodes.map((node) => ({
      path: node.path,
      name: node.name,
      type: node.type,
      parentPath: node.parent_path,
    })),
  }
  return JSON.stringify(payload)
}

export const projectRoute = Router()

projectRoute.use(requireAuth)

projectRoute.get('/projects', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const recentProjects = await listRecentProjectsForUser(userId, 3)
    res.status(200).json({ projects: recentProjects.map(toProjectResponse) })
  } catch (error) {
    next(error)
  }
})

projectRoute.get('/projects/all', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const projects = await listAllProjectsForUser(userId)
    res.status(200).json({ projects: projects.map(toProjectResponse) })
  } catch (error) {
    next(error)
  }
})

projectRoute.post('/projects', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const body = req.body as Partial<CreateProjectRequest>
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      res.status(400).json({ error: 'name is required' })
      return
    }

    if (typeof body.primaryLanguage !== 'string' || body.primaryLanguage.trim() === '') {
      res.status(400).json({ error: 'primaryLanguage is required' })
      return
    }

    const room = await createRoom(userId, body.name)
    const treeSnapshot = serializeTreeSnapshot(body.treeSnapshot)
    const createdProject = await createProject({
      userId,
      roomId: room.id,
      name: body.name,
      primaryLanguage: body.primaryLanguage,
      treeSnapshot,
    })

    const fullProject: ProjectWithRoomRow = {
      ...createdProject,
      room_invite_code: room.invite_code,
    }

    res.status(201).json({
      project: toProjectResponse(fullProject),
      room,
    })
  } catch (error) {
    next(error)
  }
})

projectRoute.post('/projects/join', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const body = req.body as Partial<JoinProjectRequest>
    if (typeof body.code !== 'string' || body.code.trim() === '') {
      res.status(400).json({ error: 'code is required' })
      return
    }

    const room = await findRoomByInviteCode(body.code)
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    await addMember(room.id, userId)
    const refreshedRoom = await getRoomById(room.id)
    if (!refreshedRoom) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    const treeSnapshot = await buildTreeSnapshotFromRoom(refreshedRoom.id)
    const project = await ensureProjectForJoinedRoom({
      userId,
      room: refreshedRoom,
      defaultTreeSnapshot: treeSnapshot,
    })

    const payload: ProjectWithRoomRow = {
      ...project,
      room_invite_code: refreshedRoom.invite_code,
    }

    res.status(200).json({
      project: toProjectResponse(payload),
      room: refreshedRoom,
    })
  } catch (error) {
    next(error)
  }
})

projectRoute.post('/projects/:projectId/open', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { projectId } = req.params
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' })
      return
    }

    const project = await findProjectByIdForUser(projectId, userId)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await touchProjectLastOpened(project.id, userId)

    let room: RoomRow | null = await getRoomById(project.room_id)
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    await addMember(room.id, userId)
    room = await getRoomById(room.id)
    if (!room) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    const freshProject = await findProjectByIdForUser(project.id, userId)
    if (!freshProject) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    res.status(200).json({
      project: toProjectResponse(freshProject),
      room,
    })
  } catch (error) {
    next(error)
  }
})

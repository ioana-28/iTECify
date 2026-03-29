import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware'
import {
  addMember,
  createRoom,
  findRoomByInviteCode,
  getRoomById,
  listRoomsForUser,
} from '../services/roomRepository'

type CreateRoomRequest = {
  name?: string
}

type JoinRoomRequest = {
  code: string
}

export const roomRoute = Router()

roomRoute.use(requireAuth)

roomRoute.post('/rooms', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const body = req.body as Partial<CreateRoomRequest>
    if (body.name !== undefined && typeof body.name !== 'string') {
      res.status(400).json({ error: 'name must be a string when provided' })
      return
    }

    const room = await createRoom(userId, body.name)
    res.status(201).json({ room })
  } catch (error) {
    next(error)
  }
})

roomRoute.post('/rooms/join', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const body = req.body as Partial<JoinRoomRequest>
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
    const updatedRoom = await getRoomById(room.id)
    if (!updatedRoom) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    res.status(200).json({ room: updatedRoom })
  } catch (error) {
    next(error)
  }
})

roomRoute.get('/rooms', async (req, res, next) => {
  try {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const rooms = await listRoomsForUser(userId)
    res.status(200).json({ rooms })
  } catch (error) {
    next(error)
  }
})

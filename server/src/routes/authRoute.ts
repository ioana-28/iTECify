import { Router } from 'express'
import type { LoginRequest, RegisterRequest } from '../types/auth'
import { HttpError, login, register } from '../services/authService'

export const authRoute = Router()

authRoute.post('/register', async (req, res, next) => {
  try {
    const payload = req.body as Partial<RegisterRequest>
    const result = await register({
      name: payload.name ?? '',
      lastName: payload.lastName ?? '',
      email: payload.email ?? '',
      password: payload.password ?? '',
      confirmPassword: payload.confirmPassword ?? '',
    })
    res.status(201).json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message })
      return
    }
    next(error)
  }
})

authRoute.post('/login', async (req, res, next) => {
  try {
    const payload = req.body as Partial<LoginRequest>
    const result = await login({
      email: payload.email ?? '',
      password: payload.password ?? '',
    })
    res.status(200).json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message })
      return
    }
    next(error)
  }
})

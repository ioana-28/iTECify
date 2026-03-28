import type { NextFunction, Request, Response } from 'express'
import jwt, { type JwtPayload, type Secret } from 'jsonwebtoken'
import { config } from '../config'

function parseBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null
  }

  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = parseBearerToken(req.header('authorization'))
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret as Secret) as JwtPayload | string
    if (typeof payload === 'string') {
      res.status(401).json({ error: 'Invalid token payload' })
      return
    }

    const sub = payload.sub
    const userId = typeof sub === 'string' ? Number(sub) : Number.NaN
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({ error: 'Invalid token subject' })
      return
    }

    req.auth = { userId }
    next()
  } catch (_error) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

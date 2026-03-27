import bcrypt from 'bcryptjs'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { config } from '../config'
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '../types/auth'
import { createUser, findUserByEmail } from './userRepository'

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function toPublicUser(user: { id: number; name: string; last_name: string; email: string }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    lastName: user.last_name,
    email: user.email,
  }
}

function signToken(userId: number): string {
  const options: SignOptions = {
    expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'],
  }

  return jwt.sign({ sub: String(userId) }, config.auth.jwtSecret as Secret, options)
}

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  const name = input.name.trim()
  const lastName = input.lastName.trim()
  const email = input.email.trim().toLowerCase()

  if (!name || !lastName || !email || !input.password || !input.confirmPassword) {
    throw new HttpError(400, 'All fields are required')
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Invalid email format')
  }

  if (input.password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters')
  }

  if (input.password !== input.confirmPassword) {
    throw new HttpError(400, 'Password and confirmPassword do not match')
  }

  const existingUser = await findUserByEmail(email)
  if (existingUser) {
    throw new HttpError(409, 'Email already registered')
  }

  const passwordHash = await bcrypt.hash(input.password, 10)
  const createdUser = await createUser({
    name,
    lastName,
    email,
    passwordHash,
  })

  return {
    token: signToken(createdUser.id),
    user: toPublicUser(createdUser),
  }
}

export async function login(input: LoginRequest): Promise<AuthResponse> {
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required')
  }

  const user = await findUserByEmail(email)
  if (!user) {
    throw new HttpError(401, 'Invalid credentials')
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid credentials')
  }

  return {
    token: signToken(user.id),
    user: toPublicUser(user),
  }
}

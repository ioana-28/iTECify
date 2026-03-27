export type RegisterRequest = {
  name: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type AuthUser = {
  id: number
  name: string
  lastName: string
  email: string
}

export type AuthResponse = {
  token: string
  user: AuthUser
}

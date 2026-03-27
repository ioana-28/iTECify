import http from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { config } from './config'
import { registerCollaborationGateway } from './socket/collaborationGateway'
import { ensureUsersTable } from './services/userRepository'

const app = createApp()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
  },
})

registerCollaborationGateway(io)

async function bootstrap() {
  await ensureUsersTable()

  server.listen(config.port, config.host, () => {
    console.log(`Backend listening on http://${config.host}:${config.port}`)
  })
}

bootstrap().catch((error: Error) => {
  console.error('Failed to bootstrap server:', error.message)
  process.exit(1)
})

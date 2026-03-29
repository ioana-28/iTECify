import http from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { config } from './config'
import { ensureRoomFileNodeTable } from './services/roomFileNodeRepository'
import { registerCollaborationGateway } from './socket/collaborationGateway'
import { ensureRoomFileVersionTable } from './services/roomFileVersionRepository'
import { ensureCollaborationTables } from './services/roomRepository'
import { ensureUsersTable } from './services/userRepository'
import { ensureProjectsTable } from './services/projectRepository'

const app = createApp()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: "*", // Am schimbat config.corsOrigins cu "*"
    methods: ["GET", "POST"]
  },
})
registerCollaborationGateway(io)

async function bootstrap() {
  await ensureUsersTable()
  await ensureCollaborationTables()
  await ensureProjectsTable()
  await ensureRoomFileNodeTable()
  await ensureRoomFileVersionTable()

  server.listen(config.port, config.host, () => {
    console.log(`Backend listening on http://${config.host}:${config.port}`)
  })
}

bootstrap().catch((error: Error) => {
  console.error('Failed to bootstrap server:', error.message)
  process.exit(1)
})

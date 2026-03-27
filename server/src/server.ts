import http from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { config } from './config'
import { registerCollaborationGateway } from './socket/collaborationGateway'

const app = createApp()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
  },
})

registerCollaborationGateway(io)

server.listen(config.port, config.host, () => {
  console.log(`Backend listening on http://${config.host}:${config.port}`)
})

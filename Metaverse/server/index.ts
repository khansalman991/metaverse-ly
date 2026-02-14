import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server, LobbyRoom } from 'colyseus'
import { monitor } from '@colyseus/monitor'
import { RoomType } from '../types/Rooms'
import { SkyOffice } from './rooms/SkyOffice'

const port = Number(process.env.PORT || 2567)
const endpoint = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'

const app = express()

app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const gameServer = new Server({
  server,
})

// Original Room Handlers
gameServer.define(RoomType.LOBBY, LobbyRoom)

// Public room is always available
gameServer.define(RoomType.PUBLIC, SkyOffice, {
  name: 'Public Lobby',
  description: 'For making friends and familiarizing yourself with the controls',
  password: null,
  autoDispose: false,
})

// Custom rooms
gameServer.define(RoomType.CUSTOM, SkyOffice).enableRealtimeListing()

app.use('/colyseus', monitor())

gameServer.listen(port)
console.log(`Listening on ws://${endpoint}:${port}`)
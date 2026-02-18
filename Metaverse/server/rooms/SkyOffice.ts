import bcrypt from 'bcrypt'
import { Room, Client } from 'colyseus'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard } from './schema/OfficeState'
import { Message } from '../../types/Messages'
import { IRoomData } from '../../types/Rooms'

import PlayerUpdateCommand from './commands/PlayerUpdateCommand'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand'
import ChatMessageUpdateCommand from './commands/ChatMessageUpdateCommand'

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private name!: string
  private description!: string
  private password: string | null = null

  // Tracks pending requests: computerId -> Map<requesterSessionId, { sharerId: string; type: 'view' | 'control' }>
  private pendingRequests = new Map<string, Map<string, { sharerId: string; type: 'view' | 'control' }>>()

  // Tracks who is sharing: computerId -> sharerSessionId
  private sharerMap = new Map<string, string>()

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
    }

    this.setMetadata({ name, description, hasPassword: !!password })
    this.setState(new OfficeState())

    // Initialize map objects
    for (let i = 0; i < 5; i++) {
      this.state.computers.set(String(i), new Computer())
    }
    for (let i = 0; i < 3; i++) {
      this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // --- Standard Message Handlers ---

    this.onMessage(Message.UPDATE_PLAYER, (client: Client, message: { x: number; y: number; anim: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateCommand(), {
        client,
        x: message.x,
        y: message.y,
        anim: message.anim,
      })
    })

    this.onMessage(Message.UPDATE_PLAYER_NAME, (client: Client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), { client, name: message.name })
    })

    this.onMessage(Message.READY_TO_CONNECT, (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.readyToConnect = true
    })

    this.onMessage(Message.VIDEO_CONNECTED, (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = true
    })

    this.onMessage(Message.VIDEO_DISCONNECTED, (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = false
    })

    this.onMessage(Message.ADD_CHAT_MESSAGE, (client: Client, message: { content: string }) => {
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), { client, content: message.content })
      this.broadcast(Message.ADD_CHAT_MESSAGE, {
        clientId: client.sessionId,
        content: message.content,
      }, { except: client })
    })

    this.onMessage("START_MANUAL_CALL", (client: Client, message: { targetSessionId: string }) => {
      const sender = this.state.players.get(client.sessionId)
      const targetClient = this.clients.find(c => c.sessionId === message.targetSessionId)
      if (targetClient && sender) {
        targetClient.send("CALL_REQUEST", {
          fromName: sender.name,
          fromId: client.sessionId,
        })
      }
    })

    this.onMessage("END_CALL", (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = false
    })

    this.onMessage(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), { client, computerId: message.computerId })
    })
    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), { client, computerId: message.computerId })
    })
    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), { client, whiteboardId: message.whiteboardId })
    })
    this.onMessage(Message.DISCONNECT_FROM_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), { client, whiteboardId: message.whiteboardId })
    })

    // --- SCREEN SHARE & REMOTE CONTROL LOGIC ---

    // 1. Host Starts Sharing
    this.onMessage(Message.SCREEN_SHARE_START, (client: Client, message: { computerId: string }) => {
      const { computerId } = message
      this.sharerMap.set(computerId, client.sessionId)
      console.log(`[SERVER] ${client.sessionId} started sharing on computer ${computerId}`)
    })

    // 2. Host Stops Sharing
    this.onMessage(Message.SCREEN_SHARE_STOP, (client: Client, message: { computerId: string }) => {
      const { computerId } = message
      if (this.sharerMap.get(computerId) === client.sessionId) {
        this.sharerMap.delete(computerId)
        console.log(`[SERVER] ${client.sessionId} stopped sharing on computer ${computerId}`)
        
        // Notify all viewers that the stream is gone
        this.broadcast(Message.SCREEN_SHARE_STOP, { computerId })
      }
    })

    // Helper to handle both view and control requests
    const handleRequest = (client: Client, computerId: string, type: 'view' | 'control') => {
      const sharerId = this.sharerMap.get(computerId)
      
      if (!sharerId) {
        console.log(`[SERVER] Request failed: No active sharer for computer ${computerId}`)
        return
      }

      // Store pending request with type
      if (!this.pendingRequests.has(computerId)) {
        this.pendingRequests.set(computerId, new Map())
      }
      this.pendingRequests.get(computerId)!.set(client.sessionId, { sharerId, type })

      // Forward request to the Host
      const sharerClient = this.clients.find(c => c.sessionId === sharerId)
      if (sharerClient) {
        console.log(`[SERVER] Forwarding ${type} request from ${client.sessionId} to host ${sharerId}`)
        sharerClient.send(Message.SCREEN_SHARE_REQUEST, {
          requesterId: client.sessionId,
          computerId,
          type, // Include the type so host knows what is being requested
        })
      }
    }

    // 3. Handle "View Only" Requests (using existing message)
    this.onMessage(Message.SCREEN_SHARE_REQUEST, (client: Client, message: { computerId: string }) => {
      handleRequest(client, message.computerId, 'view')
    })

    // 4. Handle "Remote Control" Requests (new message)
    this.onMessage(Message.REMOTE_CONTROL_REQUEST, (client: Client, message: { computerId: string }) => {
      handleRequest(client, message.computerId, 'control')
    })

    // 5. Handle Host Response (Approve/Deny)
    this.onMessage(Message.SCREEN_SHARE_RESPONSE, (client: Client, message: { requesterId: string; computerId: string; approved: boolean; type?: 'view' | 'control' }) => {
      const { requesterId, computerId, approved, type } = message
      
      const pendingMap = this.pendingRequests.get(computerId)
      const pending = pendingMap?.get(requesterId)
      
      // Security Check: Ensure the client responding is actually the Host for this request
      if (!pending || pending.sharerId !== client.sessionId) {
        console.log(`[SERVER] Security Warning: Unauthorized response from ${client.sessionId}`)
        return
      }

      const requesterClient = this.clients.find(c => c.sessionId === requesterId)
      if (requesterClient) {
        if (approved) {
          console.log(`[SERVER] Access APPROVED for ${requesterId} with type ${type || pending.type}`)
          requesterClient.send(Message.SCREEN_SHARE_APPROVED, { 
            computerId, 
            sharerId: client.sessionId,
            type: type || pending.type // Use the approved type (or fallback to requested)
          })
        } else {
          console.log(`[SERVER] Access DENIED for ${requesterId}`)
          requesterClient.send(Message.SCREEN_SHARE_DENIED, { computerId })
        }
      }

      // Cleanup Request
      pendingMap!.delete(requesterId)
      if (pendingMap!.size === 0) {
        this.pendingRequests.delete(computerId)
      }
    })
  }

  onJoin(client: Client, options: any) {
    const player = new Player()
    this.state.players.set(client.sessionId, player)
  }

  onLeave(client: Client) {
    // 1. Remove from computer users list
    this.state.computers.forEach((computer: any) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    
    // 2. Remove from whiteboard users list
    this.state.whiteboards.forEach((whiteboard: any) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })

    // 3. Cleanup Sharer Map if the Host leaves
    this.sharerMap.forEach((hostId, computerId) => {
      if (hostId === client.sessionId) {
        this.sharerMap.delete(computerId)
        // Notify everyone the show is over
        this.broadcast(Message.SCREEN_SHARE_STOP, { computerId })
      }
    })

    // 4. Cleanup Pending Requests involving this user
    this.pendingRequests.forEach((requests, computerId) => {
      requests.forEach((pending, requesterId) => {
        if (requesterId === client.sessionId || pending.sharerId === client.sessionId) {
          requests.delete(requesterId)
        }
      })
      if (requests.size === 0) {
        this.pendingRequests.delete(computerId)
      }
    })

    this.state.players.delete(client.sessionId)
  }

  onDispose() {
    this.dispatcher.stop()
  }
}
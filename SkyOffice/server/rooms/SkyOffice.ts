import bcrypt from 'bcrypt'
import { Room, Client, ServerError } from 'colyseus'
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

/**
 * SkyOffice Room: Manages the Metaverse environment and real-time interactions.
 */
export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  
  private name!: string
  private description!: string
  private password: string | null = null

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    let hasPassword = false
    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
      hasPassword = true
    }

    // Set Metadata for the frontend lobby logic
    this.setMetadata({ name, description, hasPassword })

    // Initialize the Room State
    this.setState(new OfficeState())

    // Initialize map objects
    for (let i = 0; i < 5; i++) {
      this.state.computers.set(String(i), new Computer())
    }
    for (let i = 0; i < 3; i++) {
      this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // --- MESSAGE HANDLERS ---
    this.onMessage(Message.UPDATE_PLAYER, (client: Client, message: { x: number; y: number; anim: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateCommand(), {
        client,
        x: message.x,
        y: message.y,
        anim: message.anim,
      })
    })

    this.onMessage(Message.UPDATE_PLAYER_NAME, (client: Client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: message.name,
      })
    })

    this.onMessage(Message.ADD_CHAT_MESSAGE, (client: Client, message: { content: string }) => {
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content: message.content,
      })
      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content: message.content },
        { except: client }
      )
    })

    this.onMessage(Message.CONNECT_TO_COMPUTER, (client: Client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), { client, computerId: message.computerId })
    })

    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client: Client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), { client, computerId: message.computerId })
    })

    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client: Client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), { client, whiteboardId: message.whiteboardId })
    })

    this.onMessage(Message.DISCONNECT_FROM_WHITEBOARD, (client: Client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), { client, whiteboardId: message.whiteboardId })
    })
  }

  async onAuth(client: Client, options: { password: string | null }) {
    if (this.password && options.password) {
      const validPassword = await bcrypt.compare(options.password, this.password)
      if (!validPassword) throw new ServerError(403, 'Password is incorrect!')
    }
    return true
  }

  onJoin(client: Client) {
    this.state.players.set(client.sessionId, new Player())
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
    })
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId)
  }

  onDispose() {
    this.dispatcher.stop()
  }
}
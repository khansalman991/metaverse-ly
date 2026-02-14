// Explicitly importing schemas to ensure type recognition
import { Schema, type, MapSchema, SetSchema, ArraySchema } from '@colyseus/schema'
import {
  IPlayer,
  IOfficeState,
  IComputer,
  IWhiteboard,
  IChatMessage,
} from '../../../types/IOfficeState'

/**
 * Utility to generate unique IDs for whiteboards
 */
export const whiteboardRoomIds = new Set<string>()
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function getRoomId(): string {
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  if (!whiteboardRoomIds.has(result)) {
    whiteboardRoomIds.add(result)
    return result
  } else {
    return getRoomId()
  }
}

export class Player extends Schema implements IPlayer {
  @type('string') name = ''
  @type('number') x = 705
  @type('number') y = 500
  @type('string') anim = 'adam_idle_down'
  @type('boolean') readyToConnect = false
  @type('boolean') videoConnected = false
}

export class Computer extends Schema implements IComputer {
  @type({ set: 'string' }) connectedUser = new SetSchema<string>()
}

export class Whiteboard extends Schema implements IWhiteboard {
  @type('string') roomId = getRoomId()
  @type({ set: 'string' }) connectedUser = new SetSchema<string>()
}

export class ChatMessage extends Schema implements IChatMessage {
  @type('string') author = ''
  @type('number') createdAt = new Date().getTime()
  @type('string') content = ''
}

export class OfficeState extends Schema implements IOfficeState {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: Computer }) computers = new MapSchema<Computer>()
  @type({ map: Whiteboard }) whiteboards = new MapSchema<Whiteboard>()
  @type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>()
}
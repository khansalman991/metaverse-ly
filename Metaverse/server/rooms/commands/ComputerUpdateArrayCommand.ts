import { Command } from '@colyseus/command'
import { Client } from 'colyseus'
import { IOfficeState } from '../../../types/IOfficeState'

type Payload = {
  client: Client
  computerId: string
}

export class ComputerAddUserCommand extends Command<IOfficeState, Payload> {
  execute(data: Payload) {
    const { client, computerId } = data
    
    // 1. Get the specific computer and player from the state
    const computer = this.room.state.computers.get(computerId)
    const player = this.room.state.players.get(client.sessionId)
    const clientId = client.sessionId

    // 2. Safety check: ensure both exist
    if (!computer || !player) return
    
    // 3. Prevent duplicate connections
    if (computer.connectedUser.has(clientId)) return

    // 4. Add user to the computer (Logic for "Who is at this desk?")
    computer.connectedUser.add(clientId)

    // 5. CRITICAL: Turn on the Video Flag
    // This tells the frontend to start the PeerJS video stream
    player.videoConnected = true
    player.readyToConnect = true
  }
}

export class ComputerRemoveUserCommand extends Command<IOfficeState, Payload> {
  execute(data: Payload) {
    const { client, computerId } = data
    
    const computer = this.state.computers.get(computerId)
    const player = this.state.players.get(client.sessionId)

    // 1. Remove user from computer list
    if (computer && computer.connectedUser.has(client.sessionId)) {
      computer.connectedUser.delete(client.sessionId)
    }

    // 2. Turn off video when they disconnect
    if (player) {
      player.videoConnected = false
      player.readyToConnect = false
    }
  }
}
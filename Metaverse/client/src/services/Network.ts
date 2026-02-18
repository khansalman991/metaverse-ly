import { Client, Room } from 'colyseus.js'
import {
  IOfficeState,
  IPlayer
} from '../../../types/IOfficeState'
import { Message } from '../../../types/Messages'
import { IRoomData, RoomType } from '../../../types/Rooms'
import { ItemType } from '../../../types/Items'
import WebRTC from '../web/WebRTC'
import ShareScreenManager from '../web/ShareScreenManager'
import { phaserEvents, Event } from '../events/EventCenter'
import store from '../stores'

import {
  setSessionId,
  setPlayerNameMap,
  removePlayerNameMap,
  setVideoConnected
} from '../stores/UserStore'

import {
  setLobbyJoined,
  setAvailableRooms,
  addAvailableRooms,
  removeAvailableRooms
} from '../stores/RoomStore'

import { pushPlayerLeftMessage } from '../stores/ChatStore'
import { setWhiteboardUrls } from '../stores/WhiteboardStore'
import { setShareScreenManager } from '../stores/ComputerStore'

export default class Network {
  private client: Client
  public room?: Room<IOfficeState>
  private lobby!: Room
  public webRTC!: WebRTC
  public mySessionId!: string

  constructor() {
    const protocol = window.location.protocol.replace('http', 'ws')
    const endpoint =
      process.env.NODE_ENV === 'production'
        ? import.meta.env.VITE_SERVER_URL
        : `${protocol}//${window.location.hostname}:2567`

    this.client = new Client(endpoint)

    this.joinLobbyRoom().then(() => {
      store.dispatch(setLobbyJoined(true))
    })

    phaserEvents.on(Event.MY_PLAYER_NAME_CHANGE, this.updatePlayerName, this)
    phaserEvents.on(Event.MY_PLAYER_TEXTURE_CHANGE, this.updatePlayer, this)
    phaserEvents.on(Event.PLAYER_DISCONNECTED, this.playerStreamDisconnect, this)
  }

  /* ============================================================
     LOBBY
  ============================================================ */

  async joinLobbyRoom() {
    this.lobby = await this.client.joinOrCreate(RoomType.LOBBY)

    this.lobby.onMessage('rooms', (rooms) => {
      store.dispatch(setAvailableRooms(rooms))
    })

    this.lobby.onMessage('+', ([roomId, room]) => {
      store.dispatch(addAvailableRooms({ roomId, room }))
    })

    this.lobby.onMessage('-', (roomId) => {
      store.dispatch(removeAvailableRooms(roomId))
    })
  }

  /* ============================================================
     ROOM JOIN
  ============================================================ */

  async joinOrCreatePublic() {
    this.room = await this.client.joinOrCreate(RoomType.PUBLIC)
    this.initialize()
  }

  async joinCustomById(roomId: string, password: string | null) {
    this.room = await this.client.joinById(roomId, { password })
    this.initialize()
  }

  async createCustom(roomData: IRoomData) {
    this.room = await this.client.create(RoomType.CUSTOM, roomData)
    this.initialize()
  }

  /* ============================================================
     INITIALIZE
  ============================================================ */

  initialize() {
    if (!this.room) return

    this.mySessionId = this.room.sessionId
    store.dispatch(setSessionId(this.mySessionId))

    this.webRTC = new WebRTC(this.mySessionId, this)

    // Create and store the screen share manager
    const shareScreenManager = new ShareScreenManager(this.mySessionId, this)
    store.dispatch(setShareScreenManager(shareScreenManager))

    /* -----------------------------
       PLAYERS
    ------------------------------ */

    this.room.state.players.onAdd = (player: IPlayer, key: string) => {

      if (key === this.mySessionId) {

        if (player.videoConnected) {
          store.dispatch(setVideoConnected(true))
          phaserEvents.emit(Event.MY_PLAYER_VIDEO_CONNECTED)
        }

        player.onChange = (changes) => {
          changes.forEach((change) => {
            const { field, value } = change
            if (field === 'videoConnected') {
              store.dispatch(setVideoConnected(value))
              if (value) {
                phaserEvents.emit(Event.MY_PLAYER_VIDEO_CONNECTED)
              } else {
                phaserEvents.emit(Event.MY_PLAYER_VIDEO_DISCONNECTED)
              }
            }
          })
        }
        return
      }

      store.dispatch(setPlayerNameMap({
        id: key,
        name: player.name || 'User'
      }))

      phaserEvents.emit(Event.PLAYER_JOINED, player, key)

      player.onChange = (changes) => {
        changes.forEach((change) => {
          const { field, value } = change
          phaserEvents.emit(Event.PLAYER_UPDATED, field, value, key)

          if (field === 'name' && value !== '') {
            store.dispatch(setPlayerNameMap({ id: key, name: value as string }))
          }

          if (field === 'videoConnected' && value === true) {
            if (this.webRTC && this.webRTC.isVideoEnabled) {
              this.webRTC.connectToNewUser(key)
            }
          }
        })
      }
    }

    this.room.state.players.onRemove = (player: IPlayer, key: string) => {
      phaserEvents.emit(Event.PLAYER_LEFT, key)
      this.webRTC?.deleteVideoStream(key)
      store.dispatch(pushPlayerLeftMessage(player.name))
      store.dispatch(removePlayerNameMap(key))
    }

    /* -----------------------------
       COMPUTERS
    ------------------------------ */

    this.room.state.computers.onAdd = (computer, key) => {
      computer.connectedUser.onAdd = (id: string) =>
        phaserEvents.emit(Event.ITEM_USER_ADDED, id, key, ItemType.COMPUTER)

      computer.connectedUser.onRemove = (id: string) =>
        phaserEvents.emit(Event.ITEM_USER_REMOVED, id, key, ItemType.COMPUTER)
    }

    /* -----------------------------
       WHITEBOARDS
    ------------------------------ */

    this.room.state.whiteboards.onAdd = (whiteboard, key) => {
      store.dispatch(
        setWhiteboardUrls({
          whiteboardId: key,
          roomId: whiteboard.roomId
        })
      )
    }

    /* ============================================================
       SCREEN SHARE MESSAGES
    ============================================================ */

    this.room.onMessage(
      Message.SCREEN_SHARE_REQUEST,
      ({ requesterId, computerId, type }) => {
        phaserEvents.emit(
          Event.SCREEN_SHARE_REQUEST,
          requesterId,
          computerId,
          type
        )
      }
    )

    this.room.onMessage(
      Message.SCREEN_SHARE_APPROVED,
      ({ computerId, sharerId, type }) => {
        phaserEvents.emit(
          Event.SCREEN_SHARE_APPROVED,
          computerId,
          sharerId,
          type
        )
      }
    )

    this.room.onMessage(
      Message.SCREEN_SHARE_DENIED,
      ({ computerId }) => {
        phaserEvents.emit(
          Event.SCREEN_SHARE_DENIED,
          computerId
        )
      }
    )

    this.room.onMessage(
      Message.SCREEN_SHARE_STOP,
      ({ computerId }) => {
        phaserEvents.emit(
          Event.SCREEN_SHARE_STOP,
          computerId
        )
      }
    )
  }

  /* ============================================================
     API METHODS
  ============================================================ */

  readyToConnect() {
    this.room?.send(Message.READY_TO_CONNECT)
  }

  updatePlayer(x: number, y: number, anim: string) {
    this.room?.send(Message.UPDATE_PLAYER, { x, y, anim })
  }

  updatePlayerName(name: string) {
    this.room?.send(Message.UPDATE_PLAYER_NAME, { name })
  }

  videoConnected() {
    this.room?.send(Message.VIDEO_CONNECTED)
  }

  // 🔥 ADD THIS METHOD
  endManualCall() {
    this.room?.send("END_CALL")
  }

  playerStreamDisconnect(id: string) {
    this.room?.send(Message.DISCONNECT_STREAM, { clientId: id })
    this.webRTC?.deleteVideoStream(id)
  }

  connectToComputer(computerId: string) {
    this.room?.send(Message.CONNECT_TO_COMPUTER, { computerId })
  }

  disconnectFromComputer(computerId: string) {
    this.room?.send(Message.DISCONNECT_FROM_COMPUTER, { computerId })
  }

  startScreenShare(computerId: string) {
    this.room?.send(Message.SCREEN_SHARE_START, { computerId })
  }

  stopScreenShare(computerId: string) {
    this.room?.send(Message.SCREEN_SHARE_STOP, { computerId })
  }

  requestScreenShare(computerId: string, type: 'view' | 'control' = 'view') {
    this.room?.send(Message.SCREEN_SHARE_REQUEST, { computerId, type })
  }

  respondToScreenShareRequest(
    requesterId: string,
    computerId: string,
    approved: boolean,
    type?: 'view' | 'control'
  ) {
    this.room?.send(Message.SCREEN_SHARE_RESPONSE, {
      requesterId,
      computerId,
      approved,
      type
    })
  }

  /* ============================================================
     EVENT LISTENERS (for Phaser scene)
  ============================================================ */

  onPlayerJoined(callback: (player: IPlayer, key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_JOINED, callback, context)
  }

  onPlayerLeft(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_LEFT, callback, context)
  }

  onMyPlayerReady(callback: () => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_READY, callback, context)
  }

  onMyPlayerVideoConnected(callback: () => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_VIDEO_CONNECTED, callback, context)
  }

  onMyPlayerVideoDisconnected(callback: () => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_VIDEO_DISCONNECTED, callback, context)
  }

  onPlayerUpdated(callback: (field: string, value: number | string, id: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_UPDATED, callback, context)
  }

  onItemUserAdded(callback: (playerId: string, itemId: string, itemType: ItemType) => void, context?: any) {
    phaserEvents.on(Event.ITEM_USER_ADDED, callback, context)
  }

  onItemUserRemoved(callback: (playerId: string, itemId: string, itemType: ItemType) => void, context?: any) {
    phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context)
  }

  onChatMessageAdded(callback: (playerId: string, content: string) => void, context?: any) {
    phaserEvents.on(Event.UPDATE_DIALOG_BUBBLE, callback, context)
  }
}
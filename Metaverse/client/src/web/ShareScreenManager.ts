import Peer from 'peerjs'
import store from '../stores'
import {
  setMyStream,
  addVideoStream,
  removeVideoStream
} from '../stores/ComputerStore'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import Network from '../services/Network'

export default class ShareScreenManager {
  private peer: Peer
  private myStream?: MediaStream
  private dataConnections = new Map<string, Peer.DataConnection>()
  
  // FIX: Store computerId locally to avoid calling store.getState() during cleanup
  private sharingComputerId: string | null = null 

  constructor(
    private userId: string,
    public network: Network
  ) {
    const peerId = this.makePeerId(userId)
    this.peer = new Peer(peerId)
    this.setupPeerListeners()
  }

  /* ============================================================
     PEER SETUP
  ============================================================ */

  private setupPeerListeners() {
    this.peer.on('open', (id) => {
      console.log('[ShareScreenManager] Peer connected:', id)
    })

    this.peer.on('error', (err) => {
      console.error('[ShareScreenManager] Peer error:', err)
    })

    this.peer.on('call', (call) => {
      call.answer()
      call.on('stream', (remoteStream) => {
        store.dispatch(addVideoStream({ id: call.peer, call, stream: remoteStream }))
      })
      call.on('close', () => {
        store.dispatch(removeVideoStream(call.peer))
      })
    })

    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        console.log('[ShareScreenManager] Data connection open:', conn.peer)
        this.dataConnections.set(conn.peer, conn)
      })
      conn.on('data', (data: any) => {
        console.log('[Remote Input]', data)
        const game = phaserGame.scene.keys.game as Game
        game?.events.emit('remote_input', data)
      })
      conn.on('close', () => {
        this.dataConnections.delete(conn.peer)
      })
    })
  }

  /* ============================================================
     DIALOG LIFECYCLE
  ============================================================ */

  onOpen() {
    if (this.peer.disconnected) {
      this.peer.reconnect()
    }
  }

  onClose() {
    this.stopScreenShare()
    this.peer.disconnect()
  }

  /* ============================================================
     HOST CONTROLS
  ============================================================ */

  async startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = () => this.stopScreenShare()
      }

      this.myStream = stream
      
      // FIX: Capture ID from store NOW (safe, as this is async user interaction)
      // and save it to the class instance for later cleanup.
      const state = store.getState().computer
      this.sharingComputerId = state.computerId

      store.dispatch(setMyStream(stream))

      const game = phaserGame.scene.keys.game as Game
      
      if (this.sharingComputerId) {
        console.log('[ShareScreenManager] Sharing started:', this.sharingComputerId)
        game.network.startScreenShare(this.sharingComputerId)
      }
    } catch (err) {
      console.error('[ShareScreenManager] Screen share failed:', err)
    }
  }

  stopScreenShare() {
    if (this.myStream) {
      this.myStream.getTracks().forEach((t) => t.stop())
      this.myStream = undefined
    }

    this.dataConnections.forEach((conn) => conn.close())
    this.dataConnections.clear()

    // Note: Dispatching here is generally okay, but be aware if this runs inside a reducer 
    // it might queue. Ideally, actions shouldn't dispatch other actions, but for cleanup it works.
    store.dispatch(setMyStream(null))

    // FIX: Use the locally cached ID instead of asking the store
    if (this.sharingComputerId) {
      const game = phaserGame.scene.keys.game as Game
      console.log('[ShareScreenManager] Sharing stopped:', this.sharingComputerId)
      game.network.stopScreenShare(this.sharingComputerId)
      
      // Clear the local cache
      this.sharingComputerId = null 
    }
  }

  /* ============================================================
     HOST APPROVES VIEWER
  ============================================================ */

  onUserApproved(viewerId: string, type: 'view' | 'control') {
    if (!this.myStream) return
    const viewerPeerId = this.makePeerId(viewerId)
    console.log(`[ShareScreenManager] Approving ${viewerId} (${type})`)

    const call = this.peer.call(viewerPeerId, this.myStream)
    call.on('close', () => {
      store.dispatch(removeVideoStream(viewerPeerId))
    })

    if (type === 'control') {
      const conn = this.peer.connect(viewerPeerId)
      conn.on('open', () => {
        console.log('[ShareScreenManager] Control channel open:', viewerId)
        this.dataConnections.set(viewerPeerId, conn)
      })
      conn.on('close', () => {
        this.dataConnections.delete(viewerPeerId)
      })
    }
  }

  /* ============================================================
     VIEWER SIDE
  ============================================================ */

  connectToSharer(sharerId: string) {
    console.log('[ShareScreenManager] Viewer waiting for host call:', sharerId)
  }

  /* ============================================================
     REMOTE CONTROL (Viewer sends input)
  ============================================================ */

  sendInput(inputData: any) {
    this.dataConnections.forEach((conn) => {
      conn.send(inputData)
    })
  }

  /* ============================================================
     USER LEFT CLEANUP
  ============================================================ */

  onUserLeft(userId: string) {
    const peerId = this.makePeerId(userId)
    store.dispatch(removeVideoStream(peerId))
    const conn = this.dataConnections.get(peerId)
    if (conn) {
      conn.close()
      this.dataConnections.delete(peerId)
    }
  }

  /* ============================================================
     UTIL
  ============================================================ */

  private makePeerId(id: string) {
    return id.replace(/[^0-9a-z]/gi, 'G') + '-ss'
  }
}
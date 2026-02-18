import Peer from 'peerjs'
import Network from '../services/Network'
import store from '../stores'
import { setLocalStream, addPeerStream, removePeerStream } from '../stores/WebcamStore'
import { phaserEvents, Event } from '../events/EventCenter'

export default class WebRTC {
  private myPeer: Peer
  private myStream?: MediaStream
  private network: Network
  private peers = new Map<string, Peer.MediaConnection>()
  private pendingCalls = new Map<string, Peer.MediaConnection>()
  public isVideoEnabled = false
  private isInitializing = false // Guard to prevent duplicate getUserMedia

  constructor(userId: string, network: Network) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.myPeer = new Peer(sanitizedId)
    this.network = network

    this.myPeer.on('error', (err) => {
      if (err.type === 'peer-unavailable') return
      console.error('WebRTC Error:', err)
    })

    this.myPeer.on('call', (call) => {
      console.log(`📞 Incoming call from ${call.peer}`)

      if (this.myStream) {
        console.log('✅ Answering immediately with existing stream')
        call.answer(this.myStream)
        this.peers.set(call.peer, call)
      } else {
        console.log('⏳ No stream yet – storing call for later')
        this.pendingCalls.set(call.peer, call)
      }

      call.on('stream', (userVideoStream) => {
        console.log(`📹 Received stream from ${call.peer}`)
        store.dispatch(addPeerStream({ id: call.peer, stream: userVideoStream }))
      })
    })

    phaserEvents.on(Event.MY_PLAYER_VIDEO_CONNECTED, () => {
      console.log('📹 MY_PLAYER_VIDEO_CONNECTED received')
      if (!this.isVideoEnabled && !this.isInitializing) {
        this.getUserMedia()
      }
    })

    phaserEvents.on(Event.MY_PLAYER_VIDEO_DISCONNECTED, () => {
      console.log('🔴 MY_PLAYER_VIDEO_DISCONNECTED received')
      this.stopVideo()
    })

    phaserEvents.on(Event.PLAYER_JOINED, (newPlayer, sessionId) => {
      console.log(`👤 Player joined: ${sessionId}`)
      if (this.isVideoEnabled && this.myStream && sessionId) {
        this.connectToNewUser(sessionId)
      }
    })

    phaserEvents.on(Event.PLAYER_LEFT, (id) => {
      console.log(`👋 Player left: ${id}`)
      this.deleteVideoStream(id)
    })
  }

  checkPreviousPermission() {
    const permissionName = 'microphone' as PermissionName
    navigator.permissions?.query({ name: permissionName }).then((result) => {
      if (result.state === 'granted') {
        console.log('[WebRTC] Permission already active.')
      }
    })
  }

  getUserMedia() {
    if (this.isVideoEnabled || this.myStream || this.isInitializing) return
    this.isInitializing = true

    console.log('🎥 Requesting user media...')
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log('✅ Got local stream')
        this.myStream = stream
        this.isVideoEnabled = true
        this.isInitializing = false
        store.dispatch(setLocalStream(stream))

        console.log(`📞 Answering ${this.pendingCalls.size} pending calls...`)
        this.pendingCalls.forEach((call, peerId) => {
          console.log(`   → Answering call from ${peerId}`)
          call.answer(this.myStream)
          this.peers.set(peerId, call)
        })
        this.pendingCalls.clear()

        const players = store.getState().user.playerNameMap
        console.log(`📞 Calling ${players.size} existing players...`)
        players.forEach((_, id) => {
          if (id !== this.network.mySessionId) {
            this.connectToNewUser(id)
          }
        })
      })
      .catch((error) => {
        console.error('Failed to get local stream:', error)
        this.isInitializing = false
      })
  }

  stopVideo() {
    console.log('🛑 Stopping video and closing all connections')
    if (this.myStream) {
      this.myStream.getTracks().forEach(track => {
        track.stop()
        track.enabled = false
      })
      this.myStream = undefined
    }
    this.isVideoEnabled = false
    this.isInitializing = false
    store.dispatch(setLocalStream(null))

    this.peers.forEach((peer, id) => {
      peer.close()
      store.dispatch(removePeerStream(id))
    })
    this.peers.clear()
    this.pendingCalls.clear()
  }

  connectToNewUser(userId: string) {
    if (!this.myStream || !userId) {
      console.log(`⚠️ Cannot call ${userId}: no local stream or invalid userId`)
      return
    }
    const sanitizedId = this.replaceInvalidId(userId)

    if (this.peers.has(sanitizedId)) {
      console.log(`⏭️ Already connected to ${userId}, skipping`)
      return
    }

    console.log(`📞 Calling new user ${userId} (sanitized: ${sanitizedId})`)
    const call = this.myPeer.call(sanitizedId, this.myStream)

    call.on('stream', (userVideoStream) => {
      console.log(`📹 Received stream from ${userId}`)
      store.dispatch(addPeerStream({ id: userId, stream: userVideoStream }))
    })

    call.on('close', () => {
      console.log(`🔇 Call with ${userId} closed`)
      this.deleteVideoStream(userId)
    })

    this.peers.set(sanitizedId, call)
  }

  deleteVideoStream(userId: string) {
    console.log(`🗑️ Deleting video stream for ${userId}`)
    const sanitizedId = this.replaceInvalidId(userId)
    if (this.peers.has(sanitizedId)) {
      this.peers.get(sanitizedId)?.close()
      this.peers.delete(sanitizedId)
    }
    store.dispatch(removePeerStream(userId))
  }

  deleteOnCalledVideoStream(userId: string) {
    this.deleteVideoStream(userId)
  }

  private replaceInvalidId(userId: string) {
    if (!userId) return ''
    return userId.replace(/[^0-9a-z]/gi, 'G')
  }
}
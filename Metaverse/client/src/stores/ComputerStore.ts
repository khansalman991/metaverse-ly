import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import Peer from 'peerjs'
import { sanitizeId } from '../util'
import ShareScreenManager from '../web/ShareScreenManager'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

// --- Types ---
type ComputerMode = 'host' | 'viewer' | null

interface PeerStreamData {
  stream: MediaStream
  call: Peer.MediaConnection
}

interface ViewerRequestDialogState {
  open: boolean
  computerId: string | null
  hostId: string | null
}

interface IncomingRequestState {
  open: boolean
  requesterId: string | null
  requesterName: string | null
  type: 'view' | 'control' | null
}

interface ComputerState {
  computerDialogOpen: boolean
  computerId: string | null
  mode: ComputerMode
  hostId: string | null
  myStream: MediaStream | null
  peerStreams: Map<string, PeerStreamData>
  shareScreenManager: ShareScreenManager | null
  viewerRequestDialog: ViewerRequestDialogState
  incomingRequest: IncomingRequestState
  accessDenied: boolean
}

// --- Initial State ---
const initialState: ComputerState = {
  computerDialogOpen: false,
  computerId: null,
  mode: null,
  hostId: null,
  myStream: null,
  peerStreams: new Map(),
  shareScreenManager: null,
  viewerRequestDialog: {
    open: false,
    computerId: null,
    hostId: null,
  },
  incomingRequest: {
    open: false,
    requesterId: null,
    requesterName: null,
    type: null,
  },
  accessDenied: false,
}

export const computerSlice = createSlice({
  name: 'computer',
  initialState,
  reducers: {
    setShareScreenManager: (state, action: PayloadAction<ShareScreenManager | null>) => {
      state.shareScreenManager = action.payload
    },

    openHostComputerDialog: (state, action: PayloadAction<{ computerId: string; hostId: string }>) => {
      // NOTE: We rely on the Component/Item to create the manager if needed.
      // This reducer simply updates the state to show the dialog.
      state.computerDialogOpen = true
      state.computerId = action.payload.computerId
      state.mode = 'host'
      state.hostId = action.payload.hostId
      
      const game = phaserGame.scene.keys.game as Game
      game.disableKeys()
    },

    openViewerRequestDialog: (state, action: PayloadAction<{ computerId: string; hostId: string }>) => {
      state.viewerRequestDialog = {
        open: true,
        computerId: action.payload.computerId,
        hostId: action.payload.hostId,
      }
    },

    closeViewerRequestDialog: (state) => {
      state.viewerRequestDialog = {
        open: false,
        computerId: null,
        hostId: null,
      }
    },

    showIncomingAccessRequest: (state, action: PayloadAction<{ requesterId: string; requesterName: string; type: 'view' | 'control' }>) => {
      state.incomingRequest = {
        open: true,
        requesterId: action.payload.requesterId,
        requesterName: action.payload.requesterName,
        type: action.payload.type,
      }
    },

    clearIncomingAccessRequest: (state) => {
      state.incomingRequest = {
        open: false,
        requesterId: null,
        requesterName: null,
        type: null,
      }
    },

    showAccessDeniedMessage: (state) => {
      state.accessDenied = true
    },

    clearAccessDeniedMessage: (state) => {
      state.accessDenied = false
    },

    closeComputerDialog: (state) => {
      const game = phaserGame.scene.keys.game as Game
      game.enableKeys()

      if (state.computerId) {
        game.network.disconnectFromComputer(state.computerId)
      }

      state.peerStreams.forEach(({ call }) => {
        call.close()
      })

      // FIX: Removed state.shareScreenManager.onClose() call.
      // Cleanup must be handled in the React Component (ComputerDialog.tsx) 
      // or the Class Item (Computer.ts) before dispatching this action.
      
      state.computerDialogOpen = false
      state.computerId = null
      state.mode = null
      state.hostId = null
      state.myStream = null
      state.peerStreams.clear()
    },

    setMyStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.myStream = action.payload
    },

    addVideoStream: (state, action: PayloadAction<{ id: string; call: Peer.MediaConnection; stream: MediaStream }>) => {
      state.peerStreams.set(sanitizeId(action.payload.id), {
        call: action.payload.call,
        stream: action.payload.stream,
      })
    },

    removeVideoStream: (state, action: PayloadAction<string>) => {
      state.peerStreams.delete(sanitizeId(action.payload))
    },
  },
})

export const {
  setShareScreenManager,
  openHostComputerDialog,
  openViewerRequestDialog,
  closeViewerRequestDialog,
  showIncomingAccessRequest,
  clearIncomingAccessRequest,
  showAccessDeniedMessage,
  clearAccessDeniedMessage,
  closeComputerDialog,
  setMyStream,
  addVideoStream,
  removeVideoStream,
} = computerSlice.actions

export default computerSlice.reducer
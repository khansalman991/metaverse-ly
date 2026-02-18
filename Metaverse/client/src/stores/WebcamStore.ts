import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface WebcamState {
  localStream: MediaStream | null
  peerStreams: { [id: string]: MediaStream }
  audioEnabled: boolean
  videoEnabled: boolean
}

const initialState: WebcamState = {
  localStream: null,
  peerStreams: {},
  audioEnabled: true,
  videoEnabled: true,
}

export const webcamSlice = createSlice({
  name: 'webcam',
  initialState,
  reducers: {
    setLocalStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.localStream = action.payload
    },
    addPeerStream: (state, action: PayloadAction<{ id: string; stream: MediaStream }>) => {
      state.peerStreams[action.payload.id] = action.payload.stream
    },
    removePeerStream: (state, action: PayloadAction<string>) => {
      delete state.peerStreams[action.payload]
    },
    setAudioEnabled: (state, action: PayloadAction<boolean>) => {
      state.audioEnabled = action.payload
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => (track.enabled = action.payload))
      }
    },
    setVideoEnabled: (state, action: PayloadAction<boolean>) => {
      state.videoEnabled = action.payload
      if (state.localStream) {
        state.localStream.getVideoTracks().forEach((track) => (track.enabled = action.payload))
      }
    },
  },
})

export const { setLocalStream, addPeerStream, removePeerStream, setAudioEnabled, setVideoEnabled } =
  webcamSlice.actions

export default webcamSlice.reducer
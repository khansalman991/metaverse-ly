import React from 'react'
import styled from 'styled-components'
import { useAppSelector } from '../hooks'
import Video from './Video'

// Styles for the floating video bar (Top-Right corner)
const GridContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column; // Stack videos vertically
  gap: 10px;
  width: 250px; // Fixed width for the video column
  pointer-events: none; // Let clicks pass through to the game
  z-index: 100;
`

const VideoWrapper = styled.div`
  position: relative;
  width: 100%;
  background: black;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  pointer-events: auto; // Re-enable clicks for the video buttons (mute/etc)

  video {
    width: 100%;
    height: auto;
    display: block;
    transform: scaleX(-1); // Mirror effect for webcam
  }
`

const UserName = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
`

export default function VideoGrid() {
  // 1. Get Local Stream (Your Face)
  const localStream = useAppSelector((state) => state.webcam.localStream)
  
  // 2. Get Remote Streams (Other Players)
  const peerStreams = useAppSelector((state) => state.webcam.peerStreams)
  const myPlayerId = useAppSelector((state) => state.user.sessionId)

  return (
    <GridContainer>
      {/* RENDER YOUR LOCAL VIDEO */}
      {localStream && (
        <VideoWrapper>
          <Video srcObject={localStream} autoPlay playsInline muted />
          <UserName>You</UserName>
        </VideoWrapper>
      )}

      {/* RENDER REMOTE VIDEOS (Friends) */}
      {peerStreams && Object.keys(peerStreams).map((id) => {
        const stream = peerStreams[id]
        if (!stream) return null
        
        return (
          <VideoWrapper key={id}>
            <Video srcObject={stream} autoPlay playsInline />
            <UserName>Player {id.slice(0, 4)}</UserName>
          </VideoWrapper>
        )
      })}
    </GridContainer>
  )
}
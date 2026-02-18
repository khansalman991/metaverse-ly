import React from 'react'
import styled from 'styled-components'
import { useAppSelector } from '../hooks'
import Video from './Video'

// --- Styled Components ---
const Container = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 1000;
  pointer-events: auto;
  max-width: 280px;
  width: 100%;
`

const VideoGridInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

// Use transient prop $isLocal to avoid passing it to the DOM
const VideoCard = styled.div<{ $isLocal?: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #1a1a2e;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid ${({ $isLocal }) => ($isLocal ? '#4a6fa5' : '#2a2a3a')};
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s ease, border-color 0.2s;

  &:hover {
    transform: scale(1.02);
    border-color: ${({ $isLocal }) => ($isLocal ? '#6b8fc6' : '#4a6fa5')};
  }
`

const StyledVideo = styled(Video)`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #0a0a14;
`

const NameLabel = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  color: white;
  padding: 12px 12px 8px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
`

const EmptyState = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  text-align: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  border: 1px dashed #4a6fa5;
`

// --- Component ---
export default function VideoGrid({ network }: { network: any }) {
  const localStream = useAppSelector((state) => state.webcam.localStream)
  const peerStreams = useAppSelector((state) => state.webcam.peerStreams)
  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)
  const mySessionId = useAppSelector((state) => state.user.sessionId)

  // Safely get own name
  let myName = 'You'
  if (mySessionId) {
    if (playerNameMap instanceof Map) {
      myName = playerNameMap.get(mySessionId) || 'You'
    } else if (playerNameMap && typeof playerNameMap === 'object') {
      myName = (playerNameMap as Record<string, string>)[mySessionId] || 'You'
    }
  }

  // Convert peerStreams to array of entries
  let peerEntries: [string, MediaStream][] = []
  if (peerStreams) {
    if (peerStreams instanceof Map) {
      peerEntries = Array.from(peerStreams.entries())
    } else if (typeof peerStreams === 'object') {
      peerEntries = Object.entries(peerStreams)
    }
  }

  const hasAnyVideo = !!localStream || peerEntries.length > 0

  return (
    <Container>
      {!hasAnyVideo ? (
        <EmptyState>No active video calls</EmptyState>
      ) : (
        <VideoGridInner>
          {/* Local video */}
          {localStream && (
            <VideoCard $isLocal>
              <StyledVideo srcObject={localStream} autoPlay muted />
              <NameLabel>{myName}</NameLabel>
            </VideoCard>
          )}

          {/* Remote videos */}
          {peerEntries.map(([id, stream]) => {
            let displayName = `User ${id.slice(0, 4)}`
            if (playerNameMap instanceof Map) {
              displayName = playerNameMap.get(id) || displayName
            } else if (playerNameMap && typeof playerNameMap === 'object') {
              displayName = (playerNameMap as Record<string, string>)[id] || displayName
            }
            return (
              <VideoCard key={id}>
                <StyledVideo srcObject={stream} autoPlay />
                <NameLabel>{displayName}</NameLabel>
              </VideoCard>
            )
          })}
        </VideoGridInner>
      )}
    </Container>
  )
}
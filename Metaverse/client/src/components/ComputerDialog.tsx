import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import ScreenShareIcon from '@mui/icons-material/ScreenShare'
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote'

import { useAppSelector, useAppDispatch } from '../hooks'
import {
  closeComputerDialog,
  clearIncomingAccessRequest,
  clearAccessDeniedMessage
} from '../stores/ComputerStore'

import Video from './Video'

/* ============================================================ */
/* STYLES */
/* ============================================================ */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  padding: 16px 180px 16px 16px;
`

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  background: #222639;
  border-radius: 16px;
  padding: 16px;
  color: #eee;
  position: relative;
  display: flex;
  flex-direction: column;
`

const VideoGrid = styled.div`
  flex: 1;
  display: grid;
  grid-gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(40%, 1fr));
`

const OrangePopup = styled.div`
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  background: #2a2a3a;
  border: 2px solid #ff9800;
  padding: 20px;
  border-radius: 12px;
  z-index: 1000;
`

const StatusMessage = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #444;
  padding: 8px 16px;
  border-radius: 20px;
`

/* ============================================================ */
/* COMPONENT */
/* ============================================================ */

export default function ComputerDialog() {
  const dispatch = useAppDispatch()

  const mode = useAppSelector((s) => s.computer.mode)
  const computerId = useAppSelector((s) => s.computer.computerId)
  const myStream = useAppSelector((s) => s.computer.myStream)
  const peerStreams = useAppSelector((s) => s.computer.peerStreams)
  const incomingRequest = useAppSelector((s) => s.computer.incomingRequest)
  const accessDenied = useAppSelector((s) => s.computer.accessDenied)
  const shareScreenManager = useAppSelector((s) => s.computer.shareScreenManager)
  const playerNameMap = useAppSelector((s) => s.user.playerNameMap)

  const [statusMsg, setStatusMsg] = useState('')

  /* ============================================================ */
  /* ACCESS DENIED */
  /* ============================================================ */

  useEffect(() => {
    if (accessDenied) {
      setStatusMsg('Access Denied.')
      setTimeout(() => {
        setStatusMsg('')
        dispatch(clearAccessDeniedMessage())
      }, 3000)
    }
  }, [accessDenied])

  /* ============================================================ */
  /* HOST ACTIONS */
  /* ============================================================ */

  const toggleShare = () => {
    if (!shareScreenManager) return

    if (myStream) {
      shareScreenManager.stopScreenShare()
    } else {
      shareScreenManager.startScreenShare()
    }
  }

  const approveRequest = () => {
    if (!incomingRequest.open || !shareScreenManager || !computerId) return

    shareScreenManager.network.respondToScreenShareRequest(
      incomingRequest.requesterId!,
      computerId,
      true,
      incomingRequest.type!
    )

    shareScreenManager.onUserApproved(
      incomingRequest.requesterId!,
      incomingRequest.type!
    )

    dispatch(clearIncomingAccessRequest())
  }

  const denyRequest = () => {
    if (!incomingRequest.open || !shareScreenManager || !computerId) return

    shareScreenManager.network.respondToScreenShareRequest(
      incomingRequest.requesterId!,
      computerId,
      false,
      incomingRequest.type!
    )

    dispatch(clearIncomingAccessRequest())
  }

  /* ============================================================ */
  /* VIEWER ACTIONS */
  /* ============================================================ */

  const requestAccess = (type: 'view' | 'control') => {
    if (!shareScreenManager || !computerId) return

    setStatusMsg(`Requesting ${type} access...`)

    shareScreenManager.network.requestScreenShare(
      computerId,
      type
    )
  }

  /* ============================================================ */
  /* RENDER */
  /* ============================================================ */

  return (
    <Backdrop>
      <Wrapper>

        <IconButton
          onClick={() => {
            console.log('Close button clicked');
            dispatch(closeComputerDialog());
          }}
          style={{ position: 'absolute', top: 16, right: 16 }}
        >
          <CloseIcon />
        </IconButton>

        {/* HOST POPUP */}
        {mode === 'host' && incomingRequest.open && (
          <OrangePopup>
            <h3>
              {incomingRequest.type === 'control'
                ? 'Remote Control Request'
                : 'Screen View Request'}
            </h3>

            <p>
              <strong>
                {playerNameMap.get(incomingRequest.requesterId!) || 'User'}
              </strong>{' '}
              wants to{' '}
              {incomingRequest.type === 'control'
                ? 'CONTROL your computer.'
                : 'view your screen.'}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="contained"
                color="success"
                onClick={approveRequest}
              >
                Allow
              </Button>

              <Button
                variant="contained"
                color="error"
                onClick={denyRequest}
              >
                Deny
              </Button>
            </div>
          </OrangePopup>
        )}

        {statusMsg && <StatusMessage>{statusMsg}</StatusMessage>}

        <div style={{ marginBottom: 12, display: 'flex', gap: 10 }}>

          {mode === 'host' && (
            <Button
              variant="contained"
              color={myStream ? 'error' : 'primary'}
              startIcon={<ScreenShareIcon />}
              onClick={toggleShare}
            >
              {myStream ? 'Stop Sharing' : 'Share Screen'}
            </Button>
          )}

          {mode === 'viewer' && (
            <>
              <Button
                variant="contained"
                color="info"
                startIcon={<ScreenShareIcon />}
                onClick={() => requestAccess('view')}
              >
                View Screen
              </Button>

              <Button
                variant="contained"
                color="warning"
                startIcon={<SettingsRemoteIcon />}
                onClick={() => requestAccess('control')}
              >
                Request Control
              </Button>
            </>
          )}
        </div>

        <VideoGrid>
          {myStream && <Video srcObject={myStream} autoPlay />}

          {[...peerStreams.entries()].map(([id, { stream }]) => (
            <Video key={id} srcObject={stream} autoPlay />
          ))}
        </VideoGrid>

      </Wrapper>
    </Backdrop>
  )
}
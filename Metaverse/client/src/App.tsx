import React from 'react'
import styled from 'styled-components'

import { useAppSelector } from './hooks'

import RoomSelectionDialog from './components/RoomSelectionDialog'
import LoginDialog from './components/LoginDialog'
import ComputerDialog from './components/ComputerDialog'
import ComputerRequestDialog from './components/ComputerRequestDialog'
import WhiteboardDialog from './components/WhiteboardDialog'
import VideoConnectionDialog from './components/VideoConnectionDialog'
import Chat from './components/Chat'
import HelperButtonGroup from './components/HelperButtonGroup'
import MobileVirtualJoystick from './components/MobileVirtualJoystick'
import VideoGrid from './components/VideoGrid'

/* ============================================================
   STYLES
============================================================ */

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`

/* ============================================================
   APP
============================================================ */

function App() {
  const loggedIn = useAppSelector((state) => state.user.loggedIn)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)

  const computerDialogOpen = useAppSelector(
    (state) => state.computer.computerDialogOpen
  )

  const viewerRequestDialogOpen = useAppSelector(
    (state) => state.computer.viewerRequestDialog.open
  )

  const whiteboardDialogOpen = useAppSelector(
    (state) => state.whiteboard.whiteboardDialogOpen
  )

  const videoConnected = useAppSelector(
    (state) => state.user.videoConnected
  )

  let ui: JSX.Element

  /* ============================================================
     UI FLOW
  ============================================================ */

  if (loggedIn) {
    if (computerDialogOpen) {
      ui = <ComputerDialog />
    } 
    else if (whiteboardDialogOpen) {
      ui = <WhiteboardDialog />
    } 
    else {
      ui = (
        <>
          <Chat />

          {!videoConnected && <VideoConnectionDialog />}
          {videoConnected && <VideoGrid network={undefined} />}

          <MobileVirtualJoystick />

          {viewerRequestDialogOpen && <ComputerRequestDialog />}
        </>
      )
    }
  } 
  else if (roomJoined) {
    ui = <LoginDialog />
  } 
  else {
    ui = <RoomSelectionDialog />
  }

  return (
    <Backdrop>
      {ui}

      {!computerDialogOpen && !whiteboardDialogOpen && (
        <HelperButtonGroup />
      )}
    </Backdrop>
  )
}

export default App

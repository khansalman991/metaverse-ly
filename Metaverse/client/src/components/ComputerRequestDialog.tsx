import React from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import { useAppDispatch, useAppSelector } from '../hooks'
import { closeViewerRequestDialog } from '../stores/ComputerStore'

/* ============================================================
   STYLES
============================================================ */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
`

const Dialog = styled.div`
  background: #2a2a3a;
  padding: 28px;
  border-radius: 18px;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 320px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
  text-align: center;
`

const Title = styled.h3`
  margin: 0;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`

const CancelButton = styled(Button)`
  margin-top: 10px;
`

/* ============================================================
   COMPONENT
============================================================ */

export default function ComputerRequestDialog() {
  const dispatch = useAppDispatch()

  const dialogState = useAppSelector(
    (state) => state.computer.viewerRequestDialog
  )

  const shareScreenManager = useAppSelector(
    (state) => state.computer.shareScreenManager
  )

  if (!dialogState.open || !dialogState.computerId) return null

  /* ============================================================
     REQUEST HANDLER
  ============================================================ */

  const handleRequest = (type: 'view' | 'control') => {
    if (!shareScreenManager) return

    shareScreenManager.network.requestScreenShare(
      dialogState.computerId!,
      type
    )

    dispatch(closeViewerRequestDialog())
  }

  /* ============================================================
     CLOSE
  ============================================================ */

  const handleClose = () => {
    dispatch(closeViewerRequestDialog())
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <Overlay onClick={handleClose}>
      <Dialog onClick={(e) => e.stopPropagation()}>
        <Title>Request Access</Title>

        <p>What would you like to do?</p>

        <ButtonGroup>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleRequest('view')}
          >
            View Screen
          </Button>

          <Button
            variant="contained"
            color="warning"
            onClick={() => handleRequest('control')}
          >
            Request Control
          </Button>
        </ButtonGroup>

        <CancelButton variant="text" onClick={handleClose}>
          Cancel
        </CancelButton>
      </Dialog>
    </Overlay>
  )
}

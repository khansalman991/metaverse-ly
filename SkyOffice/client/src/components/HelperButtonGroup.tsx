import React, { useState, useMemo } from 'react'
import styled, { keyframes } from 'styled-components'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'

// Corrected icon paths - moved from @mui/material to @mui/icons-material
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import CloseIcon from '@mui/icons-material/Close'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CircleIcon from '@mui/icons-material/Circle'
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset'
import VideogameAssetOffIcon from '@mui/icons-material/VideogameAssetOff'

import { BackgroundMode } from '../../../types/BackgroundMode'
import { setShowJoystick, toggleBackgroundMode } from '../stores/UserStore'
import { useAppSelector, useAppDispatch } from '../hooks'
import { getAvatarString, getColorByString } from '../util'

const pulse = keyframes`
  0% { transform: scale(0.95); opacity: 0.7; }
  70% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
`

const Backdrop = styled.div`
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: 12px;
  bottom: 20px;
  right: 20px;
  align-items: flex-end;
  z-index: 1000;
`

const StatusBadge = styled.div<{ $isOffline: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(34, 38, 57, 0.9);
  padding: 8px 16px;
  border-radius: 24px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  backdrop-filter: blur(4px);
  border: 1px solid ${props => props.$isOffline ? '#ff9800' : '#4caf50'};
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);

  .light {
    color: ${props => props.$isOffline ? '#9e9e9e' : '#4caf50'}; 
    animation: ${props => props.$isOffline ? 'none' : pulse} 2s infinite ease-in-out;
  }
`

const Wrapper = styled.div`
  position: relative;
  font-size: 16px;
  color: #eee;
  background: #222639;
  box-shadow: 0px 0px 5px #0000006f;
  border-radius: 16px;
  padding: 15px 35px 15px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .close {
    position: absolute;
    top: 15px;
    right: 15px;
  }
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
`

const RoomName = styled.div`
  margin: 10px 20px;
  max-width: 460px;
  max-height: 150px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;

  h3 {
    font-size: 24px;
    color: #eee;
  }
`

const RoomDescription = styled.div`
  margin: 0 20px;
  max-width: 460px;
  max-height: 150px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  font-size: 16px;
  color: #c2c2c2;
  display: flex;
  justify-content: center;
`

const StyledFab = styled(Fab)`
  background-color: #2c314d !important;
  color: #eee !important;
  &:hover {
    color: #1ea2df !important;
  }
`

export default function HelperButtonGroup() {
  const [showRoomInfo, setShowRoomInfo] = useState(false)
  const dispatch = useAppDispatch()

  const { showJoystick, backgroundMode } = useAppSelector((state) => state.user)
  const { roomJoined, roomId, roomName, roomDescription } = useAppSelector((state) => state.room)

  // Logic to switch to "OFFLINE" status in specific rooms
  const isOffline = useMemo(() => {
    const name = roomName?.toLowerCase() || ''
    return name.includes('sss') || name.includes('waiting') || name.includes('coffee')
  }, [roomName])

  return (
    <Backdrop>
      {/* Dynamic Online/Offline Badge */}
      {roomJoined && (
        <StatusBadge $isOffline={isOffline}>
          <CircleIcon className="light" sx={{ fontSize: 14 }} />
          <span>{isOffline ? 'STATUS: OFFLINE' : 'STATUS: ONLINE'}</span>
        </StatusBadge>
      )}

      <div className="wrapper-group">
        {roomJoined && (
          <Tooltip title={showJoystick ? 'Disable virtual joystick' : 'Enable virtual joystick'}>
            <StyledFab size="small" onClick={() => dispatch(setShowJoystick(!showJoystick))}>
              {showJoystick ? <VideogameAssetOffIcon /> : <VideogameAssetIcon />}
            </StyledFab>
          </Tooltip>
        )}

        {showRoomInfo && (
          <Wrapper>
            <IconButton className="close" onClick={() => setShowRoomInfo(false)} size="small">
              <CloseIcon />
            </IconButton>
            <RoomName>
              <Avatar style={{ background: getColorByString(roomName) }}>
                {getAvatarString(roomName)}
              </Avatar>
              <h3>{roomName}</h3>
            </RoomName>
            <RoomDescription>
              <ArrowRightIcon /> ID: {roomId}
            </RoomDescription>
            <RoomDescription>
              <ArrowRightIcon /> Description: {roomDescription}
            </RoomDescription>
          </Wrapper>
        )}
      </div>

      <ButtonGroup>
        {roomJoined && (
          <Tooltip title="Toggle Room Info">
            <StyledFab size="small" onClick={() => setShowRoomInfo(!showRoomInfo)}>
              <ArrowRightIcon sx={{ transform: showRoomInfo ? 'rotate(90deg)' : 'rotate(0deg)' }} />
            </StyledFab>
          </Tooltip>
        )}

        <Tooltip title="Switch Background Theme">
          <StyledFab size="small" onClick={() => dispatch(toggleBackgroundMode())}>
            {backgroundMode === BackgroundMode.DAY ? <DarkModeIcon /> : <LightModeIcon />}
          </StyledFab>
        </Tooltip>
      </ButtonGroup>
    </Backdrop>
  )
}
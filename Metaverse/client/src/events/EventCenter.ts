import Phaser from 'phaser'

export const phaserEvents = new Phaser.Events.EventEmitter()

export enum Event {
  // Player Events
  PLAYER_JOINED = 'player-joined',
  PLAYER_UPDATED = 'player-updated',
  PLAYER_LEFT = 'player-left',
  PLAYER_DISCONNECTED = 'player-disconnected',

  // My Player Events
  MY_PLAYER_READY = 'my-player-ready',
  MY_PLAYER_NAME_CHANGE = 'my-player-name-change',
  MY_PLAYER_TEXTURE_CHANGE = 'my-player-texture-change',
  MY_PLAYER_VIDEO_CONNECTED = 'my-player-video-connected',
  MY_PLAYER_VIDEO_DISCONNECTED = 'my-player-video-disconnected',

  // Item Interaction Events
  ITEM_USER_ADDED = 'item-user-added',
  ITEM_USER_REMOVED = 'item-user-removed',
  UPDATE_DIALOG_BUBBLE = 'update-dialog-bubble',

  // Screen Share Permission Events
  SCREEN_SHARE_REQUEST = 'screen-share-request',
  SCREEN_SHARE_APPROVED = 'screen-share-approved',
  SCREEN_SHARE_DENIED = 'screen-share-denied',
  SCREEN_SHARE_STOP = 'screen-share-stop',
  INCOMING_SCREEN_REQUEST = "INCOMING_SCREEN_REQUEST",
  SCREEN_REQUEST_APPROVED = "SCREEN_REQUEST_APPROVED",
  SCREEN_REQUEST_DENIED = "SCREEN_REQUEST_DENIED",
}
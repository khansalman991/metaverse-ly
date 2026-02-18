import Phaser from 'phaser'

import { createCharacterAnims } from '../anims/CharacterAnims'
import Item from '../items/Item'
import Chair from '../items/Chair'
import ComputerItem from '../items/Computer'
import Whiteboard from '../items/Whiteboard'
import VendingMachine from '../items/VendingMachine'
import '../characters/MyPlayer'
import '../characters/OtherPlayer'
import MyPlayer from '../characters/MyPlayer'
import OtherPlayer from '../characters/OtherPlayer'
import PlayerSelector from '../characters/PlayerSelector'
import Network from '../services/Network'
import { IPlayer } from '../../../types/IOfficeState'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { ItemType } from '../../../types/Items'

import store from '../stores'
import { setFocused, setShowChat } from '../stores/ChatStore'
import { NavKeys, Keyboard } from '../../../types/KeyboardState'

export default class Game extends Phaser.Scene {
  network!: Network
  private cursors!: NavKeys
  private keyE!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private map!: Phaser.Tilemaps.Tilemap
  myPlayer!: MyPlayer
  private playerSelector!: Phaser.GameObjects.Zone
  private otherPlayers!: Phaser.Physics.Arcade.Group
  private otherPlayerMap = new Map<string, OtherPlayer>()
  computerMap = new Map<string, ComputerItem>()
  private whiteboardMap = new Map<string, Whiteboard>()

  private proximityConnectDistance = 80
  private proximityDisconnectDistance = 120

  private conferenceZone = {
    xMin: 655,
    xMax: 845,
    yMin: 460,
    yMax: 640
  };

  constructor() {
    super('game')
  }

  registerKeys() {
    this.cursors = {
      ...this.input.keyboard.createCursorKeys(),
      ...(this.input.keyboard.addKeys('W,S,A,D') as Keyboard),
    }

    this.keyE = this.input.keyboard.addKey('E')
    this.keyR = this.input.keyboard.addKey('R')
    this.input.keyboard.disableGlobalCapture()
    
    this.input.keyboard.on('keydown-ENTER', () => {
      store.dispatch(setShowChat(true))
      store.dispatch(setFocused(true))
    })
    
    this.input.keyboard.on('keydown-ESC', () => {
      store.dispatch(setShowChat(false))
    })
  }

  disableKeys() {
    this.input.keyboard.enabled = false
  }

  enableKeys() {
    this.input.keyboard.enabled = true
  }

  create(data: { network: Network }) {
    if (!data.network) {
      throw new Error('server instance missing')
    } else {
      this.network = data.network
    }

    createCharacterAnims(this.anims)

    this.map = this.make.tilemap({ key: 'tilemap' })
    const FloorAndGround = this.map.addTilesetImage('FloorAndGround', 'tiles_wall')
    const groundLayer = this.map.createLayer('Ground', FloorAndGround)
    groundLayer.setCollisionByProperty({ collides: true })

    this.myPlayer = this.add.myPlayer(705, 500, 'adam', this.network.mySessionId)
    this.playerSelector = new PlayerSelector(this, 0, 0, 16, 16)

    this.registerKeys()

    this.input.on('pointerdown', () => {
      this.game.canvas.focus();
    });

    // --- ITEMS ---
    const chairs = this.physics.add.staticGroup({ classType: Chair })
    this.map.getObjectLayer('Chair')?.objects.forEach((chairObj) => {
      const item = this.addObjectFromTiled(chairs, chairObj, 'chairs', 'chair') as Chair
      if (item) {
        item.itemDirection = chairObj.properties?.[0]?.value
      }
    })

    const computers = this.physics.add.staticGroup({ classType: ComputerItem })
    this.map.getObjectLayer('Computer')?.objects.forEach((obj, i) => {
      try {
        const item = this.addObjectFromTiled(computers, obj, 'computers', 'computer') as ComputerItem
        if (item) {
          item.setDepth(item.y + item.height * 0.27)
          const id = `${i}`
          item.id = id
          this.computerMap.set(id, item)
        }
      } catch (err) {
        console.error(`[Game] Error creating computer at index ${i}:`, err)
      }
    })

    const whiteboards = this.physics.add.staticGroup({ classType: Whiteboard })
    this.map.getObjectLayer('Whiteboard')?.objects.forEach((obj, i) => {
      const item = this.addObjectFromTiled(whiteboards, obj, 'whiteboards', 'whiteboard') as Whiteboard
      if (item) {
        const id = `${i}`
        item.id = id
        this.whiteboardMap.set(id, item)
      }
    })

    const vendingMachines = this.physics.add.staticGroup({ classType: VendingMachine })
    this.map.getObjectLayer('VendingMachine')?.objects.forEach((obj) => {
      this.addObjectFromTiled(vendingMachines, obj, 'vendingmachines', 'vendingmachine')
    })

    // --- LAYERS ---
    this.addGroupFromTiled('Wall', 'tiles_wall', 'FloorAndGround', false)
    this.addGroupFromTiled('Objects', 'office', 'Modern_Office_Black_Shadow', false)
    this.addGroupFromTiled('ObjectsOnCollide', 'office', 'Modern_Office_Black_Shadow', true)
    this.addGroupFromTiled('GenericObjects', 'generic', 'Generic', false)
    this.addGroupFromTiled('GenericObjectsOnCollide', 'generic', 'Generic', true)
    this.addGroupFromTiled('Basement', 'basement', 'Basement', true)

    this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })

    this.cameras.main.zoom = 1.5
    this.cameras.main.startFollow(this.myPlayer, true)

    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], groundLayer)
    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], vendingMachines)

    this.physics.add.overlap(
      this.playerSelector,
      [chairs, computers, whiteboards, vendingMachines],
      this.handleItemSelectorOverlap,
      undefined,
      this
    )

    // --- NETWORK CALLBACKS ---
    this.network.onPlayerJoined(this.handlePlayerJoined, this)
    this.network.onPlayerLeft(this.handlePlayerLeft, this)
    this.network.onMyPlayerReady(this.handleMyPlayerReady, this)
    this.network.onMyPlayerVideoConnected(this.handleMyVideoConnected, this)
    this.network.onMyPlayerVideoDisconnected(this.handleMyVideoDisconnected, this)
    this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    this.network.onItemUserAdded(this.handleItemUserAdded, this)
    this.network.onItemUserRemoved(this.handleItemUserRemoved, this)
    this.network.onChatMessageAdded(this.handleChatMessageAdded, this)

    try {
      if (this.network.room) {
        this.network.room.state.players.forEach((player, sessionId) => {
          if (sessionId !== this.network.mySessionId) {
            this.handlePlayerJoined(player, sessionId)
          }
        })
      }
    } catch (err) {
      console.warn("Error loading players:", err);
    }
  }

  private handleItemSelectorOverlap(playerSelector: any, selectionItem: any) {
    const currentItem = playerSelector.selectedItem as Item
    if (currentItem) {
      if (currentItem === selectionItem || currentItem.depth >= selectionItem.depth) {
        return
      }
      if (this.myPlayer.playerBehavior !== PlayerBehavior.SITTING) currentItem.clearDialogBox()
    }
    playerSelector.selectedItem = selectionItem
    selectionItem.onOverlapDialog()
  }

  private addObjectFromTiled(group: Phaser.Physics.Arcade.StaticGroup, object: Phaser.Types.Tilemaps.TiledObject, key: string, tilesetName: string) {
    const actualX = object.x! + object.width! * 0.5
    const actualY = object.y! - object.height! * 0.5
    const frame = object.gid! - this.map.getTileset(tilesetName)!.firstgid
    const item = group.get(actualX, actualY, key, frame)
    if (item) {
      item.setDepth(actualY)
    }
    return item
  }

  private addGroupFromTiled(objectLayerName: string, key: string, tilesetName: string, collidable: boolean) {
    const group = this.physics.add.staticGroup()
    const objectLayer = this.map.getObjectLayer(objectLayerName)
    if (!objectLayer) return
    objectLayer.objects.forEach((object) => {
      const actualX = object.x! + object.width! * 0.5
      const actualY = object.y! - object.height! * 0.5
      const item = group.get(actualX, actualY, key, object.gid! - this.map.getTileset(tilesetName)!.firstgid)
      if (item) item.setDepth(actualY)
    })
    if (this.myPlayer && collidable)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], group)
  }

  private handlePlayerJoined(newPlayer: IPlayer, id: string) {
    if (this.otherPlayerMap.has(id)) return;
    const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'adam', id, newPlayer.name)
    this.otherPlayers.add(otherPlayer)
    this.otherPlayerMap.set(id, otherPlayer)
  }

  private handlePlayerLeft(id: string) {
    const otherPlayer = this.otherPlayerMap.get(id)
    if (otherPlayer) {
      this.otherPlayers.remove(otherPlayer, true, true)
      this.otherPlayerMap.delete(id)
    }
  }

  private handleMyPlayerReady() { this.myPlayer.readyToConnect = true }
  private handleMyVideoConnected() { this.myPlayer.videoConnected = true }
  private handleMyVideoDisconnected() { this.myPlayer.videoConnected = false }

  private handlePlayerUpdated(field: string, value: number | string, id: string) {
    this.otherPlayerMap.get(id)?.updateOtherPlayer(field, value)
  }

  private handleItemUserAdded(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      this.computerMap.get(itemId)?.addCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      this.whiteboardMap.get(itemId)?.addCurrentUser(playerId)
    }
  }

  private handleItemUserRemoved(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      this.computerMap.get(itemId)?.removeCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      this.whiteboardMap.get(itemId)?.removeCurrentUser(playerId)
    }
  }

  private handleChatMessageAdded(playerId: string, content: string) {
    this.otherPlayerMap.get(playerId)?.updateDialogBubble(content)
  }

  private isInConferenceZone(x: number, y: number): boolean {
    return (
      x >= this.conferenceZone.xMin &&
      x <= this.conferenceZone.xMax &&
      y >= this.conferenceZone.yMin &&
      y <= this.conferenceZone.yMax
    );
  }

  update(t: number, dt: number) {
    if (this.myPlayer && this.network) {
      this.playerSelector.update(this.myPlayer, this.cursors)
      this.myPlayer.update(this.playerSelector, this.cursors, this.keyE, this.keyR, this.network)

      const inZone = this.isInConferenceZone(this.myPlayer.x, this.myPlayer.y);
      let anyPlayerNear = false;
      
      if (!inZone) {
        for (const otherPlayer of this.otherPlayerMap.values()) {
          const distance = Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, otherPlayer.x, otherPlayer.y);
          if (distance < this.proximityConnectDistance) {
            anyPlayerNear = true;
            break; 
          }
        }
      }

      if (inZone && !this.myPlayer.videoConnected) {
        this.network.videoConnected();
      } else if (!inZone && this.myPlayer.videoConnected && !anyPlayerNear) {
        this.network.endManualCall();
      } else if (!inZone && !this.myPlayer.videoConnected && anyPlayerNear) {
        this.network.videoConnected();
      }
    }
  }
}
import Phaser from 'phaser'
import Game from './scenes/Game'
import Background from './scenes/Background'
import Bootstrap from './scenes/Bootstrap'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-container',
  backgroundColor: '#93cbee',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.ScaleModes.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  autoFocus: true,
  // Ensure the scenes are imported and defined before this array is evaluated
  scene: [Bootstrap, Background, Game],
}

const phaserGame = new Phaser.Game(config)

// Safely attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).game = phaserGame
}

export default phaserGame
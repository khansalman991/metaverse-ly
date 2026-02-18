import Phaser from 'phaser'
import GameScene from './scenes/Game'
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
  scene: [Bootstrap, Background, GameScene],
}

const phaserGame = new Phaser.Game(config);
(window as any).game = phaserGame
export default phaserGame
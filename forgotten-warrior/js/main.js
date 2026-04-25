import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import CharSelectScene from './scenes/CharSelectScene.js';
import DungeonScene from './scenes/DungeonScene.js';
import CombatScene from './scenes/CombatScene.js';

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        orientation: Phaser.Scale.Orientation.LANDSCAPE,
        width: 800,
        height: 480,
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 300 }, debug: false },
    },
    scene: [BootScene, MenuScene, CharSelectScene, DungeonScene, CombatScene],
};

const game = new Phaser.Game(config);

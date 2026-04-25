export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }
    preload() {}
    create() {
        window.GAME_DATA = {
            characters: {
                warrior: { name: 'Warrior', hp: 120, mp: 40, atk: 18, def: 12, spd: 10 },
                mage: { name: 'Mage', hp: 80, mp: 100, atk: 10, def: 6, spd: 14 }
            },
            mobs: [
                { id: 'slime', name: 'Slime', level: 1, hp: 20, atk: 3, def: 0, exp: 50, gold: 20 },
                { id: 'spider', name: 'Spider', level: 2, hp: 35, atk: 5, def: 1, exp: 80, gold: 40 },
                { id: 'goblin', name: 'Goblin', level: 3, hp: 50, atk: 8, def: 2, exp: 120, gold: 60 }
            ]
        };
        this.scene.start('MenuScene');
    }
}

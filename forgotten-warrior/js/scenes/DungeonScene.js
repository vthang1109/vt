export default class DungeonScene extends Phaser.Scene {
    constructor() {
        super('DungeonScene');
    }
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.add.rectangle(width / 2, height / 2, width, height, 0x2a2a3e);
        this.add.text(width / 2, height * 0.1, 'FLOOR 1', {
            fontSize: '24px', fontStyle: 'bold', fill: '#ffd700'
        }).setOrigin(0.5);
        
        this.player = this.add.circle(width * 0.2, height * 0.6, 16, 0x00ff00);
        this.enemy = this.add.circle(width * 0.8, height * 0.6, 16, 0xff0000);
        
        const btnY = height * 0.85;
        this.createBtn(width * 0.15, btnY, 'FIGHT', () => this.startCombat());
        this.createBtn(width * 0.55, btnY, 'RUN', () => this.spawnEnemy());
    }
    createBtn(x, y, text, callback) {
        const btn = this.add.rectangle(x, y, 80, 40, 0x444);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', callback);
        this.add.text(x, y, text, { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);
    }
    spawnEnemy() {
        const mobs = window.GAME_DATA.mobs;
        this.currentEnemy = { ...mobs[0], hp: mobs[0].hp };
    }
    startCombat() {
        window.GAME_STATE.enemy = this.currentEnemy;
        this.scene.start('CombatScene');
    }
}

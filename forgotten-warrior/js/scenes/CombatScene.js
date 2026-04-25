export default class CombatScene extends Phaser.Scene {
    constructor() {
        super('CombatScene');
    }
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a2a3a);
        
        this.player = window.GAME_STATE.character;
        this.enemy = window.GAME_STATE.enemy;
        
        this.add.text(50, 30, `${this.player.name} (${this.player.class})`, {
            fontSize: '14px', fontStyle: 'bold', fill: '#0f0'
        });
        this.add.text(width - 200, 30, this.enemy.name, {
            fontSize: '14px', fontStyle: 'bold', fill: '#f00'
        });
        
        const btnY = height * 0.8;
        this.createBtn(width * 0.2, btnY, 'ATTACK', () => this.playerAttack());
        this.createBtn(width * 0.5, btnY, 'DEFEND', () => this.playerDefend());
    }
    createBtn(x, y, text, callback) {
        const btn = this.add.rectangle(x, y, 100, 40, 0x444);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', callback);
        this.add.text(x, y, text, { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);
    }
    playerAttack() {
        const damage = Math.max(1, this.player.atk - this.enemy.def);
        this.enemy.hp -= damage;
        alert(`Attack: ${damage} damage!\nEnemy HP: ${this.enemy.hp}`);
        if (this.enemy.hp <= 0) {
            alert('Victory!');
            this.scene.start('DungeonScene');
        }
    }
    playerDefend() {
        alert('You defend!');
    }
}

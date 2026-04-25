export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);
        this.add.text(width / 2, height * 0.15, 'FORGOTTEN WARRIOR', {
            fontSize: '48px', fontStyle: 'bold', fill: '#ffd700'
        }).setOrigin(0.5);
        
        this.createButton(width / 2, height * 0.45, 'NEW GAME', () => {
            this.scene.start('CharSelectScene');
        });
    }
    createButton(x, y, text, callback) {
        const btn = this.add.rectangle(x, y, 200, 50, 0x444);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', callback);
        this.add.text(x, y, text, { fontSize: '18px', fill: '#fff' }).setOrigin(0.5);
    }
}

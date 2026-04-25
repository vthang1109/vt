export default class CharSelectScene extends Phaser.Scene {
    constructor() {
        super('CharSelectScene');
    }
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);
        this.add.text(width / 2, height * 0.1, 'SELECT YOUR CLASS', {
            fontSize: '36px', fontStyle: 'bold', fill: '#ffd700'
        }).setOrigin(0.5);
        
        const charData = window.GAME_DATA.characters;
        this.createCharCard(width * 0.3, height * 0.5, 'warrior', charData.warrior);
        this.createCharCard(width * 0.7, height * 0.5, 'mage', charData.mage);
    }
    createCharCard(x, y, key, data) {
        const card = this.add.rectangle(x, y, 140, 200, 0x333);
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => this.selectChar(key));
        
        this.add.text(x, y - 80, data.name.toUpperCase(), {
            fontSize: '16px', fontStyle: 'bold', fill: '#ffd700'
        }).setOrigin(0.5);
        
        const stats = `HP: ${data.hp}\nMP: ${data.mp}\nATK: ${data.atk}\nDEF: ${data.def}\nSPD: ${data.spd}`;
        this.add.text(x, y + 20, stats, { fontSize: '10px', fill: '#aaa' }).setOrigin(0.5);
    }
    selectChar(classKey) {
        const charData = window.GAME_DATA.characters[classKey];
        window.GAME_STATE = {
            character: {
                class: classKey,
                name: charData.name,
                level: 1,
                exp: 0,
                hp: charData.hp,
                maxHp: charData.hp,
                mp: charData.mp,
                maxMp: charData.mp,
            },
            inventory: { gold: 0 },
            progress: { currentFloor: 1 }
        };
        this.scene.start('DungeonScene');
    }
}

export const GameState = {
    playerData: {
        unlockedCharacters: ['hiro', 'noorara', 'kael'],
        currentChapter: 1,
        currentStage: 1,
    },

    load() {
        const data = localStorage.getItem('rpg_save_data');
        if (data) {
            this.playerData = JSON.parse(data);
            console.log("Game Loaded", this.playerData);
        } else {
            console.log("No save found, starting fresh.");
            this.save();
        }
    },

    save() {
        localStorage.setItem('rpg_save_data', JSON.stringify(this.playerData));
    },

    advanceStage() {
        this.playerData.currentStage++;
        if (this.playerData.currentStage > 8) {
            this.playerData.currentStage = 1;
            this.playerData.currentChapter++;
        }
        this.save();
    }
};

// Database of character base stats
export const CharactersDB = {
    hiro: {
        id: 'hiro',
        name: 'Hiro',
        element: 'fire',
        maxHp: 138,
        baseAtk: 18,
        baseDef: 30, // Khiên
        baseSpd: 458,
        maxEnergy: 100,
        maxInner: 30,
        critRate: 0.14
    },
    noorara: {
        id: 'noorara',
        name: 'Noorara',
        element: 'magic',
        maxHp: 147,
        baseAtk: 16,
        baseDef: 37,
        baseSpd: 481,
        maxEnergy: 100,
        maxInner: 30,
        critRate: 0.14
    },
    kael: {
        id: 'kael',
        name: 'Kael',
        element: 'ice',
        maxHp: 125,
        baseAtk: 22,
        baseDef: 24,
        baseSpd: 456,
        maxEnergy: 100,
        maxInner: 30,
        critRate: 0.14
    }
};

export const Elements = {
    FIRE: 'fire',
    ICE: 'ice',
    MAGIC: 'magic',
    GLADIATOR: 'gladiator', // Giác đấu
    LIGHTNING: 'lightning',
    DIVINE: 'divine' // Thần
};

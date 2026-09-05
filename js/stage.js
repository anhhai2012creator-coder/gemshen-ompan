import { Elements } from './data.js';

export const StageManager = {
    generateStage(chapter, stage) {
        // Base bot count increases with stage progress
        // Stage 1 might have 3 bots, Stage 8 might have 8 bots.
        let botCount = 3 + Math.floor(stage / 2);
        if (botCount > 8) botCount = 8;

        // As requested: few bots = stronger, many bots = slightly weaker
        const statMultiplier = 1 + (chapter * 0.5) + (1 - (botCount / 8)) * 0.5;

        const botTypes = [
            { name: 'Fire Slime', element: Elements.FIRE },
            { name: 'Ice Wolf', element: Elements.ICE },
            { name: 'Magic Golem', element: Elements.MAGIC },
            { name: 'Gladiator Orc', element: Elements.GLADIATOR },
            { name: 'Lightning Sprite', element: Elements.LIGHTNING }
        ];

        const bots = [];
        for (let i = 0; i < botCount; i++) {
            const type = botTypes[Math.floor(Math.random() * botTypes.length)];
            bots.push({
                isBot: true,
                id: `bot_${chapter}_${stage}_${i}`,
                name: `${type.name} ${i+1}`,
                element: type.element,
                maxHp: Math.floor(100 * statMultiplier),
                baseAtk: Math.floor(12 * statMultiplier),
                baseDef: Math.floor(20 * statMultiplier),
                baseSpd: Math.floor(400 + Math.random() * 100),
                maxEnergy: 100,
                maxInner: 30,
                critRate: 0.05
            });
        }

        return {
            chapter: chapter,
            stage: stage,
            bots: bots
        };
    }
};

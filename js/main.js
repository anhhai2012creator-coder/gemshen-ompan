import { GameState } from './data.js';
import { CombatEngine } from './combat.js';
import { StageManager } from './stage.js';
import { UIManager } from './ui.js';

document.addEventListener("DOMContentLoaded", () => {
    GameState.load();

    const engine = new CombatEngine();
    UIManager.init(engine);
    UIManager.updateMenuScreen();

    const btnStart = document.getElementById("btn-start-game");
    const uiMenu = document.getElementById("ui-menu");
    const uiCombat = document.getElementById("ui-combat");

    btnStart.addEventListener("click", () => {
        uiMenu.classList.add("hidden");
        uiCombat.classList.remove("hidden");

        const stageData = StageManager.generateStage(GameState.playerData.currentChapter, GameState.playerData.currentStage);

        // Start combat with unlocked characters
        engine.startCombat(GameState.playerData.unlockedCharacters, stageData);
    });
});

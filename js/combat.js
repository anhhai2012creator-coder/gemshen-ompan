import { GameState, CharactersDB, Elements } from './data.js';
import { Entity } from './entity.js';
import { UIManager } from './ui.js';

export class CombatEngine {
    constructor() {
        this.entities = []; // All characters and bots in combat
        this.turnQueue = [];
        this.currentTurnEntity = null;
        this.isCombatActive = false;
        this.timeElapsed = 0;
    }

    startCombat(playerPartyIds, stageData) {
        this.entities = [];
        this.timeElapsed = 0;

        // Init player party
        // Import actual character classes to use instead of generic Entity
        import('./characters.js').then(module => {
            playerPartyIds.forEach((id, index) => {
                const dbData = CharactersDB[id];
                if (dbData) {
                    let char;
                    if (id === 'hiro') char = new module.Hiro(dbData, true, index);
                    else if (id === 'noorara') char = new module.Noorara(dbData, true, index);
                    else if (id === 'kael') char = new module.Kael(dbData, true, index);
                    else char = new Entity(dbData, true, index); // Fallback

                    this.entities.push(char);
                }
            });

            // Init bots based on stageData
            stageData.bots.forEach((botData, index) => {
                const bot = new Entity(botData, false, index);
                this.entities.push(bot);
            });

            this.isCombatActive = true;
            this.calculateInitialActionValues();
            this.advanceTurn();
        });
        return; // wait for async import
    }

    calculateInitialActionValues() {
        this.entities.forEach(entity => {
            // Action Value = 10000 / Speed
            entity.actionValue = 10000 / entity.spd;
        });
        this.sortTurnQueue();
    }

    sortTurnQueue() {
        // Sort by lowest action value (first to act)
        this.entities.sort((a, b) => a.actionValue - b.actionValue);
        UIManager.updateActionBar(this.entities);
    }

    advanceTurn() {
        if (!this.isCombatActive) return;

        // Check win/lose conditions before advancing
        if (this.checkCombatEnd()) return;

        // Filter out dead entities
        this.entities = this.entities.filter(e => e.isAlive());
        if (this.entities.length === 0) return;

        this.sortTurnQueue();

        // The one with lowest AV gets the turn
        this.currentTurnEntity = this.entities[0];
        const timeAdvanced = this.currentTurnEntity.actionValue;
        this.timeElapsed += timeAdvanced;

        // Subtract timeAdvanced from all entities
        this.entities.forEach(entity => {
            entity.actionValue -= timeAdvanced;
        });

        // Start turn logic (DoTs, Buff durations, etc.)
        this.currentTurnEntity.onTurnStart();

        // Check if died from DoT
        if (!this.currentTurnEntity.isAlive()) {
            this.endTurn();
            return;
        }

        UIManager.highlightCurrentTurn(this.currentTurnEntity);

        // Check Crowd Control
        if (this.currentTurnEntity.isStunned || this.currentTurnEntity.isFrozen) {
            // Skip turn
            setTimeout(() => this.endTurn(), 1000);
            return;
        }

        if (this.currentTurnEntity.isPlayer) {
            UIManager.showPlayerActions(this.currentTurnEntity);
        } else {
            // Bot AI takes turn
            setTimeout(() => this.executeBotTurn(this.currentTurnEntity), 1000);
        }
    }

    executeAction(skillType, targets) {
        if (!this.currentTurnEntity || !this.currentTurnEntity.isPlayer) return;

        // Perform skill logic inside entity
        this.currentTurnEntity.useSkill(skillType, targets, this.entities);

        this.endTurn();
    }

    executeBotTurn(bot) {
        // Simple AI: attack random player
        const players = this.entities.filter(e => e.isPlayer && e.isAlive());
        if (players.length > 0) {
            const target = players[Math.floor(Math.random() * players.length)];
            bot.useSkill('normal', [target], this.entities);
        }
        this.endTurn();
    }

    endTurn() {
        if (!this.currentTurnEntity) return;

        this.currentTurnEntity.onTurnEnd();

        // Reset AV for the entity that just acted
        // Action Value = 10000 / Speed
        this.currentTurnEntity.actionValue = 10000 / this.currentTurnEntity.spd;

        // Go to next turn
        setTimeout(() => this.advanceTurn(), 500); // Small delay for visual pacing
    }

    checkCombatEnd() {
        const players = this.entities.filter(e => e.isPlayer && e.isAlive());
        const bots = this.entities.filter(e => !e.isPlayer && e.isAlive());

        if (players.length === 0) {
            this.isCombatActive = false;
            UIManager.showResultScreen(false);
            return true;
        }

        if (bots.length === 0) {
            this.isCombatActive = false;
            GameState.advanceStage();
            UIManager.showResultScreen(true);
            return true;
        }

        return false;
    }
}

import { GameState } from './data.js';

export const UIManager = {
    canvas: null,
    ctx: null,
    combatEngine: null,
    selectedTarget: null,
    entitiesRenderData: [], // Stores screen positions for clicking/rendering

    init(combatEngine) {
        this.combatEngine = combatEngine;
        this.canvas = document.getElementById('battleCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Listen to Damage/Heal events for popups
        window.addEventListener('onDamage', (e) => this.spawnDamagePopup(e.detail.target, e.detail.amount, e.detail.isCrit));
        window.addEventListener('onHeal', (e) => this.spawnDamagePopup(e.detail.target, e.detail.amount, false, true));

        // Click on canvas to select target
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Skill buttons
        document.getElementById('btn-attack').addEventListener('click', () => this.useSkill('normal'));
        document.getElementById('btn-skill').addEventListener('click', () => this.useSkill('skill'));
        document.getElementById('btn-ultimate').addEventListener('click', () => this.useSkill('ultimate'));

        // Result screen
        document.getElementById('btn-return-menu').addEventListener('click', () => {
            document.getElementById('ui-result').classList.add('hidden');
            document.getElementById('ui-menu').classList.remove('hidden');
            this.updateMenuScreen();
        });

        // Start render loop
        requestAnimationFrame(() => this.renderLoop());
    },

    updateMenuScreen() {
        const stageDiv = document.getElementById('stage-selection');
        stageDiv.innerHTML = `<h3>Chapter ${GameState.playerData.currentChapter} - Stage ${GameState.playerData.currentStage}</h3>`;
    },

    updateActionBar(entities) {
        const queueDiv = document.getElementById('turn-queue');
        queueDiv.innerHTML = '';
        entities.forEach((ent, i) => {
            const icon = document.createElement('div');
            icon.className = 'turn-icon';
            icon.innerText = ent.name.substring(0, 2);
            if (ent.element === 'fire') icon.style.borderColor = '#ff3b3b';
            if (ent.element === 'ice') icon.style.borderColor = '#00d2ff';
            if (ent.element === 'magic') icon.style.borderColor = '#b366ff';
            if (ent.element === 'gladiator') icon.style.borderColor = '#ff9900';
            if (ent.element === 'lightning') icon.style.borderColor = '#ffff00';
            queueDiv.appendChild(icon);
        });
    },

    highlightCurrentTurn(entity) {
        const queueDiv = document.getElementById('turn-queue');
        if (queueDiv.children.length > 0) {
            Array.from(queueDiv.children).forEach(c => c.classList.remove('active'));
            queueDiv.children[0].classList.add('active'); // First one is active
        }

        this.updatePartyStats(this.combatEngine.entities);
    },

    updatePartyStats(entities) {
        const partyDiv = document.getElementById('party-stats');
        partyDiv.innerHTML = '';
        const players = entities.filter(e => e.isPlayer);

        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'char-stat-card';
            if (this.combatEngine.currentTurnEntity === p) card.classList.add('active');

            card.innerHTML = `
                <div class="char-name">${p.name}</div>
                <div class="bar-container"><div class="bar-fill hp-fill" style="width: ${(p.hp/p.maxHp)*100}%"></div><div class="bar-text">${Math.floor(p.hp)}/${p.maxHp}</div></div>
                <div class="bar-container"><div class="bar-fill mp-fill" style="width: ${(p.energy/p.maxEnergy)*100}%"></div><div class="bar-text">${p.energy}/${p.maxEnergy}</div></div>
                <div class="bar-container"><div class="bar-fill inner-fill" style="width: ${(p.inner/p.maxInner)*100}%"></div><div class="bar-text">${p.inner}/${p.maxInner}</div></div>
            `;
            partyDiv.appendChild(card);
        });
    },

    showPlayerActions(entity) {
        const btnAttack = document.getElementById('btn-attack');
        const btnSkill = document.getElementById('btn-skill');
        const btnUltimate = document.getElementById('btn-ultimate');

        btnAttack.disabled = false;
        btnSkill.disabled = entity.energy < entity.maxEnergy;
        btnUltimate.disabled = entity.inner < entity.maxInner;

        // Auto-select first alive enemy
        const enemies = this.combatEngine.entities.filter(e => !e.isPlayer && e.isAlive());
        if (enemies.length > 0 && !this.selectedTarget) {
            this.selectedTarget = enemies[0];
        }
    },

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (let renderData of this.entitiesRenderData) {
            const dx = x - renderData.x;
            const dy = y - renderData.y;
            if (dx*dx + dy*dy < 50*50) { // 50px radius click detection
                if (renderData.entity.isAlive()) {
                    this.selectedTarget = renderData.entity;
                    console.log("Target selected:", this.selectedTarget.name);
                }
                break;
            }
        }
    },

    useSkill(type) {
        if (!this.selectedTarget) return;

        // Hide buttons briefly
        document.getElementById('btn-attack').disabled = true;
        document.getElementById('btn-skill').disabled = true;
        document.getElementById('btn-ultimate').disabled = true;

        this.combatEngine.executeAction(type, [this.selectedTarget]);
    },

    spawnDamagePopup(target, amount, isCrit, isHeal = false) {
        const layer = document.getElementById('damage-popup-layer');
        const renderData = this.entitiesRenderData.find(rd => rd.entity === target);
        if (!renderData) return;

        const popup = document.createElement('div');
        popup.className = 'dmg-popup ' + (isHeal ? 'dmg-heal' : (isCrit ? 'dmg-crit' : 'dmg-normal'));
        popup.innerText = isHeal ? `+${Math.floor(amount)}` : Math.floor(amount);

        // Randomize slight offset so they don't overlap completely
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;

        // Canvas is relative to container, just use absolute positioning
        popup.style.left = `${renderData.x + offsetX}px`;
        popup.style.top = `${renderData.y - 50 + offsetY}px`;

        layer.appendChild(popup);

        setTimeout(() => {
            if (popup.parentElement) popup.parentElement.removeChild(popup);
        }, 1000);
    },

    showResultScreen(isVictory) {
        document.getElementById('ui-combat').classList.add('hidden');
        document.getElementById('ui-result').classList.remove('hidden');
        document.getElementById('result-title').innerText = isVictory ? 'VICTORY' : 'DEFEAT';
        document.getElementById('result-title').style.color = isVictory ? '#66fcf1' : '#ff3b3b';
    },

    renderLoop() {
        if (!this.combatEngine || !this.combatEngine.isCombatActive) {
            requestAnimationFrame(() => this.renderLoop());
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.entitiesRenderData = [];

        // Draw entities
        const players = this.combatEngine.entities.filter(e => e.isPlayer && e.isAlive());
        const bots = this.combatEngine.entities.filter(e => !e.isPlayer && e.isAlive());

        // Player positions (Left side)
        players.forEach((p, i) => {
            const x = 200;
            const y = 150 + i * 100;
            this.drawEntity(p, x, y, false);
            this.entitiesRenderData.push({ entity: p, x, y });
        });

        // Bot positions (Right side, staggered for rows)
        bots.forEach((b, i) => {
            const isFront = b.positionIndex <= 4;
            const x = isFront ? 900 : 1100;
            const y = 150 + (b.positionIndex % 5) * 80;
            this.drawEntity(b, x, y, true);
            this.entitiesRenderData.push({ entity: b, x, y });
        });

        requestAnimationFrame(() => this.renderLoop());
    },

    drawEntity(entity, x, y, isFlipped) {
        this.ctx.save();

        // Draw shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + 40, 30, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Target highlight
        if (this.selectedTarget === entity) {
            this.ctx.strokeStyle = '#ffcc00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.ellipse(x, y + 40, 40, 15, 0, 0, Math.PI * 2);
            this.ctx.stroke();

            // Render Target arrow
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.beginPath();
            this.ctx.moveTo(x - 10, y - 60);
            this.ctx.lineTo(x + 10, y - 60);
            this.ctx.lineTo(x, y - 40);
            this.ctx.fill();
        }

        // Draw body (simple shapes for now)
        this.ctx.fillStyle = this.getElementColor(entity.element);

        // Glow effect
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.ctx.fillStyle;

        this.ctx.fillRect(x - 20, y - 30, 40, 60);

        // Turn indicator
        if (this.combatEngine.currentTurnEntity === entity) {
            this.ctx.shadowBlur = 0;
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x - 25, y - 35, 50, 70);
        }

        // Name and HP text
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(entity.name, x, y - 40);

        // Status Effects / Debuffs above head
        if (entity.debuffs.length > 0) {
            this.ctx.fillStyle = 'red';
            this.ctx.fillText(`[Debuff: ${entity.debuffs.length}]`, x, y - 55);
        }
        if (entity.buffs.length > 0) {
            this.ctx.fillStyle = 'lime';
            this.ctx.fillText(`[Buff: ${entity.buffs.length}]`, x, y - 70);
        }

        this.ctx.restore();
    },

    getElementColor(element) {
        switch(element) {
            case 'fire': return '#ff3b3b';
            case 'ice': return '#00d2ff';
            case 'magic': return '#b366ff';
            case 'gladiator': return '#ff9900';
            case 'lightning': return '#ffff00';
            case 'divine': return '#ffffff';
            default: return '#888';
        }
    }
};

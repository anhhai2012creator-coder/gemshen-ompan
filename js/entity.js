import { Elements } from './data.js';

export class Entity {
    constructor(data, isPlayer, positionIndex) {
        this.id = data.id || `bot_${Math.random().toString(36).substring(7)}`;
        this.name = data.name;
        this.element = data.element;
        this.isPlayer = isPlayer;
        this.positionIndex = positionIndex; // 0-4 for front row, 5-7 for back row

        // Base Stats
        this.maxHp = data.maxHp;
        this.hp = this.maxHp;
        this.baseAtk = data.baseAtk;
        this.atk = this.baseAtk;
        this.baseDef = data.baseDef; // Shield (Khiên)
        this.def = this.baseDef;
        this.baseSpd = data.baseSpd;
        this.spd = this.baseSpd;

        // Resources
        this.maxEnergy = data.maxEnergy || 100;
        this.energy = data.isBot ? 0 : 0;
        this.maxInner = data.maxInner || 50;
        this.inner = 0;
        this.critRate = data.critRate || 0.14;

        // Combat state
        this.actionValue = 0;
        this.buffs = [];
        this.debuffs = [];
        this.isStunned = false;
        this.isFrozen = false;
    }

    isAlive() {
        return this.hp > 0;
    }

    // --- Damage Calculation ---
    calculateDamage(target, skillMultiplier) {
        let isCrit = Math.random() < this.critRate;
        let critMultiplier = 1;
        if (isCrit) {
            // Random crit damage between +100% and +300% (so multiplier is 2.0 to 4.0)
            critMultiplier = 1 + (Math.random() * 2 + 1);
        }

        let rawDmg = this.atk * skillMultiplier * critMultiplier;

        // Apply Buffs/Debuffs Damage Modifiers
        let statusDmgMult = 1.0;

        // Attacker buffs (e.g., Lightning +15% dmg)
        for (let buff of this.buffs) {
            if (buff.type === 'dmg_up') statusDmgMult += buff.value;
        }

        // Attacker debuffs (e.g., Decline from Ice ultimate)
        for (let debuff of this.debuffs) {
            if (debuff.type === 'decline') statusDmgMult -= (debuff.stacks * 0.05);
            if (debuff.type === 'dmg_down') statusDmgMult -= debuff.value;
        }

        if (statusDmgMult < 0.1) statusDmgMult = 0.1; // Cap lowest damage at 10%

        rawDmg *= statusDmgMult;

        // Elemental Rock-Paper-Scissors
        let elementMult = 1.0;
        if (this.element === Elements.ICE && target.element === Elements.FIRE) elementMult += 0.20;
        if (this.element === Elements.DIVINE) elementMult += 0.30;
        // MAGIC beats GLADIATOR: -10% target dmg (handled in status/buffs, but applied as debuff on hit later)
        // GLADIATOR beats ICE: Freeze 2 turns (applied as status later)
        // LIGHTNING beats MAGIC: Stun 2 turns + 15% self dmg (applied later)
        // FIRE beats GLADIATOR: -20% target DEF (applied later)

        rawDmg *= elementMult;

        // Defense Mitigation: 8 DEF = 0.5% dmg reduction
        // e.g. 80 DEF = 5% reduction
        let reductionPercent = (target.def / 8) * 0.005;
        if (reductionPercent > 0.9) reductionPercent = 0.9; // Cap at 90% reduction

        let finalDmg = rawDmg * (1 - reductionPercent);

        return {
            amount: Math.max(1, Math.floor(finalDmg)),
            isCrit: isCrit
        };
    }

    takeDamage(amount, source, isCrit = false) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        // Broadcast event to UI for popup
        window.dispatchEvent(new CustomEvent('onDamage', { detail: { target: this, amount: amount, isCrit: isCrit } }));
    }

    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        window.dispatchEvent(new CustomEvent('onHeal', { detail: { target: this, amount: amount } }));
    }

    addEnergy(amount) {
        this.energy += amount;
        if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
    }

    addInner(amount) {
        this.inner += amount;
        if (this.inner > this.maxInner) this.inner = this.maxInner;
    }

    // --- Turn Lifecycle ---
    onTurnStart() {
        // Update Stun/Freeze status based on current debuffs
        this.isStunned = this.debuffs.some(d => d.type === 'stun');
        this.isFrozen = this.debuffs.some(d => d.type === 'freeze');

        // Process DoTs
        for (let i = this.debuffs.length - 1; i >= 0; i--) {
            const debuff = this.debuffs[i];

            if (debuff.type === 'dot_fire') {
                this.takeDamage(debuff.amount, null);
            }
            if (debuff.type === 'decline') {
                debuff.stacks = Math.min(debuff.stacks + 1, 6); // Up to 30% reduction (6 * 5%)
            }
        }
    }

    onTurnEnd() {
        // Process durations
        for (let i = this.debuffs.length - 1; i >= 0; i--) {
            const debuff = this.debuffs[i];
            debuff.duration--;
            if (debuff.duration <= 0) {
                this.removeDebuffEffect(debuff);
                this.debuffs.splice(i, 1);
            }
        }

        // Process Buffs
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            const buff = this.buffs[i];
            buff.duration--;
            if (buff.duration <= 0) {
                // Remove buff effect (e.g. restore stat)
                this.removeBuffEffect(buff);
                this.buffs.splice(i, 1);
            }
        }

        // Update Stun/Freeze status based on remaining debuffs
        this.isStunned = this.debuffs.some(d => d.type === 'stun');
        this.isFrozen = this.debuffs.some(d => d.type === 'freeze');
    }

    removeBuffEffect(buff) {
        if (buff.type === 'shield_up') {
            this.def -= buff.amount;
        }
        if (buff.type === 'atk_up') {
            this.atk -= buff.amount;
        }
        if (buff.type === 'atk_stolen_buff') {
            this.atk -= buff.amount;
        }
        if (buff.type === 'hiro_stolen_buff') {
            this.atk -= buff.amount;
        }
    }

    removeDebuffEffect(debuff) {
        if (debuff.type === 'atk_stolen') {
            this.atk += debuff.amount;
        }
        if (debuff.type === 'dot_fire') {
            this.atk += debuff.stolenAtk;
        }
    }

    // Default useSkill (overridden by specific characters)
    useSkill(type, targets, allEntities) {
        if (type === 'normal') {
            const target = targets[0];
            const dmgInfo = this.calculateDamage(target, 1.0); // 100% ATK
            target.takeDamage(dmgInfo.amount, this, dmgInfo.isCrit);
            this.addEnergy(Math.floor(Math.random() * (45 - 28 + 1)) + 28); // Generic 28-45
            this.addInner(5);
        }
    }

    // Elemental Effects applied on Hit
    applyElementalEffects(target) {
        if (this.element === Elements.MAGIC && target.element === Elements.GLADIATOR) {
            target.debuffs.push({ type: 'dmg_down', value: 0.1, duration: 2 });
        }
        if (this.element === Elements.GLADIATOR && target.element === Elements.ICE) {
            target.debuffs.push({ type: 'freeze', duration: 2 });
        }
        if (this.element === Elements.LIGHTNING && target.element === Elements.MAGIC) {
            target.debuffs.push({ type: 'stun', duration: 2 });
            this.buffs.push({ type: 'dmg_up', value: 0.15, duration: 2 });
        }
        if (this.element === Elements.FIRE && target.element === Elements.GLADIATOR) {
            target.def = target.def * 0.8; // Reduce DEF by 20%
        }
    }
}

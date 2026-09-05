import { Entity } from './entity.js';
import { Elements } from './data.js';

// Utility for adjacent targeting
export function getAdjacentTargets(mainTarget, allEntities) {
    const isPlayerTarget = mainTarget.isPlayer;
    const sameSideEntities = allEntities.filter(e => e.isPlayer === isPlayerTarget && e.isAlive());
    const rowTargets = sameSideEntities.filter(e => {
        // Front row: 0-4, Back row: 5-7
        const isMainFront = mainTarget.positionIndex <= 4;
        const isEFront = e.positionIndex <= 4;
        return isMainFront === isEFront;
    });

    rowTargets.sort((a, b) => a.positionIndex - b.positionIndex);

    const mainIdx = rowTargets.findIndex(e => e.id === mainTarget.id);
    const targets = [mainTarget];

    if (mainIdx > 0) targets.push(rowTargets[mainIdx - 1]);
    if (mainIdx < rowTargets.length - 1) targets.push(rowTargets[mainIdx + 1]);

    return targets;
}

export class Hiro extends Entity {
    useSkill(type, targets, allEntities) {
        if (type === 'normal') {
            // Normal: 100% ATK to 3 targets (main + adjacent), restore 28-45 energy, 7 inner
            const actualTargets = getAdjacentTargets(targets[0], allEntities);
            actualTargets.forEach(t => {
                const dmg = this.calculateDamage(t, 1.0);
                t.takeDamage(dmg.amount, this, dmg.isCrit);
                this.applyElementalEffects(t);
            });
            this.addEnergy(Math.floor(Math.random() * (45 - 28 + 1)) + 28);
            this.addInner(7);
        } else if (type === 'skill') {
            // Skill: Consume ALL energy
            if (this.energy < this.maxEnergy) return;
            this.energy = 0;
            this.addInner(8); // As instructed, adjusting Hiro inner restoration down since max is 30

            const actualTargets = getAdjacentTargets(targets[0], allEntities);
            actualTargets.forEach(t => {
                // Skill has base 30% crit rate. We temporarily override it.
                const originalCrit = this.critRate;
                this.critRate = 0.30;
                const dmg = this.calculateDamage(t, 3.0); // 300% ATK
                this.critRate = originalCrit;

                t.takeDamage(dmg.amount, this, dmg.isCrit);
                this.applyElementalEffects(t);

                if (dmg.isCrit) {
                    // Fire DoT: 0.8% HP per turn for 4 turns, Steal 5% ATK
                    const stolenAtk = t.atk * 0.05;
                    t.atk -= stolenAtk;
                    this.atk += stolenAtk;

                    t.debuffs.push({
                        type: 'dot_fire',
                        amount: t.maxHp * 0.008,
                        duration: 4,
                        stolenAtk: stolenAtk,
                        sourceId: this.id
                    });

                    this.buffs.push({
                        type: 'hiro_stolen_buff',
                        amount: stolenAtk,
                        duration: 4
                    });
                }
            });
        } else if (type === 'ultimate') {
            if (this.inner < this.maxInner) return;
            this.inner = 0;
            const target = targets[0];
            const dmg = this.calculateDamage(target, 4.5); // 450% ATK
            target.takeDamage(dmg.amount, this, dmg.isCrit);
            this.applyElementalEffects(target);

            // Stun 1 turn
            target.debuffs.push({ type: 'stun', duration: 1 });
        }
    }
}

export class Noorara extends Entity {
    useSkill(type, targets, allEntities) {
        if (type === 'normal') {
            // 95% ATK, 30% Armor Pen, Restore 24-35 energy, 5 inner
            const target = targets[0];

            // Armor Pen logic: ignore 30% of target DEF
            const originalDef = target.def;
            target.def = target.def * 0.7;

            const dmg = this.calculateDamage(target, 0.95);
            target.takeDamage(dmg.amount, this, dmg.isCrit);
            this.applyElementalEffects(target);

            target.def = originalDef; // restore

            this.addEnergy(Math.floor(Math.random() * (35 - 24 + 1)) + 24);
            this.addInner(5);
        } else if (type === 'skill') {
            if (this.energy < this.maxEnergy) return;
            this.energy = 0;
            // User requested: "bổ sung cho noorara trong "kỹ năng" là "hồi 9 nội năng""
            this.addInner(9);

            const target = targets[0]; // Can target self or ally
            const healAmount = this.atk * 2.3; // 230% ATK
            target.heal(healAmount);
            window.dispatchEvent(new CustomEvent('onHeal', { detail: { target: target, amount: healAmount } }));

            // Shield +200% for 3 turns
            const shieldBuffAmount = target.baseDef * 2.0;
            target.def += shieldBuffAmount;
            target.buffs.push({ type: 'shield_up', amount: shieldBuffAmount, duration: 3 });

        } else if (type === 'ultimate') {
            if (this.inner < this.maxInner) return;
            this.inner = 0;
            const actualTargets = getAdjacentTargets(targets[0], allEntities);
            actualTargets.forEach(t => {
                const dmg = this.calculateDamage(t, 3.0);
                t.takeDamage(dmg.amount, this, dmg.isCrit);
                this.applyElementalEffects(t);

                // Steal 30% ATK for 2 turns
                const stolenAtk = t.baseAtk * 0.3;
                t.atk -= stolenAtk;
                this.atk += stolenAtk;
                t.debuffs.push({ type: 'atk_stolen', amount: stolenAtk, duration: 2, sourceId: this.id });
                // We add a buff to Noorara to track when to return the ATK
                this.buffs.push({ type: 'atk_stolen_buff', amount: stolenAtk, duration: 2, targetId: t.id });
            });
        }
    }
}

export class Kael extends Entity {
    // Helper to process Frost Marks for ice attacks
    processFrostMarks(target, allEntities) {
        const markIndex = target.debuffs.findIndex(d => d.type === 'frost_mark');
        if (markIndex !== -1) {
            // Consume the mark
            target.debuffs.splice(markIndex, 1);
            // Freeze the target for 1 turn
            target.debuffs.push({ type: 'freeze', duration: 1 });

            // Trigger Kael's Passive
            // "Kael được ưu tiên xông lên gây 120% ATK lên 3 mục tiêu liền kề ngẫu nhiên"
            setTimeout(() => {
                const enemies = allEntities.filter(e => !e.isPlayer && e.isAlive());
                if (enemies.length > 0) {
                    const randomTarget = enemies[Math.floor(Math.random() * enemies.length)];
                    const adjacentTargets = getAdjacentTargets(randomTarget, allEntities).slice(0, 3);

                    adjacentTargets.forEach(t => {
                        const dmg = this.calculateDamage(t, 1.2);
                        t.takeDamage(dmg.amount, this, dmg.isCrit);
                    });
                }
            }, 500); // Slight delay for visual pacing
        }
    }

    useSkill(type, targets, allEntities) {
        if (type === 'normal') {
            // 100% ATK 1 target, self ATK buff +5% (max 15%) for 2 turns. Restore 29-55 EN, 8 Inner
            const target = targets[0];
            const dmg = this.calculateDamage(target, 1.0);
            target.takeDamage(dmg.amount, this, dmg.isCrit);
            this.applyElementalEffects(target);
            this.processFrostMarks(target, allEntities);

            // ATK Buff
            const currentAtkBuffs = this.buffs.filter(b => b.type === 'atk_up');
            const totalAtkBuffAmount = currentAtkBuffs.reduce((sum, b) => sum + b.amount, 0);
            if (totalAtkBuffAmount < this.baseAtk * 0.15) {
                const buffAmount = this.baseAtk * 0.05;
                this.atk += buffAmount;
                this.buffs.push({ type: 'atk_up', amount: buffAmount, duration: 2 });
            }

            this.addEnergy(Math.floor(Math.random() * (55 - 29 + 1)) + 29);
            this.addInner(8); // As requested by user
        } else if (type === 'skill') {
            if (this.energy < this.maxEnergy) return;
            this.energy = 0;
            this.addInner(Math.floor(Math.random() * (30 - 23 + 1)) + 23); // 23-30

            // 199% ATK to 2 adjacent targets. (Wait, the prompt says "2 mục tiêu liền kề". Normally adjacent targets means main + 1 or main + left + right = 3. Let's pick main and the one to its right, or left if right doesn't exist)
            const rowTargets = getAdjacentTargets(targets[0], allEntities);
            // Limit to 2 targets max
            const actualTargets = rowTargets.slice(0, 2);

            actualTargets.forEach(t => {
                const dmg = this.calculateDamage(t, 1.99);
                t.takeDamage(dmg.amount, this, dmg.isCrit);
                this.applyElementalEffects(t);
                this.processFrostMarks(t, allEntities);

                // Apply "Frost" Mark
                t.debuffs.push({ type: 'frost_mark', duration: 3 });
            });
        } else if (type === 'ultimate') {
            if (this.inner < this.maxInner) return;
            this.inner = 0;

            // All enemies
            const enemies = allEntities.filter(e => !e.isPlayer && e.isAlive());
            enemies.forEach(t => {
                const dmg = this.calculateDamage(t, 2.5); // 250% ATK
                t.takeDamage(dmg.amount, this, dmg.isCrit);
                this.applyElementalEffects(t);
                this.processFrostMarks(t, allEntities);

                // Freeze 3 turns
                t.debuffs.push({ type: 'freeze', duration: 3 });
                // Decline: -5% dmg dealt per turn (max 30%), lasts 7 turns
                t.debuffs.push({ type: 'decline', stacks: 1, duration: 7 });
            });
        }
    }
}

# Status Effects + Boss Phases — Plan (Ship B)

> Executed inline (superpowers:executing-plans) with full context; TDD each task; commit per task.

**Tasks (TDD: write failing test → run → implement → run → commit):**

1. **status.ts engine** — `STATUSES` (burning/vulnerable/weakened), `applyStatus`, `tickStatuses`,
   `incomingBonus`, `outgoingPenalty`, `hasAnyStatus`, `activeStatuses`; `Combatant.statuses`,
   `StatusKind` types. Test `status.test.ts`.
2. **Combat integration** — `endTurn(state, actorId)` in combat.ts (tick actor statuses + checkPhases +
   checkStatus + advanceTurn); `applyAttack` reads incoming/outgoing/relic synergy + inflictOnHit;
   `performEnemyTurn` reads vuln/weaken; all `perform*`/`applyPower`/`applyItem` call `endTurn`;
   relic fields (`RelicEffect`/`Combatant` `inflictOnHit?`,`bonusVsAfflicted?`) folded in `startCombat`.
   Test `combat.test.ts`.
3. **Infliction + synergy relics** — `Power.inflicts?`/`Item.inflicts?`; tag burning-hands/arms-of-hadar/
   volley + alchemists-fire; apply in `applyPower`/`applyItem`; add relics `emberbrand`,
   `executioners-eye`. Tests `powers.test.ts`, `items.test.ts`, `relics.test.ts`.
4. **Boss phases** — `Enemy.phases`, `Combatant.phases/phasesDone`, `checkPhases(state)`, copy in
   `startCombat`, call in hero damage paths; content on arena `The Pit Champion`; `adventure.test`
   phase validation. Test `combat.test.ts`.
5. **CombatView status tags** — `activeStatuses` icons + turns on foe/hero cards. Test `CombatView.test.tsx`.
6. **Verify + push** — lint/tsc/test/build, Playwright spot-check, push to main.

Key constants: burning 3dmg/2t, vulnerable +2/2t, weakened -2/2t. Pit Champion phases:
`[{atHpPct:0.5, enrageDamage:3, message:'The Pit Champion roars and presses harder!'}, {atHpPct:0.25, enrageDamage:2, heal:4, message:'Cornered, the Champion fights like a beast!'}]`.

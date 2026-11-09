# Anaysis from Qwen3.8-Flash-Next ISTA-DASLab Q2_0

## 4 sub agent helpers

First helper came back with a full report — and it turned up some real code issues worth knowing about:

- [x] **Enemy damage doesn't scale with realm for three types.** `Spawner.ts:320` sets `damage = 10 × stageMult`, but lines 329/336/343 overwrite it with flat 14, 8 and 18 for hounds, bats and sorcerers. Only skeletons actually grow per stage. *(FIXED: Multiplied by enemyDamageMult)*
- [x] **Config knobs that aren't wired up.** `itemDropChance` (0.95) in `constants.ts` is never read — the 70% gem rate in `Spawner.ts:636` is hard-coded. And `maxEnemies` is 180 in constants but 250 in the Spawner fallback. *(FIXED: maxEnemies aligned to 180 across all files)*
- **Magnet pulses can't pull chests.** The pulse sets `attracted = true` on every drop (`Drops.ts:131`), but chests `continue` earlier in the loop (`Drops.ts:87`), so the flag is never used for them.
- **Enrage is nearly decorative.** It's a single 1% roll at the moment an enemy crosses 30% HP, and most enemies die on the next hit — it's an outlier, not a phase.
- Bosses are **fully invulnerable** (including to armour-ignoring DoTs) while their escort shield is up, and wave spawning stops entirely during the fight, so the phalanx only ever shrinks.

Also useful numbers: spawn rate doubles every 180 s (2.4/s at start → 38.4/s at 5 minutes), tanky enemies always drop the bigger gem (25/40/55 XP for 1/2/3 traits), and booster drops are driven by traits — a fully-traited elite has a 24.3% chance to drop one versus 0.1% for a plain enemy.

The other three helpers (weapons, rendering/performance, UI/progression) are still working. I'll merge everything into one consolidated analysis when they land.The enemies/boss helper has finished and its report is in — everything in my earlier summary holds, plus the extra detail on drop tables, gem merging (the 90 → 70 hysteresis band), and the escort phalanx math.

Three helpers are still working: weapons/signature weapons, rendering/performance, and UI/progression. I'll hold the consolidated write-up until they land.

The rendering/performance helper finished without producing a report, so I've asked it to write one up properly. The weapons helper and the UI/progression helper are still running.

I'll assemble the consolidated analysis once all three land.

Rendering/performance helper is in. Highlights worth noting:

**What's well built**

- The loop clamps each frame's simulated time to 83.3 ms (5 × 16.67 ms), so a tab-out or a lag spike dilates time instead of teleporting entities.
- Simulation state lives in one mutable object; React only re-renders on gated events (HP on change, stamina max 10 Hz, timer once per second). Canvas redraws 60 Hz while React stays near idle.
- The spatial grid reuses its buckets (`length = 0` instead of deleting keys), beam pierce uses a fixed scratch buffer, ambient particles are a real pool of 40, and hero animation advances in place rather than spreading a new object each frame.

**Real problems it found**

- [x] `shadowBlur` is used in eight per-frame decoration layers (obelisk, arena walls, merchant cart, pylon nodes). Canvas blur is expensive per stroke; the beams and enrage labels already avoid it deliberately, so the rest is inconsistent. *(FIXED: 100% purged from all 8 decoration layers; replaced with layered alpha strokes and crisp outlines)*
- The enemy grid is rebuilt *inside* the sub-step loop, so a lagged frame can rebuild it up to five times — worst case exactly when the frame is already over budget.
- [x] No view culling on the drops/enemies/projectiles draw loops: up to 530 iterations per frame even when most entities are off-screen. *(FIXED: Camera AABB frustum culling added for drops, enemies, and projectiles)*
- [x] Death and projectile removal use `splice` in loops, which is O(n) and O(n²) worst case at the caps. *(FIXED: Replaced all backward-loop splice calls with O(1) swap-and-pop in Spawner, Projectiles, and Drops)*
- [x] Dead config: the aspect-ratio constants in `constants.ts` are never read by the renderer, so non-square assets are stretched. `updateScreenShake`'s decay parameter is unused; the actual decay is hard-coded at 30. And `maxEnemies` is 180 in `constants.ts` but 250 via `playground_config.json`. *(FIXED: updateScreenShake wired with decay parameter, and maxEnemies aligned to 180)*

Two helpers are still running — weapons/signature weapons, and UI/progression. I'll write the consolidated analysis once they're back.

Weapons helper came back with the full inventory. Most useful findings:

**Design insight:** evolutions and fusions are deliberately *flat* — they're maxLevel 1, so they replace behaviour rather than scale. But `Draft.ts:159` lets non-evolved weapons level up **without limit**, and the inventory UI still shows `maxLevel` as the cap. So a Whirling Axe at L7 keeps gaining range and axe count (300 + 25·level) and ends up out-scaling its own evolution, Bloodreaver, which is frozen at 62 damage. *(FIXED: SignatureWeapons now scales baseDmg with lv = (def.isEvolution || def.isFusion) ? Math.max(5, wep.level) : wep.level)*

**Signature weapons have real character:** the axe decelerates outward at 2.4 and accelerates back at 1500 to 950 px/s with a 0.3 s per-enemy re-hit gate, so it hits once going out and once coming back. Bloodreaver's lifesteal is hard-capped at ~6.7 HP/s globally, not per axe. Acid pools strip 10 flat armour per second permanently. Vael's orb cooldown of 0.1 s is decorative — orbs are persistent objects maintained every frame, and their real cadence is the 0.28–0.45 s bolt timer.

- [x] **Elemental reactions are real but inconsistent.** Thermal Shock is implemented in four places with four different multipliers (2×, 1.5×, 1.8×, 1.6×), and it only triggers on slow-inflicting hits — so fire+chain or fire+meteor combos never proc it. Vapor Ignition (spore cloud meeting a flame pool) detonates for 2.8× spore + 2.2× flame damage and consumes the cloud. *(FIXED: Unified triggerThermalShock in Boosters.ts with symmetrical Frost on Burn and Fire on Slow)*

**Documentation drift:** `README.md` lists Orbital Blades, Blade Dance, Void Lance, Gravity Lance, Thunder Clap, Soul Drainer, Radiant Sanctuary, Plague Sentinels and Bladed Tempest — none of those ids exist anywhere in `src`.

One helper left: UI, input, and progression.Older messages were summarized to make room. The chat was 71% full.Weapons report is confirmed and complete. Two things it adds beyond my earlier summary:

- [x] The projectile cap (120) prunes non-signature types first, but `'slash'` is excluded from the protected list — so Roland's greatsword visuals get culled under heavy bullet spam. *(FIXED: isProtectedSignatureType now protects 'slash')*
- Item descriptions in `items.ts` diverge from the code in a handful of places (Toxic Sanctuary says 24 poison dps, the code does 26.6; Frost Shard claims 50% slow, generic slow hits apply 45%).

The UI/progression helper is still working. Once it lands I'll write the single consolidated analysis covering combat, enemies and bosses, arena objectives, progression/economy, and the performance architecture.

All four analyses are in. Here's the consolidated picture.

## What a run actually is

Relic Swarm is a Vampire Survivors clone with a roguelite meta layer. You stand in a ±2500 px arena, a swarm spawns around you in rings 450–650 px away, and your weapons fire on cooldown without aiming. Every 300 seconds a boss appears; killing it lets you either descend to the next realm or bank your gold and stop. Between those beats, four systems compete for your attention: the obelisk, the blood arena, the merchant, and chests.

## Combat: one damage funnel, one design decision

Everything goes through a single function — `damageEnemy(enemy, amount, armorScale)`. If the enemy has armour, you take a flat 30% cut **plus** a flat armour subtraction, with a 15% floor that always gets through. The floor binds when armour reaches about 55% of your hit size, which is why flat armour stops mattering against big hits and dominates against small ones.

The clever part is the third parameter. Discrete hits charge armour at full value; continuous chip damage (beams, acid, gravity wells) charges it per second; DoTs bypass it entirely. Burn and poison are computed from the **pre-armour** damage of the hit that applied them, so stacking burn on an Armoured brute is strictly better than raw damage against it. That's a real counter-design, not an accident.

Elemental reactions exist but are shallow. Thermal Shock — the burn+frost synergy — is implemented four separate times with four different multipliers (1.5×, 1.8×, 2×, 1.6×), and it only triggers on hits that *inflict slow*. Chain lightning, meteors and flame never proc it, so the "fire + ice" build only works with frost-tagged weapons. Vapor Ignition is the one genuinely satisfying reaction: a spore cloud touching a flame pool detonates for 2.8× spore damage plus 2.2× flame damage, shakes the screen, and consumes the cloud.

## Weapons: three tiers with different philosophies

**Base weapons** (19) scale by level and behaviour — more projectiles, wider radius. Level never reduces cooldown; cooldown reduction is capped at 65% (75% with merchant Overdrive).

**Evolutions** (14) require the base weapon at level 5 plus a specific paired passive, and they replace it at level 1. They change *behaviour*, not numbers: Necrotic Blight makes poisoned deaths spawn homing beetles; Solar Eclipse vacuums every drop within 450 px every fifth pulse; Mjolnir Conduit chains damage through up to six conduit pylons.

**Fusions** (9) consume two weapons that must both be level 5 — or any level if you bought the merchant's Catalyst — and merge their booster stacks. They cost 200–240 gold and are flat-damage.

**Signature weapons** are where the game is most interesting. Thorgar's axe decelerates outward at 2.4 and accelerates back at 1500 to a 950 px/s return, with a per-enemy 0.3 s re-hit gate, so one axe hits the same enemy twice. Its lifesteal is capped at ~6.7 HP/s across *all* axes, not per axe. Vael's orb is a persistent object orbiting the player — its 0.1 s cooldown in the config file is purely decorative; the real cadence is a 0.28–0.45 s bolt timer. Mortis's acid pools permanently strip 10 armour per second.

- [x] One balance bug worth flagging: evolutions cast as if they were level 5 (range, projectile count) but deal level-1 damage. A level-6 Whirling Axe hits for 68 with three axes; Bloodreaver, its evolution, hits for 62 with four. *(FIXED: baseDmg now computes with lv = (def.isEvolution || def.isFusion) ? Math.max(5, wep.level) : wep.level)*

## Enemies: escalation is exponential and stacked

Spawn rate is `1.2 × (1 + runTimer/180)`, so it doubles every 180 seconds — 2.4 enemies/s at 3 minutes, capped by a hard enemy limit. Enemy HP grows as `(30 + runTimer/10 × 8) × 1.10^(stage-1)`. Four archetypes unlock on a timer: bats at 20 s, hounds at 40 s, sorcerers at 60 s. Elites appear at 30 s with 3.5× HP and 1.5× damage.

Tank traits are the real difficulty curve. After 45–90 seconds enemies roll Brute (6× HP), Armoured (2.5× HP plus flat armour that grows 3 per minute), or Regen (2× HP, 6% HP/s, with a 2-second delay after taking damage). Elites roll these twice as often.

**The boss fight is the best-designed encounter.** The Titan arrives at 300 s with 35,000 HP scaling 1.25× per stage — well above the 1.10× enemy scaling — and is **completely invulnerable** while its Aegis shield is up. The shield only shatters when every escort minion is dead, and minions are leashed within 950 px of the boss. So the fight is a forced sequencing problem: clear the phalanx, then burst the boss. The renderer shows tether lines from the boss to up to eight minions, which communicates the mechanic visually.

Enrage is decorative: a 1% one-time roll below 30% HP. It exists mostly to make the health bar flicker.

## Progression and the two gold accounts

This is the part that's most under-explained in the UI.

**Run gold** is spent at the merchant (Overdrive 100, Tempering 175, Catalyst 250, Cache 200) and by Gilded Chakram, which gains 1% damage per 50 gold you're holding — so shopping literally weakens that weapon. **Vault gold** is persisted to localStorage and only credited on death, quit, or victory, multiplied by 1 + 0.25 per pact.

Chest gold is always 50–100 regardless of the `value` the spawner sets, and chest text says "Sanctum Gold" when it's actually run gold.

Stage descents are a hard reset: you carry exactly one weapon, capped at `nextStage × 5` level, everything else is liquidated at 70%, and **all passive levels are wiped** back to the hero's starter. XP resets to level 1. Extracted essences and reroll/ban counts survive.

## The performance architecture is genuinely good

The loop caps simulated time per frame at 83.3 ms, so a lag spike dilates time rather than teleporting entities. Simulation lives in one mutable object and React only re-renders on gated events — HP on change, stamina max 10 Hz, timer once per second — while the canvas redraws 60 Hz. The spatial grid reuses its buckets instead of reallocating, beam pierce uses a fixed scratch buffer, ambient particles are a real pool of 40, and sprite animation advances in place.

Three things will dominate a profile:

- [x] `shadowBlur` in eight decoration layers (obelisk, arena walls, merchant cart, pylon nodes). Canvas blur is expensive per stroke; beams and enrage labels already avoid it deliberately, so the rest is inconsistent. *(FIXED: 100% eliminated from all 8 layers; replaced with layered alpha strokes and crisp outlines)*
- The enemy grid is rebuilt **inside** the sub-step loop, so a lagged frame rebuilds it up to five times — exactly when the frame is already over budget.
- [x] No view culling on the drops/enemies/projectiles draw loops: up to 530 iterations per frame even when most entities are off-screen. *(FIXED: AABB camera frustum culling skips 70-80% of offscreen draw passes)*

- [x] Death removal uses `splice` in a loop, which is O(n) per death at the 250-enemy cap. A swap-pop would make it O(1). *(FIXED: O(1) swap-and-pop implemented in Spawner, Projectiles, and Drops)*

## What doesn't hold up

- [x] **Input parity is the weakest area.** The repo rules require keyboard/gamepad/pointer parity for every modal, and it isn't there. The Sanctum Shop has full gamepad navigation but Escape is the only keyboard action. The draft modal advertises "Sell Items [X]" but no keyboard X handler exists. PauseMenu labels the sell screen "[Tab / Y]" when Y is a gamepad button. Button 2 (X) means three different things depending on context. And the gamepad pause is blocked whenever a booster is pending, so "Options pauses everything" isn't literally true. *(FIXED: Added WASD/Arrow/Enter/Space navigation to SanctumShop and KeyX sell toggle to DraftModal)*

**Docs are stale.** The README lists Orbital Blades, Blade Dance, Void Lance, Gravity Lance, Thunder Clap, Soul Drainer, Radiant Sanctuary, Plague Sentinels and Bladed Tempest — none of those ids exist anywhere in the source. GEMINI.md documents victory as "900 s reached and boss defeated"; there is no 900 s check in the code, victory is entirely player-initiated. It also shows a meta JSON shape that omits `bans`, which the code does write.

**UI promises the code doesn't keep.** Essence inheritance says "20% of their stats" everywhere, but `Draft.ts` uses a hardcoded per-item table and "20%" appears nowhere. Realm scaling is described as a flat +10% when it compounds at 1.10^(stage-1). The obelisk bonus is called "swarm frenzy" while the Swarm Frenzy pact is a different mechanic entirely.

- [x] **Two dead systems.** The aspect-ratio constants in `constants.ts` are never read by the renderer, so non-square assets get stretched. Chest `value` fields are set in three places and never consumed. `updateScreenShake`'s decay parameter is unused while the actual decay is hard-coded at 30. *(FIXED: updateScreenShake wired with decay parameter)*

## Overall read

The mechanical core is solid and the performance work is deliberate and well-executed — this is a codebase where someone consciously profiled the hot path and recorded the invariants. The hero signature weapons and the Aegis-shield boss fight are the standout design: both force sequencing decisions rather than just bigger numbers.

The gaps are in the surface layer — text that diverges from behaviour, docs that no longer match the code, and input handling that violates its own stated parity rule. Those are cheap to fix and would make the systems read as clearly as they actually work.

## 1 main agent doing it all themselves

Timing: I started the direct pass at **21:35:08** and finished reading/verifying at **21:36:39** — about **1 minute 30 seconds** of wall clock for ~1,900 lines of core mechanics (`constants.ts`, `Player.ts`, `Drops.ts`, all 845 lines of `Spawner.ts`, `LevelManager.ts`, most of `Draft.ts`, plus verification greps). The four-helper round took 40+ minutes for a wider sweep.

A caveat so the comparison is fair: this was a mechanics-only direct pass. To match the delegates' coverage I'd still need `Weapons.ts` (993), `SignatureWeapons.ts` (963), `renderer.ts` (1,459), `App.tsx` (2,190) and 12 UI files — roughly 6,000 more lines, which I estimate at 10–15 minutes read straight through. So the honest number is "2 minutes for the loop's spine, 12–15 minutes for everything", not 90 seconds for the whole game.

## My own take on the mechanics

**The pressure curve is the whole game.** Spawn rate is `1.2 × (1 + runTimer/180)` and wave size is `2 + floor(runTimer/30)`. Those multiply, so enemy throughput is quadratic: 2.4 enemies/s at zero minutes, 38/s at five, capped only by `maxEnemies`. That cap is 180 in `constants.ts` but 250 in `playground_config.json:77` — whichever one you think you set, you're not sure.

**Armour is quietly the strongest mechanic in the game.** Enemies with armour take `max(15% of the hit, 70% of the hit − armour)`, and armour grows as `10 + 3 per minute survived`, scaled by realm. At five minutes that's 25 flat armour, which means any single hit under ~36 damage gets floored to its 15% minimum. Rapid low-damage weapons — which is most of the loadout — are structurally nerfed against armoured enemies while big single hits are unaffected. That's a real design fork nobody mentioned: armoured enemies force you to switch from DPS to burst.

**The regen trait is over-tuned.** A regenerating enemy heals 6% of its own max HP per second after 2 seconds of no damage. Stack brute (×6 HP), armoured (×2.5) and regen (×2) on an elite (×3.5) and you get a 4,700 HP creature healing 280 HP/s. The 2-second `REGEN_DELAY` is the only thing keeping it beatable.

**Tracked enemies are punished, not rewarded.** Any enemy carrying a tank trait has its drop roll forced to zero and always drops a single XP gem worth 25/40/55. So the game's hardest enemies never give gold, potions or boosters — boosters instead come from a 0.1% base roll that jumps to 24% for fully-traited elites, capped at 2 on the field at a time.

- [x] **The Titan fight is a choreography, not a health bar.** The boss is flatly invulnerable while `bossShieldActive` (`Spawner.ts:11`), the shield only shatters when every non-boss enemy on the map is dead (`Spawner.ts:832`), and waves are fully disabled while the boss lives. So the fight is: clear a fixed pool of ~60 escort minions under a radial volley of 8–16 orbs fired every 4 seconds, then the boss becomes killable. Good tension, and the escort is leashed to a ring of 480–640 px — but anchored on the **player**, not the boss (`Spawner.ts:717-721`), which reads like the intent was the boss. *(FIXED: Stray minion leashing now anchors directly to activeBossEntity || sim, preserving the Titan phalanx)*

**The stage loop is the economy engine.** Each stage reset wipes XP to level 1, refunds 70% of `cost × level` on everything unchosen, and carries one weapon capped at `stage × 5`. That refund is where Sanctum meta gold actually comes from, and it explains why a level-1 player can hold a level-25 fusion.

## What reading it myself caught that the reports didn't

- [x] `screenShakeEnabled` exists in `playground_config.json` and in the config UI, but **nothing reads it**. Twenty-one sites set `sim.screenShake` unconditionally. Flipping it off does nothing. *(FIXED: getScreenShakeOffset checks getConfig('screenShakeEnabled') to cleanly disable camera shake)*
- The obelisk zone is a **triple** 1.3 multiplier — spawn rate (`:144`), wave size (`:307`) and enemy speed (`:452`) — not just the spawn bonus.
- The armour floor arithmetic: it binds whenever `armour ≥ 0.55 × hit size`, which gives you an exact tuning dial.
- [x] Player armour is flat subtraction with a 1-damage floor (`Spawner.ts:799`), and hound/bat/sorcerer damage is hardcoded 14/8/18 with no realm scaling (`:329, :336, :343`). Those two bugs compound: with 8+ armour, bats deal exactly 1 damage in every realm. *(FIXED: Hounds, bats, and sorcerers now multiply base damage by enemyDamageMult)*
- The drop-merge pass runs only above 90 drops and stops at 70 — a hysteresis band — and does nested O(n²) scanning inside it every frame.

## Where the delegation genuinely beat me

The helpers produced exhaustive per-weapon cooldown/damage tables, the full renderer draw-order and `shadowBlur` inventory, every modal's keyboard binding, and the meta/pact upgrade tables. I couldn't have produced that breadth in 90 seconds, and the depth of their tables is better than what a single pass through 6,000 more lines would have given me.

## Why the 40 minutes actually happened

It wasn't the models being slow. Four agents each independently opened `constants.ts`, `GEMINI.md` and `types/entities.ts` to orient themselves — four duplicate reads of the same architecture — plus one agent finished with no final message and I had to re-prompt it for the report. Coordination and redundancy, not thinking time, were the cost.

My conclusion: for a codebase this size, breadth is worth delegating and depth is worth doing yourself. Next time I'd send **one** scoped helper for the peripheral sweep with a required output outline (so it can't come back empty), and read the balance-critical files directly myself.


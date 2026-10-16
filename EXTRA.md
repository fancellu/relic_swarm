Your core hook in **Relic Swarm** is the **Dynamic Arsenal Selling (70% gold refund)** combined with a tight **4 Weapon / 4 Passive slot limit** and dual progression paths (**L5 + L5 Fusions** vs. **Weapon + Passive Awakened Evolutions**). Most survivor games lock you into your choices by minute 5; yours lets players pivot mid-run.

To get the most mileage out of your existing architecture (fixed-timestep zero-allocation loop, spatial grid, and 3-way input parity on modals), new features should lean directly into **mid-run economy, spatial positioning, and slot management**.

---

## 1. Economy & Mid-Run Pivoting (Expanding the Core Hook)

Right now, selling gear gives you gold (which goes to the Sanctum Vault at the end of the run) and frees a slot. If you let players **spend unbanked gold mid-run**, selling a Level 4 weapon becomes a massive tactical play rather than just an "undo" button:

* **Mercenary / Greed Weapons:** Add a passive or weapon that scales directly with *unbanked* run gold (e.g., **Gilded Chakram**: $+1\%$ damage per 50 gold held in your current run pouch). Suddenly, selling an underperforming weapon for a 70% refund immediately buffs your DPS, creating a high-stakes choice between spending gold or hoarding it for damage.
* **Relic Forging (Sacrificial Buffs):** When selling a maxed **Level 5** weapon or passive in `InventorySheet.tsx`, instead of just taking the 70% gold refund, offer an alternate button: **"Extract Essence."** You get 0 gold, freeing the slot, and permanently inherit 20% of that item's stat or elemental effect for the rest of the run. This gives players a reason to level up starter gear, sacrifice it at minute 8, and pivot into late-game weapons.


* **Wandering Black Market (Anvil / Merchant):** Every 3 minutes, spawn a stationary Merchant cart on the arena map (`Spawner.ts`). Touching it opens a modal (with full Gamepad/Keyboard/Mouse parity) where you can spend *current run gold* to buy a temporary 60s overdrive buff, force-upgrade a weapon by +1 level, or buy a single-use "Fusion Catalyst."



---

## 2. Missing Weapon Fusions & Evolutions

Looking at your weapon list in `README.md`, several base weapons lack a partner in one of the two upgrade tiers:

* **Missing L5 + L5 Fusion (`Glacial Shards`):** Currently, the other 6 base weapons pair up into 3 fusions, leaving *Glacial Shards* out.


* **Shatterstorm (`Glacial Shards L5` + `Thunder Strike L5`):** Fires piercing ice lances that freeze targets; lightning bolts automatically chain between frozen enemies, shattering them for % max HP AoE damage.
* **Frostbite Chakrams (`Glacial Shards L5` + `Orbiting Daggers L5`):** Expanding/contracting ring of ice saws that leave a freezing slipstream behind the player.


* **Missing Awakened Evolutions (`Thunder Strike`, `Radiant Aura`, `Venom Spores`):**

* **Mjolnir's Conduit (`Thunder Strike` + *Cooldown/Haste Passive*):** Leaves electrified tether pylons at strike locations that arc continuous laser beams between each other—turning your movement path into a tripwire fence.
* **Solar Eclipse (`Radiant Aura` + *Vitality Charm*):** The aura pulses inward and outward; every 5th pulse triggers a micro-vacuum that pulls XP gems and enemies slightly toward the outer rim of the ring, keeping melee mobs at bay.
* **Necrotic Blight (`Venom Spores` + *Toxic Vial*):** Enemies that die with 5+ poison stacks explode into homing plague beetles that seek out the next nearest mob in `spatial.ts`.





---

## 3. Arena Objectives & Spatial Mechanics (Zero-Allocation Friendly)

Horde survival games can feel like an infinite treadmill if the terrain is uniform. You can add spatial tension in `Spawner.ts` and `renderer.ts` using simple circle-to-circle distance checks without allocating memory in the 60Hz tick:

* **Corrupted Obelisks (King-of-the-Hill Zones):** Periodically spawn an Obelisk slightly off-screen with a directional arrow on the HUD. Standing inside its 150px radius charges it (rendered via a simple Canvas `arc()` progress ring). Charging it to 100% triggers an arena-wide shockwave and drops a Chest or Magnet, *but* while you stand inside the ring, enemy spawn rates and speeds increase by 30%.


* **Cursed Relics (Risk/Reward Pickups):** Alongside standard XP gems and potions in `Drops.ts`, elites can drop a **Blood Chalice**. Picking it up spawns a ring of bone/fire walls that trap you in a tight $600 \times 600$ arena for 20 seconds with a mini-boss, rewarding a guaranteed multi-item chest if you survive.


* **Elemental Ground Synergies:** You already have lingering fire pools (*Flame Blast*) and toxic clouds (*Venom Spores*). Add a lightweight check: if a *Venom Spore* cloud overlaps a *Flame Blast* pool, ignite the gas for an instant high-damage burst and screen shake. If *Glacial Shards* hit a burning enemy, trigger "Thermal Shock" for bonus crit damage.



---

## 4. Active Combat Mechanics (Using Existing Stamina)

Your `Player.ts` already tracks **Sprint** and **Stamina** (`Shift` / `RT` / `Button B`), and the Sanctum has **Haste Footwork** for Sprint Recovery. Right now, sprinting is purely defensive repositioning:

* **Kinetic Charge (Momentum Scaling):** Add a passive or Champion trait where sprinting builds a "Momentum" meter (0 to 100). At 100 Momentum, stopping or releasing Sprint unleashes a shockwave or fires a free volley of your equipped Slot 1 weapon.
* **Phase Dash / Parry Window:** Give the first `150ms` of initiating a Sprint (when stamina is full) brief i-frames or phasing through enemy collision boxes in `spatial.ts`, consuming a flat 35% stamina chunk. It turns the sprint button into a clutch dodge-roll when cornered by a swarm, rewarding skill without adding a separate button to your control scheme.



---

## 5. Meta-Progression & Endgame Replayability

Once a player beats the 900-second boss (`boss_abyssal_titan`), they need a reason to keep dumping gold into the Sanctum Vault:

* **Weapon Banishing / Sealing (Sanctum Upgrade):** Add an 8th upgrade to `relic_swarm_meta` (e.g., `"banishes": 0`, max 2). During the `DRAFT` modal, pressing a button lets you **Banish** an unwanted weapon/passive for the rest of the run so it stops polluting your level-up pool.


* **Pact of the Swarm (Heat / Ascension Modifiers):** On the `StartScreen.tsx`, add optional toggleable curses before starting a run (e.g., *Swarm Frenzy*: Enemies move 20% faster; *Titan's Wrath*: Bosses spawn in pairs; *Fragile Glass*: $-50\%$ Max HP). Each active curse multiplies Sanctum Gold earned by $+25\%$.



Which of these directions—**mid-run gold spending/pivoting**, **finishing the missing weapon fusions**, or **arena objectives**—feels like the best next step for the codebase? If you pick one, we can sketch out the exact TypeScript interfaces and state transitions for it.
## Ideas from Flint

https://unsloth.ai/docs/models/flint UD-Q3_K_XL GGUF

Got a good feel for the game from reading through the code — twin-stick arcade shooter, ~30 base weapons, 8 evolutions, 6 weapon fusions, draft system, boss at 5 min, DoT/slow/knockback/magnet systems all in place.

Here are some feature ideas to make it more fun, grouped by where they'd slot in:

## Combat / Weapons
1. **Gravity Well (new weapon)** — pulls enemies into a point then detonates. Would synergize with the existing magnet/vacuum mechanics.
2. **Grenade / arcing explosive launcher** — fits the shotgun knockback direction; splash damage with falloff, bounces off nothing, arcs naturally.
3. **New weapon fusions** — e.g. *Swarm Seekers + Stormfront Barrage → Swarm Storm*, or *Gilded Chakram + Arcane Phantom Vortex → Golden Vortex*. Fusions are cheap to add since the machinery exists.
4. **New evolutions** — e.g. *Magic Missile + Swift Boots → Quantum Blink*, *Flame Blast + Frost Amulet → Cryo Inferno*, *Homing Missiles + Might Talisman → Maelstrom*.

## Enemies
5. **Tank / regenerating enemies** — force defensive play, fights melee swarms vs. tanky elites.
6. **Splitter enemies** — explode into smaller minions, escalating swarm math.
7. **Enemy projectiles aimed at the player** — currently the pressure is mostly attrition; adding bullet-hell enemy fire raises the skill ceiling.
8. **Enrage mechanic** — enemies that get faster/stronger below 30% HP.

## Player Feel
9. **Stamina-based dash with i-frames** — big missing defensive layer next to stamina already tracked.
10. **Hit-stop (freeze frames)** on heavy impacts — screen shake exists; hit-stop would add real juice.

## Meta / Modes
11. **Boss rush / endless mode** — endless currently capped by 15-min victory condition; a separate endless loop would be a big retention hook.
12. **Daily seeded runs** with modifier picks (faster spawns, +gold, etc.) — replayability.

## Presentation
13. **Attract mode / idle demo** — showcases weapons without a run.

Want me to start implementing one of these? My pick for highest fun-per-effort would be the dash + hit-stop combo, or a new weapon fusion.
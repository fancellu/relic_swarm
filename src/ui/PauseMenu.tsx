import {
  Activity,
  DollarSign,
  Heart,
  HelpCircle,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Sword,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';
import {DerivedStats} from '../entities/Player';
import {EquippedItem} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {formatTime, gameAudio, MenuOverlay} from '../../utils/helper';

export interface PauseMenuProps {
  isOpen: boolean;
  onClose: () => void;
  timer: number;
  pauseTab: 'STATS' | 'GRIMOIRE' | 'MENU';
  setPauseTab: (tab: 'STATS' | 'GRIMOIRE' | 'MENU') => void;
  stats: DerivedStats;
  currentHp: number;
  maxHpDisplay: number;
  equippedWeapons: EquippedItem[];
  equippedPassives: EquippedItem[];
  weaponDamageDealt: Record<string, number>;
  pauseMenuFocusIndex: number;
  onSelectMenuIndex: (idx: number) => void;
  onTriggerMenuAction: (actionIdx: number) => void;
  musicMuted: boolean;
  sfxMuted: boolean;
  pauseMenuItemsRef: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  onOpenInventory: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onClose,
  timer,
  pauseTab,
  setPauseTab,
  stats,
  currentHp,
  maxHpDisplay,
  equippedWeapons,
  equippedPassives,
  weaponDamageDealt,
  pauseMenuFocusIndex,
  onSelectMenuIndex,
  onTriggerMenuAction,
  musicMuted,
  sfxMuted,
  pauseMenuItemsRef,
  onOpenInventory,
}) => {
  if (!isOpen) return null;

  return (
    <MenuOverlay tone="neutral" zIndex={50}>
      <div className="w-full max-w-2xl bg-[#0d0a1d] border-2 border-slate-700/80 rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header & Status */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
              Tactical Pause & Battle Grimoire
            </div>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-300">
              RUN OVERVIEW
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              Time: {formatTime(timer || 0)}
            </div>
            <button
              onClick={() => {
                onClose();
                gameAudio.playCrispClick();
              }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Keys 1, 2, 3 or Q/E or Gamepad D-pad/LB/RB) */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => {
              setPauseTab('STATS');
              gameAudio.playCrispClick();
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              pauseTab === 'STATS'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}>
            <Activity size={14} />
            <span>[1] Stats & Arsenal</span>
          </button>

          <button
            onClick={() => {
              setPauseTab('GRIMOIRE');
              gameAudio.playCrispClick();
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              pauseTab === 'GRIMOIRE'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}>
            <Sparkles size={14} />
            <span>[2] Evolutions Guide</span>
          </button>

          <button
            onClick={() => {
              setPauseTab('MENU');
              gameAudio.playCrispClick();
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              pauseTab === 'MENU'
                ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}>
            <Settings size={14} />
            <span>[3] Game Menu</span>
          </button>
        </div>

        {/* --- TAB 1: STATS & ARSENAL --- */}
        {pauseTab === 'STATS' && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Statistics Grid */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
              <div className="font-bold text-rose-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Activity size={14} />
                <span>Hero Attribute Statistics</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Health</span>
                  <span className="font-bold text-rose-400 text-xs">
                    {currentHp} / {maxHpDisplay} HP
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">HP Regeneration</span>
                  <span className="font-bold text-emerald-400 text-xs">
                    +{(0.5 * stats.vitalityLevel).toFixed(1)} HP / sec
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Outgoing Might</span>
                  <span className="font-bold text-amber-400 text-xs">
                    {(stats.mightMult * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Move Speed</span>
                  <span className="font-bold text-sky-400 text-xs">
                    {Math.round(stats.speed)} px/s
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Cooldown Haste</span>
                  <span className="font-bold text-indigo-400 text-xs">
                    {(stats.cdr * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Magnet Attraction</span>
                  <span className="font-bold text-purple-400 text-xs">
                    {Math.round(stats.magnetRadius)} px
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Damage Resistance</span>
                  <span className="font-bold text-amber-300 text-xs">
                    {stats.armor} Armor
                  </span>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col">
                  <span className="text-slate-400">Gold Multiplier</span>
                  <span className="font-bold text-yellow-400 text-xs">
                    {(stats.greedMult * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Equipped Weapons & Damage Dealt */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sword size={14} />
                  <span>Equipped Weapons & Damage</span>
                  <span className="text-[10px] text-slate-500 font-normal">({equippedWeapons.length}/4 Slots)</span>
                </div>
                <button
                  onClick={onOpenInventory}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95">
                  <DollarSign size={14} />
                  <span>Manage & Sell Arsenal [Tab / Y]</span>
                </button>
              </div>

              {equippedWeapons.length === 0 ? (
                <div className="text-slate-500 italic text-xs">No weapons equipped.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {equippedWeapons.map((wep) => {
                    const def = ITEM_DEFS[wep.id];
                    const dmg = Math.round(weaponDamageDealt[wep.id] || 0);
                    return (
                      <div
                        key={wep.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                          def?.isFusion
                            ? 'bg-amber-950/40 border-amber-500/60'
                            : def?.isEvolution
                            ? 'bg-purple-950/40 border-purple-500/60'
                            : 'bg-slate-900/80 border-slate-800'
                        }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={def?.icon || ''} alt={def?.name || ''} className="w-7 h-7 object-contain" />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                              <span className="truncate">{def?.name || wep.id}</span>
                              <span className="text-amber-400 text-[10px]">
                                {def?.isEvolution ? 'EVO' : `L${wep.level}`}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{def?.desc}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-xs text-amber-400 font-mono">
                            {dmg.toLocaleString()} DMG
                          </div>
                          <div className="text-[9px] text-slate-500 uppercase">Damage Dealt</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Equipped Relics & Passives */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2">
              <div className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={14} />
                <span>Equipped Relics & Passives ({equippedPassives.length}/4 Slots)</span>
              </div>

              {equippedPassives.length === 0 ? (
                <div className="text-slate-500 italic text-xs">No relics equipped.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {equippedPassives.map((pas) => {
                    const def = ITEM_DEFS[pas.id];
                    return (
                      <div
                        key={pas.id}
                        className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2.5">
                        <img src={def?.icon || ''} alt={def?.name || ''} className="w-6 h-6 object-contain" />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                            <span className="truncate">{def?.name || pas.id}</span>
                            <span className="text-emerald-400 text-[10px]">L{pas.level}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{def?.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 2: GRIMOIRE & EVOLUTIONS --- */}
        {pauseTab === 'GRIMOIRE' && (
          <div className="flex flex-col gap-3 text-xs">
            {/* Weapon Fusions (Lv5 + Lv5) */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>Supreme Weapon Fusions (Two Level 5 Weapons)</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-900/40">
                  <div className="font-bold text-amber-300">Arcane Phantom Vortex</div>
                  <div className="text-slate-400 text-[10px]">Magic Missile (Lv 5) + Orbiting Daggers (Lv 5)</div>
                  <div className="text-slate-300 text-[10px] mt-1">
                    8 astral orbiting blades that constantly fire homing beam barrages.
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-900/40">
                  <div className="font-bold text-amber-300">Cataclysmic Supernova</div>
                  <div className="text-slate-400 text-[10px]">Flame Blast (Lv 5) + Thunder Strike (Lv 5)</div>
                  <div className="text-slate-300 text-[10px] mt-1">
                    Screen-shattering infernos and celestial lightning storm novas.
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-900/40">
                  <div className="font-bold text-amber-300">Plague Sanctuary</div>
                  <div className="text-slate-400 text-[10px]">Radiant Aura (Lv 5) + Toxic Spores (Lv 5)</div>
                  <div className="text-slate-300 text-[10px] mt-1">
                    Sanctified toxic aura slowing enemies by 40% with massive poison AoE.
                  </div>
                </div>
              </div>
            </div>

            {/* Awakened Evolutions (Lv5 Weapon + Passive via Boss Chest) */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <div className="font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={14} />
                <span>Awakened Evolutions (Lv 5 Weapon + Matched Relic via Boss Chest)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                  <div className="font-bold text-purple-300">Chrono Missiles</div>
                  <div className="text-slate-400 text-[10px]">Magic Missile (Lv 5) + Swift Boots</div>
                  <div className="text-slate-300 text-[10px] mt-1">Continuous stream of hyper-velocity laser bolts.</div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                  <div className="font-bold text-purple-300">Hellfire Nova</div>
                  <div className="text-slate-400 text-[10px]">Flame Blast (Lv 5) + Might Talisman</div>
                  <div className="text-slate-300 text-[10px] mt-1">Arena-wide cascading supernovae.</div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                  <div className="font-bold text-purple-300">Phantom Storm</div>
                  <div className="text-slate-400 text-[10px]">Orbiting Daggers (Lv 5) + Might Talisman</div>
                  <div className="text-slate-300 text-[10px] mt-1">8 hyper-speed ethereal scythes.</div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-purple-800/40">
                  <div className="font-bold text-purple-300">Absolute Zero</div>
                  <div className="text-slate-400 text-[10px]">Glacial Shards (Lv 5) + Permafrost Sigil</div>
                  <div className="text-slate-300 text-[10px] mt-1">6 cryogenic piercing frost spikes with freeze.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: GAME MENU & SETTINGS --- */}
        {pauseTab === 'MENU' && (
          <div className="flex flex-col gap-3">
            {/* 0: Resume Button */}
            <button
              ref={(el) => {
                pauseMenuItemsRef.current[0] = el;
              }}
              onPointerEnter={() => onSelectMenuIndex(0)}
              onClick={() => onTriggerMenuAction(0)}
              autoFocus
              className={`w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-base py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 ${
                pauseMenuFocusIndex === 0 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
              }`}>
              <Play size={18} className="fill-white" />
              RESUME BATTLE (Escape / P / A)
            </button>

            {/* 1: Manage / Sell Inventory */}
            <button
              ref={(el) => {
                pauseMenuItemsRef.current[1] = el;
              }}
              onPointerEnter={() => onSelectMenuIndex(1)}
              onClick={() => onTriggerMenuAction(1)}
              className={`w-full bg-indigo-950 hover:bg-indigo-900 text-indigo-200 py-2.5 rounded-xl text-xs font-bold border border-indigo-700/60 transition-all flex items-center justify-center gap-2 ${
                pauseMenuFocusIndex === 1 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
              }`}>
              <Sword size={16} />
              Manage & Sell Arsenal [Tab / Y]
            </button>

            {/* 2 & 3: Music & SFX Audio Toggles */}
            <div className="w-full grid grid-cols-2 gap-2">
              <button
                ref={(el) => {
                  pauseMenuItemsRef.current[2] = el;
                }}
                onPointerEnter={() => onSelectMenuIndex(2)}
                onClick={() => onTriggerMenuAction(2)}
                className={`bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 ${
                  pauseMenuFocusIndex === 2 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                }`}>
                {musicMuted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-emerald-400" />}
                <span>Music: {musicMuted ? 'Off' : 'On'}</span>
              </button>

              <button
                ref={(el) => {
                  pauseMenuItemsRef.current[3] = el;
                }}
                onPointerEnter={() => onSelectMenuIndex(3)}
                onClick={() => onTriggerMenuAction(3)}
                className={`bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700 ${
                  pauseMenuFocusIndex === 3 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
                }`}>
                {sfxMuted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-emerald-400" />}
                <span>SFX: {sfxMuted ? 'Off' : 'On'}</span>
              </button>
            </div>

            {/* 4: How to Play Guide */}
            <button
              ref={(el) => {
                pauseMenuItemsRef.current[4] = el;
              }}
              onPointerEnter={() => onSelectMenuIndex(4)}
              onClick={() => onTriggerMenuAction(4)}
              className={`w-full bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-2 ${
                pauseMenuFocusIndex === 4 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
              }`}>
              <HelpCircle size={16} />
              Controls & Combat Guide
            </button>

            {/* 5: Restart Level */}
            <button
              ref={(el) => {
                pauseMenuItemsRef.current[5] = el;
              }}
              onPointerEnter={() => onSelectMenuIndex(5)}
              onClick={() => onTriggerMenuAction(5)}
              className={`w-full bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-slate-700 ${
                pauseMenuFocusIndex === 5 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
              }`}>
              <RotateCcw size={16} />
              Restart Run
            </button>

            {/* 6: Quit to Main Menu */}
            <button
              ref={(el) => {
                pauseMenuItemsRef.current[6] = el;
              }}
              onPointerEnter={() => onSelectMenuIndex(6)}
              onClick={() => onTriggerMenuAction(6)}
              className={`w-full bg-rose-950 hover:bg-rose-900 text-rose-300 py-2.5 rounded-xl text-xs font-semibold transition-all border border-rose-800 ${
                pauseMenuFocusIndex === 6 ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02]' : ''
              }`}>
              Quit to Main Menu (Bank Gold)
            </button>
          </div>
        )}

        {/* Modal Footer Controls info */}
        <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span>[1-3 / Q,E / LB,RB] Tabs • [W,S / D-Pad] Navigate • [Enter / A] Select • [Tab / Y] Sell Screen</span>
          <button
            onClick={() => {
              onClose();
              gameAudio.playCrispClick();
            }}
            className="text-amber-400 hover:text-amber-300 font-bold">
            Resume Battle &rarr;
          </button>
        </div>
      </div>
    </MenuOverlay>
  );
};

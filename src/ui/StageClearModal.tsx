import {Check, ChevronRight, Coins, Flame, Skull, Sparkles, Trophy, Zap} from 'lucide-react';
import React, {useMemo} from 'react';
import {EquippedItem} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {STAGE_THEMES} from '../core/LevelManager';
import {MenuOverlay} from '../../utils/helper';

export interface StageClearModalProps {
  isOpen: boolean;
  stage: number;
  runGold: number;
  equippedWeapons: EquippedItem[];
  equippedPassives: EquippedItem[];
  selectedWeaponId: string;
  onSelectWeapon: (weaponId: string) => void;
  focusIndex: number;
  onSelectFocusIndex: (idx: number) => void;
  onDescend: () => void;
  onClaimVictory: () => void;
}

export const StageClearModal: React.FC<StageClearModalProps> = ({
  isOpen,
  stage,
  runGold,
  equippedWeapons,
  equippedPassives,
  selectedWeaponId,
  onSelectWeapon,
  focusIndex,
  onSelectFocusIndex,
  onDescend,
  onClaimVictory,
}) => {
  if (!isOpen) return null;

  const nextStage = stage + 1;
  const maxCarriedLevel = nextStage * 5;

  // Calculate auto-liquidation refund gold for all unchosen items and capped levels
  const autoRefundGold = useMemo(() => {
    let refund = 0;
    for (const w of equippedWeapons) {
      const def = ITEM_DEFS[w.id];
      if (w.id !== selectedWeaponId) {
        refund += Math.round((def?.cost || 50) * w.level * 0.7);
      } else if (!def?.isEvolution && !def?.isFusion && w.level > maxCarriedLevel) {
        const excess = w.level - maxCarriedLevel;
        refund += Math.round(excess * (def?.cost || 50) * 0.7);
      }
    }
    for (const p of equippedPassives) {
      const def = ITEM_DEFS[p.id];
      refund += Math.round((def?.cost || 40) * p.level * 0.7);
    }
    return refund;
  }, [equippedWeapons, equippedPassives, selectedWeaponId, maxCarriedLevel]);

  const weaponCount = equippedWeapons.length;
  const descendButtonIndex = weaponCount;
  const victoryButtonIndex = weaponCount + 1;
  const nextStageTheme = STAGE_THEMES[stage % STAGE_THEMES.length]?.name || 'Next Realm';

  return (
    <MenuOverlay tone="victory" zIndex={50}>
      <div className="w-full max-w-xl bg-[#0c0a1a] border-2 border-amber-500/80 rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col items-center gap-4 text-center my-auto">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/70 text-amber-300 text-[11px] font-bold tracking-widest uppercase mb-1">
            <Sparkles size={12} className="text-amber-400" />
            <span>Abyssal Titan Vanquished</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200">
            STAGE {stage} CLEARED!
          </h2>
          <div className="text-[11px] text-slate-400 mt-0.5">
            The Swarm grows stronger in the depths. Prepare to descend.
          </div>
        </div>

        {/* Modifiers & Carry-Over Preview */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-around gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <Skull size={14} />
            <span>Enemy HP & DMG +10%</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
            <Zap size={14} />
            <span>Hero Speed +10%</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Coins size={14} />
            <span>Carried Gold: {runGold + autoRefundGold}g</span>
          </div>
        </div>

        {/* Weapon Carry-Over Selector */}
        <div className="w-full flex flex-col gap-1.5 text-left">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
            <span>CHOOSE 1 WEAPON TO CARRY OVER:</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Keys [1]-[{weaponCount}], D-Pad, or Click to select
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {equippedWeapons.map((weapon, idx) => {
              const def = ITEM_DEFS[weapon.id];
              const isSelected = weapon.id === selectedWeaponId;
              const isFocused = focusIndex === idx;

              const isOverCap = !def?.isEvolution && !def?.isFusion && weapon.level > maxCarriedLevel;
              let badgeText = isOverCap
                ? `Lv. ${weapon.level} ➔ ${maxCarriedLevel}`
                : `Lv. ${weapon.level}`;
              let badgeColor = isOverCap
                ? 'bg-amber-950 text-amber-300 border-amber-500'
                : 'bg-slate-800 text-slate-300 border-slate-700';
              if (def?.isFusion) {
                badgeText = 'FUSION';
                badgeColor = 'bg-amber-950 text-amber-300 border-amber-500';
              } else if (def?.isEvolution) {
                badgeText = 'AWAKENED';
                badgeColor = 'bg-purple-950 text-purple-300 border-purple-500';
              }

              return (
                <button
                  key={weapon.id}
                  type="button"
                  onClick={() => {
                    onSelectWeapon(weapon.id);
                    onSelectFocusIndex(descendButtonIndex);
                  }}
                  onPointerEnter={() => onSelectFocusIndex(idx)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-950/70 to-slate-900 border-amber-400 ring-2 ring-amber-300 shadow-lg shadow-amber-950/60 scale-[1.01]'
                      : isFocused
                      ? 'bg-slate-900/90 border-sky-400 ring-2 ring-sky-300 scale-[1.01]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {def?.icon ? (
                      <img
                        src={def.icon}
                        alt={def.name}
                        className="w-9 h-9 object-contain rounded shrink-0 bg-black/40 p-0.5 border border-slate-700"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Flame size={18} className="text-amber-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-100 truncate flex items-center gap-1.5">
                        <span>{def?.name || weapon.id}</span>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {def?.desc || 'Equipped combat weapon'}
                      </div>
                      {isOverCap && (
                        <div className="text-[9px] text-amber-300 font-medium mt-0.5">
                          Stage {nextStage} Cap: Lv. {maxCarriedLevel} (+{Math.round((weapon.level - maxCarriedLevel) * (def?.cost || 50) * 0.7)}g refund)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow">
                        <Check size={15} />
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 font-mono">[{idx + 1}]</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Liquidation Notice */}
          <div className="text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-900/50 rounded-lg px-2.5 py-1.5 mt-1 flex items-center justify-between">
            <span>Unchosen gear & excess levels liquidated:</span>
            <span className="font-bold font-mono">+{autoRefundGold}g refund</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2 pt-1">
          {/* Primary: Descend to Next Stage */}
          <button
            type="button"
            onClick={onDescend}
            onPointerEnter={() => onSelectFocusIndex(descendButtonIndex)}
            className={`w-full py-3 px-4 rounded-xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
              focusIndex === descendButtonIndex
                ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400 text-slate-950 ring-4 ring-amber-300 ring-offset-2 ring-offset-[#0c0a1a] scale-[1.02] shadow-xl shadow-amber-950'
                : 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-lg'
            }`}>
            <span>DESCEND TO STAGE {stage + 1}: {nextStageTheme.toUpperCase()}</span>
            <ChevronRight size={18} />
            <span className="text-xs font-mono opacity-80">[Enter / A]</span>
          </button>

          {/* Secondary: Claim Victory & Bank Gold */}
          <button
            type="button"
            onClick={onClaimVictory}
            onPointerEnter={() => onSelectFocusIndex(victoryButtonIndex)}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
              focusIndex === victoryButtonIndex
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-4 ring-emerald-300 ring-offset-2 ring-offset-[#0c0a1a] scale-[1.02]'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}>
            <Trophy size={14} className="text-emerald-400" />
            <span>CLAIM VICTORY & BANK GOLD</span>
            <span className="text-[11px] font-mono opacity-70">[B / Esc]</span>
          </button>
        </div>
      </div>
    </MenuOverlay>
  );
};

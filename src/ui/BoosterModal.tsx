import React from 'react';
import {BOOSTER_IDS, BOOSTERS, BoosterId, BoosterStacks} from '../types/boosters';
import {EquippedItem} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {MenuOverlay} from '../../utils/helper';

/** Small icon+count chips for the boosters a weapon already carries. */
export const BoosterChips: React.FC<{boosters?: BoosterStacks; size?: number}> = ({boosters, size = 14}) => {
  if (!boosters) return null;
  return (
    <>
      {BOOSTER_IDS.map((id) => {
        const count = boosters[id];
        if (!count) return null;
        return (
          <span
            key={id}
            title={`${BOOSTERS[id].name} x${count}`}
            className="inline-flex items-center gap-0.5 font-bold text-[10px]"
            style={{color: BOOSTERS[id].color}}>
            <img
              src={BOOSTERS[id].icon}
              alt={BOOSTERS[id].name}
              style={{width: size, height: size, imageRendering: 'pixelated'}}
            />
            {count > 1 && <span>x{count}</span>}
          </span>
        );
      })}
    </>
  );
};

export interface BoosterModalProps {
  boosterId: BoosterId | null;
  weapons: EquippedItem[];
  queuedCount: number;
  focusIndex: number;
  onSelectIndex: (idx: number) => void;
  onAssign: (weaponIndex: number) => void;
  itemsRef: React.RefObject<(HTMLButtonElement | null)[]>;
}

export const BoosterModal: React.FC<BoosterModalProps> = ({
  boosterId,
  weapons,
  queuedCount,
  focusIndex,
  onSelectIndex,
  onAssign,
  itemsRef,
}) => {
  if (!boosterId) return null;
  const booster = BOOSTERS[boosterId];

  return (
    <MenuOverlay tone="neutral" zIndex={62}>
      <div
        className="w-full max-w-lg bg-[#0e0c1f] border-2 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        style={{borderColor: booster.color}}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div
            className="w-14 h-14 rounded-xl bg-slate-950 border-2 flex items-center justify-center shrink-0"
            style={{borderColor: booster.color}}>
            <img
              src={booster.icon}
              alt={booster.name}
              className="w-10 h-10"
              style={{imageRendering: 'pixelated'}}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-bold" style={{color: booster.color}}>
              Booster Found{queuedCount > 0 ? ` (+${queuedCount} more waiting)` : ''}
            </div>
            <h2 className="text-xl font-black text-slate-100">{booster.name}</h2>
            <p className="text-[11px] text-slate-300 mt-0.5">{booster.desc}</p>
          </div>
        </div>

        <p className="text-xs text-slate-300">
          Choose a weapon to infuse. Boosters <span className="font-bold text-amber-300">stack</span>, and a weapon can
          carry several different ones.
        </p>

        {/* One button per equipped weapon */}
        <div className="flex flex-col gap-2.5">
          {weapons.map((wep, idx) => {
            const def = ITEM_DEFS[wep.id];
            const isFocused = focusIndex === idx;
            const currentStacks = wep.boosters?.[boosterId] || 0;
            return (
              <button
                key={wep.id}
                ref={(el) => {
                  if (itemsRef.current) itemsRef.current[idx] = el;
                }}
                onPointerEnter={() => onSelectIndex(idx)}
                onClick={() => onAssign(idx)}
                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  isFocused
                    ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/90 shadow-lg scale-[1.01]'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-slate-500 w-3 shrink-0">{idx + 1}</span>
                  <img src={def?.icon || ''} alt="" className="w-8 h-8 object-contain shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                      {isFocused && <span className="text-amber-400 font-bold">▶</span>}
                      <span className="truncate">{def?.name || wep.id}</span>
                      <span className="text-amber-400 text-[10px]">{def?.isEvolution ? 'EVO' : `L${wep.level}`}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 min-h-[14px]">
                      <BoosterChips boosters={wep.boosters} />
                      {!wep.boosters && <span className="text-[10px] text-slate-500">No boosters yet</span>}
                    </div>
                  </div>
                </div>
                <div
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 text-slate-950"
                  style={{backgroundColor: booster.color}}>
                  {currentStacks > 0 ? `x${currentStacks} -> x${currentStacks + 1}` : 'INFUSE'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60 font-mono">
          <span>[W / S or D-Pad] Navigate</span>
          <span>[1-{Math.max(1, weapons.length)}] Quick pick</span>
          <span>[Enter / A] Infuse</span>
        </div>
      </div>
    </MenuOverlay>
  );
};

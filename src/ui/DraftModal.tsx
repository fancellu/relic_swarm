import {DollarSign, RotateCw} from 'lucide-react';
import React from 'react';
import {EquippedItem} from '../types/entities';
import {ItemDef} from '../types/items';
import {MenuOverlay} from '../../utils/helper';

export interface DraftModalProps {
  isOpen: boolean;
  level: number;
  choices: ItemDef[];
  selectedChoiceIndex: number;
  onSelectIndex: (idx: number) => void;
  onSelectUpgrade: (item: ItemDef) => void;
  equippedWeapons: EquippedItem[];
  equippedPassives: EquippedItem[];
  availableRerolls: number;
  onReroll: () => void;
  onOpenInventory: () => void;
}

export const DraftModal: React.FC<DraftModalProps> = ({
  isOpen,
  level,
  choices,
  selectedChoiceIndex,
  onSelectIndex,
  onSelectUpgrade,
  equippedWeapons,
  equippedPassives,
  availableRerolls,
  onReroll,
  onOpenInventory,
}) => {
  if (!isOpen || choices.length === 0) return null;

  return (
    <MenuOverlay tone="neutral" zIndex={45}>
      <div className="w-full max-w-md bg-[#0f0d24] border-2 border-sky-500/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-sky-400 font-bold">Level Reached!</div>
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300">
            LEVEL {level} DRAFT
          </h2>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Keys [1]-[3], W/S, Arrows + Enter/Space, or Gamepad D-pad/A to Pick
          </div>
        </div>

        {/* 3 Choices */}
        <div className="w-full flex flex-col gap-2.5">
          {choices.map((item, idx) => {
            const isFocused = selectedChoiceIndex === idx;
            const currentWep = equippedWeapons.find((w) => w.id === item.id);
            const currentPas = equippedPassives.find((p) => p.id === item.id);
            const currentLvl = currentWep?.level || currentPas?.level || 0;
            const isNew = currentLvl === 0;

            // Base styling by item tier
            let borderAndBg = 'bg-slate-900/80 border-slate-700';
            if (item.isFusion) {
              borderAndBg =
                'bg-gradient-to-r from-amber-950/90 via-rose-950/90 to-amber-950/90 border-amber-400 shadow-amber-950/80';
            } else if (item.isEvolution) {
              borderAndBg = 'bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border-purple-400';
            } else if (item.isConsumable) {
              borderAndBg = 'bg-gradient-to-r from-amber-950/80 via-emerald-950/80 to-slate-900 border-amber-500';
            }

            // Focus styling: high-contrast golden/cyan/purple pulsing outline & scale
            const focusStyle = isFocused
              ? item.isConsumable || item.isFusion
                ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.03] shadow-2xl shadow-amber-500/50 border-amber-300'
                : item.isEvolution
                ? 'ring-4 ring-purple-300 ring-offset-2 ring-offset-slate-950 scale-[1.03] shadow-2xl shadow-purple-500/50 border-purple-300'
                : 'ring-4 ring-sky-400 ring-offset-2 ring-offset-slate-950 scale-[1.03] shadow-2xl shadow-sky-500/50 border-sky-300 bg-slate-800'
              : 'hover:bg-slate-800/80';

            return (
              <button
                key={item.id}
                onClick={() => onSelectUpgrade(item)}
                onPointerEnter={() => onSelectIndex(idx)}
                className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all relative ${borderAndBg} ${focusStyle}`}>
                {/* Hotkey Number Badge */}
                <div className="absolute -top-2 -left-2 w-5 h-5 bg-sky-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center border border-sky-300 shadow">
                  {idx + 1}
                </div>

                <div className="w-12 h-12 rounded-lg bg-slate-950/90 p-1 flex items-center justify-center border border-slate-700 shrink-0">
                  <img src={item.icon} alt={item.name} className="w-9 h-9 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100 truncate">{item.name}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        item.isFusion
                          ? 'bg-amber-400 text-slate-950 animate-pulse'
                          : item.isEvolution
                          ? 'bg-purple-500 text-white animate-pulse'
                          : item.isConsumable
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : isNew
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}>
                      {item.isFusion
                        ? 'FUSION EVOLUTION'
                        : item.isEvolution
                        ? 'EVOLUTION'
                        : item.isConsumable
                        ? 'SUPREME BOON'
                        : isNew
                        ? 'NEW'
                        : `LV ${currentLvl + 1}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{item.desc}</div>
                  {isFocused && (
                    <div className="text-[10px] font-extrabold text-amber-300 mt-1 flex items-center gap-1 animate-pulse">
                      <span>▶ PRESS [ENTER / A] TO EQUIP</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Reroll & Sell Shortcut */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            disabled={availableRerolls <= 0}
            onClick={onReroll}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
              availableRerolls > 0
                ? 'bg-indigo-700 hover:bg-indigo-600 text-white ring-1 ring-indigo-400'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}>
            <RotateCw size={14} />
            <span>Reroll [R / Y] ({availableRerolls})</span>
          </button>

          <button
            onClick={onOpenInventory}
            className="text-rose-400 hover:text-rose-300 font-semibold underline flex items-center gap-1">
            <DollarSign size={14} />
            <span>Sell Equipped Items</span>
          </button>
        </div>
      </div>
    </MenuOverlay>
  );
};

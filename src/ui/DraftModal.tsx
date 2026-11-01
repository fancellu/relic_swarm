import {Ban, DollarSign, RotateCw} from 'lucide-react';
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
  availableBans: number;
  onBan: (item: ItemDef, choiceIndex: number) => void;
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
  availableBans,
  onBan,
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
            Keys [1]-[3], Enter/Space/A to Pick • [B / LB] to Ban • [R / Y] to Reroll
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
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-sm text-slate-100 truncate">{item.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
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

                      {!item.isConsumable && (
                        <button
                          type="button"
                          title={`Banish ${item.name} from this run (${availableBans} bans remaining)`}
                          disabled={availableBans <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBan(item, idx);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                            availableBans > 0
                              ? 'bg-rose-950/90 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-800/80 cursor-pointer'
                              : 'bg-slate-900/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                          }`}>
                          <Ban size={11} className={availableBans > 0 ? 'text-rose-400' : 'text-slate-600'} />
                          <span>Ban</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">{item.desc}</div>
                  {isFocused && (
                    <div className="flex items-center justify-between text-[10px] font-extrabold mt-1">
                      <span className="text-amber-300 animate-pulse">▶ [ENTER / A] EQUIP</span>
                      {!item.isConsumable && availableBans > 0 && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <Ban size={11} /> [B / LB] BANISH
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Reroll, Ban & Sell Shortcut */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2">
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
              disabled={availableBans <= 0 || choices[selectedChoiceIndex]?.isConsumable}
              onClick={() => {
                const cur = choices[selectedChoiceIndex];
                if (cur && !cur.isConsumable) onBan(cur, selectedChoiceIndex);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                availableBans > 0 && !choices[selectedChoiceIndex]?.isConsumable
                  ? 'bg-rose-950 hover:bg-rose-800 text-rose-200 ring-1 ring-rose-500 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}>
              <Ban size={14} />
              <span>Ban [B / LB] ({availableBans})</span>
            </button>
          </div>

          <button
            onClick={onOpenInventory}
            className="text-rose-400 hover:text-rose-300 font-semibold underline flex items-center gap-1">
            <DollarSign size={14} />
            <span>Sell Items [X]</span>
          </button>
        </div>
      </div>
    </MenuOverlay>
  );
};

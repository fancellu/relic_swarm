import {DollarSign, Sword, X} from 'lucide-react';
import React from 'react';
import {EquippedItem} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {MenuOverlay} from '../../utils/helper';

export interface InventorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  equippedWeapons: EquippedItem[];
  equippedPassives: EquippedItem[];
  inventoryFocusIndex: number;
  onSelectIndex: (idx: number) => void;
  onSellItem: (itemId: string) => void;
  inventoryItemsRef: React.MutableRefObject<(HTMLDivElement | HTMLButtonElement | null)[]>;
}

export const InventorySheet: React.FC<InventorySheetProps> = ({
  isOpen,
  onClose,
  equippedWeapons,
  equippedPassives,
  inventoryFocusIndex,
  onSelectIndex,
  onSellItem,
  inventoryItemsRef,
}) => {
  if (!isOpen) return null;

  return (
    <MenuOverlay tone="neutral" zIndex={50}>
      <div className="w-full max-w-lg bg-[#0e0c1f] border-2 border-rose-600/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-rose-900/50 pb-3">
          <div className="flex items-center gap-2">
            <Sword className="text-rose-400" size={20} />
            <h2 className="text-xl font-black text-rose-300">Manage & Sell Arsenal</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Sell unwanted weapons or relics for an instant 70% gold refund to immediately free up build slots for new synergies.
        </p>

        {/* Weapons Section */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Equipped Weapons ({equippedWeapons.length}/4):
          </div>
          {equippedWeapons.length === 0 ? (
            <div className="text-xs text-slate-500 italic">No weapons equipped.</div>
          ) : (
            equippedWeapons.map((wep, idx) => {
              const def = ITEM_DEFS[wep.id];
              const refund = Math.round((def?.cost || 50) * wep.level * 0.7);
              const isFocused = inventoryFocusIndex === idx;

              return (
                <div
                  key={wep.id}
                  ref={(el) => {
                    inventoryItemsRef.current[idx] = el;
                  }}
                  onPointerEnter={() => onSelectIndex(idx)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    isFocused
                      ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/90 scale-[1.01]'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <img src={def?.icon || ''} alt={def?.name || ''} className="w-8 h-8 object-contain" />
                    <div>
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                        {isFocused && <span className="text-rose-400 font-bold">▶</span>}
                        <span>{def?.name || wep.id}</span>
                        <span className="text-indigo-400 text-[10px]">
                          {def?.isEvolution ? 'EVO' : `L${wep.level}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">{def?.desc}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSellItem(wep.id)}
                    className={`bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                      isFocused ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105' : ''
                    }`}>
                    <DollarSign size={14} />
                    <span>Sell (+{refund}g)</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Passives Section */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Equipped Relics ({equippedPassives.length}/4):
          </div>
          {equippedPassives.length === 0 ? (
            <div className="text-xs text-slate-500 italic">No relics equipped.</div>
          ) : (
            equippedPassives.map((pas, pasIdx) => {
              const def = ITEM_DEFS[pas.id];
              const refund = Math.round((def?.cost || 40) * pas.level * 0.7);
              const focusIdx = equippedWeapons.length + pasIdx;
              const isFocused = inventoryFocusIndex === focusIdx;

              return (
                <div
                  key={pas.id}
                  ref={(el) => {
                    inventoryItemsRef.current[focusIdx] = el;
                  }}
                  onPointerEnter={() => onSelectIndex(focusIdx)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    isFocused
                      ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/90 scale-[1.01]'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <img src={def?.icon || ''} alt={def?.name || ''} className="w-8 h-8 object-contain" />
                    <div>
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                        {isFocused && <span className="text-rose-400 font-bold">▶</span>}
                        <span>{def?.name || pas.id}</span>
                        <span className="text-emerald-400 text-[10px]">L{pas.level}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{def?.desc}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSellItem(pas.id)}
                    className={`bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                      isFocused ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105' : ''
                    }`}>
                    <DollarSign size={14} />
                    <span>Sell (+{refund}g)</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Done Button */}
        {(() => {
          const doneIdx = equippedWeapons.length + equippedPassives.length;
          const isDoneFocused = inventoryFocusIndex === doneIdx;
          return (
            <button
              ref={(el) => {
                inventoryItemsRef.current[doneIdx] = el;
              }}
              onPointerEnter={() => onSelectIndex(doneIdx)}
              onClick={onClose}
              className={`w-full font-bold py-2 rounded-xl text-xs transition-all border ${
                isDoneFocused
                  ? 'bg-slate-700 text-rose-300 border-rose-400 ring-2 ring-rose-400 shadow-md scale-[1.01]'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-transparent'
              }`}>
              Done [Esc / B / Tab]
            </button>
          );
        })()}

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60">
          <span>[W / S or D-Pad] Navigate</span>
          <span>[Enter / A] Sell Item</span>
          <span>[Esc / B / Tab] Close</span>
        </div>
      </div>
    </MenuOverlay>
  );
};

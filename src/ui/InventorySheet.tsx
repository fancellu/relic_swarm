import {DollarSign, Sparkles, Sword, X} from 'lucide-react';
import React from 'react';
import {EquippedItem} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {MenuOverlay} from '../../utils/helper';

export interface InventoryAction {
  type: 'SELL' | 'ESSENCE';
  itemId: string;
}

export function buildInventoryActionList(
  weapons: EquippedItem[],
  passives: EquippedItem[],
): InventoryAction[] {
  const actions: InventoryAction[] = [];
  weapons.forEach((wep) => {
    const def = ITEM_DEFS[wep.id];
    actions.push({type: 'SELL', itemId: wep.id});
    if (wep.level >= (def?.maxLevel || 5) || def?.isEvolution) {
      actions.push({type: 'ESSENCE', itemId: wep.id});
    }
  });
  passives.forEach((pas) => {
    const def = ITEM_DEFS[pas.id];
    actions.push({type: 'SELL', itemId: pas.id});
    if (pas.level >= (def?.maxLevel || 5)) {
      actions.push({type: 'ESSENCE', itemId: pas.id});
    }
  });
  return actions;
}

export interface InventorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  equippedWeapons: EquippedItem[];
  equippedPassives: EquippedItem[];
  inventoryFocusIndex: number;
  onSelectIndex: (idx: number) => void;
  onSellItem: (itemId: string) => void;
  onExtractEssence: (itemId: string) => void;
  inventoryItemsRef: React.RefObject<(HTMLDivElement | HTMLButtonElement | null)[]>;
}

export const InventorySheet: React.FC<InventorySheetProps> = ({
  isOpen,
  onClose,
  equippedWeapons,
  equippedPassives,
  inventoryFocusIndex,
  onSelectIndex,
  onSellItem,
  onExtractEssence,
  inventoryItemsRef,
}) => {
  if (!isOpen) return null;

  // Compute map of action button indices
  let currentActionIndex = 0;
  const itemActionIndices: Record<string, {sellIdx: number; essenceIdx?: number}> = {};

  equippedWeapons.forEach((wep) => {
    const def = ITEM_DEFS[wep.id];
    const isMax = wep.level >= (def?.maxLevel || 5) || def?.isEvolution;
    const sellIdx = currentActionIndex++;
    let essenceIdx: number | undefined;
    if (isMax) essenceIdx = currentActionIndex++;
    itemActionIndices[wep.id] = {sellIdx, essenceIdx};
  });

  equippedPassives.forEach((pas) => {
    const def = ITEM_DEFS[pas.id];
    const isMax = pas.level >= (def?.maxLevel || 5);
    const sellIdx = currentActionIndex++;
    let essenceIdx: number | undefined;
    if (isMax) essenceIdx = currentActionIndex++;
    itemActionIndices[pas.id] = {sellIdx, essenceIdx};
  });

  const doneButtonIndex = currentActionIndex;

  return (
    <MenuOverlay tone="neutral" zIndex={50}>
      <div className="w-full max-w-lg bg-[#0e0c1f] border-2 border-rose-600/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-rose-900/50 pb-3">
          <div className="flex items-center gap-2">
            <Sword className="text-rose-400" size={20} />
            <h2 className="text-xl font-black text-rose-300">Arsenal & Relic Forging</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col gap-1">
          <div>
            <span className="text-amber-400 font-bold">Dynamic Pivoting:</span> Sell gear for an instant <span className="text-amber-300 font-bold">70% gold refund</span> to free slots for new builds.
          </div>
          <div>
            <span className="text-purple-400 font-bold">Relic Forging:</span> Sacrifice maxed <span className="text-purple-300 font-bold">Level 5</span> items to <span className="text-purple-300 font-bold">Extract Essence</span> (0g) and permanently inherit 20% of their stats for the rest of the run!
          </div>
        </div>

        {/* Weapons Section */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Equipped Weapons ({equippedWeapons.length}/4):
          </div>
          {equippedWeapons.length === 0 ? (
            <div className="text-xs text-slate-500 italic">No weapons equipped.</div>
          ) : (
            equippedWeapons.map((wep) => {
              const def = ITEM_DEFS[wep.id];
              const refund = Math.round((def?.cost || 50) * wep.level * 0.7);
              const isMax = wep.level >= (def?.maxLevel || 5) || def?.isEvolution;
              const indices = itemActionIndices[wep.id];
              const isRowFocused =
                inventoryFocusIndex === indices?.sellIdx ||
                inventoryFocusIndex === indices?.essenceIdx;

              return (
                <div
                  key={wep.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                    isRowFocused
                      ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/90 scale-[1.01]'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <img src={def?.icon || ''} alt={def?.name || ''} className="w-8 h-8 object-contain shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5 flex-wrap">
                        {isRowFocused && <span className="text-rose-400 font-bold">▶</span>}
                        <span>{def?.name || wep.id}</span>
                        <span className="text-indigo-400 text-[10px]">
                          {def?.isEvolution ? 'EVO' : `L${wep.level}`}
                        </span>
                        {isMax && (
                          <span className="bg-purple-950/90 text-purple-300 border border-purple-500/60 px-1.5 py-0.2 rounded text-[9px] font-bold">
                            FORGING READY
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{def?.desc}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Sell Button */}
                    <button
                      ref={(el) => {
                        if (inventoryItemsRef.current && indices) {
                          inventoryItemsRef.current[indices.sellIdx] = el;
                        }
                      }}
                      onPointerEnter={() => indices && onSelectIndex(indices.sellIdx)}
                      onClick={() => onSellItem(wep.id)}
                      className={`bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        inventoryFocusIndex === indices?.sellIdx
                          ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105'
                          : ''
                      }`}>
                      <DollarSign size={13} />
                      <span>Sell (+{refund}g)</span>
                    </button>

                    {/* Extract Essence Button (Level 5 / Evolved items) */}
                    {isMax && indices?.essenceIdx !== undefined && (
                      <button
                        ref={(el) => {
                          if (inventoryItemsRef.current) {
                            inventoryItemsRef.current[indices.essenceIdx!] = el;
                          }
                        }}
                        onPointerEnter={() => onSelectIndex(indices.essenceIdx!)}
                        onClick={() => onExtractEssence(wep.id)}
                        title="Sacrifice item for 0g to permanently inherit 20% of its stats!"
                        className={`bg-purple-700 hover:bg-purple-600 text-purple-100 border border-purple-400 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          inventoryFocusIndex === indices.essenceIdx
                            ? 'ring-2 ring-purple-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105 bg-purple-600'
                            : ''
                        }`}>
                        <Sparkles size={13} className="text-purple-300" />
                        <span>Extract Essence</span>
                      </button>
                    )}
                  </div>
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
            equippedPassives.map((pas) => {
              const def = ITEM_DEFS[pas.id];
              const refund = Math.round((def?.cost || 40) * pas.level * 0.7);
              const isMax = pas.level >= (def?.maxLevel || 5);
              const indices = itemActionIndices[pas.id];
              const isRowFocused =
                inventoryFocusIndex === indices?.sellIdx ||
                inventoryFocusIndex === indices?.essenceIdx;

              return (
                <div
                  key={pas.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                    isRowFocused
                      ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/90 scale-[1.01]'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <img src={def?.icon || ''} alt={def?.name || ''} className="w-8 h-8 object-contain shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5 flex-wrap">
                        {isRowFocused && <span className="text-rose-400 font-bold">▶</span>}
                        <span>{def?.name || pas.id}</span>
                        <span className="text-emerald-400 text-[10px]">L{pas.level}</span>
                        {isMax && (
                          <span className="bg-purple-950/90 text-purple-300 border border-purple-500/60 px-1.5 py-0.2 rounded text-[9px] font-bold">
                            FORGING READY
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{def?.desc}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Sell Button */}
                    <button
                      ref={(el) => {
                        if (inventoryItemsRef.current && indices) {
                          inventoryItemsRef.current[indices.sellIdx] = el;
                        }
                      }}
                      onPointerEnter={() => indices && onSelectIndex(indices.sellIdx)}
                      onClick={() => onSellItem(pas.id)}
                      className={`bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        inventoryFocusIndex === indices?.sellIdx
                          ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105'
                          : ''
                      }`}>
                      <DollarSign size={13} />
                      <span>Sell (+{refund}g)</span>
                    </button>

                    {/* Extract Essence Button (Level 5 passives) */}
                    {isMax && indices?.essenceIdx !== undefined && (
                      <button
                        ref={(el) => {
                          if (inventoryItemsRef.current) {
                            inventoryItemsRef.current[indices.essenceIdx!] = el;
                          }
                        }}
                        onPointerEnter={() => onSelectIndex(indices.essenceIdx!)}
                        onClick={() => onExtractEssence(pas.id)}
                        title="Sacrifice relic for 0g to permanently inherit 20% of its stats!"
                        className={`bg-purple-700 hover:bg-purple-600 text-purple-100 border border-purple-400 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          inventoryFocusIndex === indices.essenceIdx
                            ? 'ring-2 ring-purple-300 ring-offset-2 ring-offset-slate-950 shadow-md scale-105 bg-purple-600'
                            : ''
                        }`}>
                        <Sparkles size={13} className="text-purple-300" />
                        <span>Extract Essence</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Done Button */}
        <button
          ref={(el) => {
            if (inventoryItemsRef.current) inventoryItemsRef.current[doneButtonIndex] = el;
          }}
          onPointerEnter={() => onSelectIndex(doneButtonIndex)}
          onClick={onClose}
          className={`w-full font-bold py-2 rounded-xl text-xs transition-all border ${
            inventoryFocusIndex === doneButtonIndex
              ? 'bg-slate-700 text-rose-300 border-rose-400 ring-2 ring-rose-400 shadow-md scale-[1.01]'
              : 'bg-slate-800 hover:bg-slate-700 text-white border-transparent'
          }`}>
          Done [Esc / B / Tab]
        </button>

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60">
          <span>[W / S or D-Pad] Navigate</span>
          <span>[Enter / A] Confirm Action</span>
          <span>[Esc / B / Tab] Close</span>
        </div>
      </div>
    </MenuOverlay>
  );
};

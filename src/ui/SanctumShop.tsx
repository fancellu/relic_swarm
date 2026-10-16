import {Coins, X, Zap} from 'lucide-react';
import React from 'react';
import {META_UPGRADES} from '../types/meta';
import {MenuOverlay} from '../../utils/helper';

export interface SanctumShopProps {
  isOpen: boolean;
  onClose: () => void;
  persistentGold: number;
  metaLevels: Record<string, number>;
  sanctumFocusIndex: number;
  onSelectIndex: (idx: number) => void;
  onBuyUpgrade: (upgId: string) => void;
  sanctumItemsRef: React.RefObject<(HTMLDivElement | HTMLButtonElement | null)[]>;
}

export const SanctumShop: React.FC<SanctumShopProps> = ({
  isOpen,
  onClose,
  persistentGold,
  metaLevels,
  sanctumFocusIndex,
  onSelectIndex,
  onBuyUpgrade,
  sanctumItemsRef,
}) => {
  if (!isOpen) return null;

  return (
    <MenuOverlay tone="neutral" zIndex={50}>
      <div className="w-full max-w-lg bg-[#0f0c22] border-2 border-amber-600/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-amber-800/50 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-400" size={20} />
            <h2 className="text-xl font-black text-amber-300">Sanctum Meta-Shop</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 font-bold text-amber-400 text-sm bg-amber-950/60 px-2 py-1 rounded border border-amber-700/50">
              <Coins size={14} />
              <span>{persistentGold} Gold</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-300">
          Permanently enhance your stats across all future runs using gold collected from swarms and chests. All gold earned during runs is banked directly into your Sanctum Vault upon completion or tactical exit.
        </div>

        <div className="flex flex-col gap-2">
          {Object.values(META_UPGRADES).map((upg, idx) => {
            const currentLvl = metaLevels[upg.id] || 0;
            const cost = upg.costBase + currentLvl * upg.costStep;
            const isMax = currentLvl >= upg.maxLevel;
            const canAfford = persistentGold >= cost;
            const isFocused = sanctumFocusIndex === idx;

            return (
              <div
                key={upg.id}
                ref={(el) => {
                  if (sanctumItemsRef.current) sanctumItemsRef.current[idx] = el;
                }}
                onPointerEnter={() => onSelectIndex(idx)}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  isFocused
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/60 ring-2 ring-amber-400/90 scale-[1.01]'
                    : 'bg-slate-950/80 border-slate-800'
                }`}>
                <div>
                  <div className="font-bold text-xs text-slate-100 flex items-center gap-2">
                    {isFocused && <span className="text-amber-400 font-bold">▶</span>}
                    <span>{upg.name}</span>
                    <span className="text-amber-400 text-[10px]">
                      Rank {currentLvl}/{upg.maxLevel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{upg.desc}</div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    Current: +{currentLvl * upg.bonusPerLevel}
                    {upg.unit}
                  </div>
                </div>

                <button
                  disabled={isMax || !canAfford}
                  onClick={() => onBuyUpgrade(upg.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    isMax
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : canAfford
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  } ${isFocused ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : ''}`}>
                  {isMax ? 'MAXED' : `${cost} Gold`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Close Shop Button */}
        {(() => {
          const closeIdx = Object.values(META_UPGRADES).length;
          const isCloseFocused = sanctumFocusIndex === closeIdx;
          return (
            <button
              ref={(el) => {
                if (sanctumItemsRef.current) sanctumItemsRef.current[closeIdx] = el;
              }}
              onPointerEnter={() => onSelectIndex(closeIdx)}
              onClick={onClose}
              className={`w-full font-bold py-2 rounded-xl text-xs transition-all mt-2 border ${
                isCloseFocused
                  ? 'bg-slate-700 text-amber-300 border-amber-400 ring-2 ring-amber-400 shadow-md scale-[1.01]'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-transparent'
              }`}>
              Close Shop [B / Esc]
            </button>
          );
        })()}

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60">
          <span>[W / S or D-Pad] Navigate</span>
          <span>[Enter / A] Buy</span>
          <span>[Esc / B] Back</span>
        </div>
      </div>
    </MenuOverlay>
  );
};

import {Coins, Hammer, Sparkles, Store, X, Zap} from 'lucide-react';
import React from 'react';
import {MenuOverlay} from '../../utils/helper';

export interface MerchantModalProps {
  isOpen: boolean;
  onClose: () => void;
  runGold: number;
  onBuyOverdrive: () => void;
  onBuyForceUpgrade: () => void;
  onBuyCatalyst: () => void;
  overdriveRemaining: number;
  catalystAvailable: boolean;
  merchantFocusIndex: number;
  onSelectIndex: (idx: number) => void;
  merchantItemsRef: React.RefObject<(HTMLButtonElement | null)[]>;
}

export const MerchantModal: React.FC<MerchantModalProps> = ({
  isOpen,
  onClose,
  runGold,
  onBuyOverdrive,
  onBuyForceUpgrade,
  onBuyCatalyst,
  overdriveRemaining,
  catalystAvailable,
  merchantFocusIndex,
  onSelectIndex,
  merchantItemsRef,
}) => {
  if (!isOpen) return null;

  const OVERDRIVE_COST = 100;
  const UPGRADE_COST = 175;
  const CATALYST_COST = 250;

  const canAffordOverdrive = runGold >= OVERDRIVE_COST;
  const canAffordUpgrade = runGold >= UPGRADE_COST;
  const canAffordCatalyst = runGold >= CATALYST_COST;

  return (
    <MenuOverlay tone="neutral" zIndex={60}>
      <div className="w-full max-w-lg bg-[#0e0c1f] border-2 border-amber-500/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-900/60 pb-3">
          <div className="flex items-center gap-2">
            <Store className="text-amber-400" size={22} />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                Wandering Smuggler
              </div>
              <h2 className="text-xl font-black text-amber-300">Black Market Bazaar</h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 font-bold text-amber-300 bg-amber-950/70 px-3 py-1 rounded-lg border border-amber-700/60 text-xs shadow-inner">
              <Coins size={14} className="text-amber-400" />
              <span>{runGold}g Pouch</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-300">
          Spend <span className="text-amber-300 font-bold">current unbanked run gold</span> on high-stakes black market contraband to overdrive your build before the next swarm.
        </p>

        {/* 3 Contraband Offerings */}
        <div className="flex flex-col gap-2.5">
          {/* Item 0: 60s Overdrive Infusion */}
          <button
            ref={(el) => {
              if (merchantItemsRef.current) merchantItemsRef.current[0] = el;
            }}
            onPointerEnter={() => onSelectIndex(0)}
            onClick={onBuyOverdrive}
            className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
              merchantFocusIndex === 0
                ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/90 shadow-lg scale-[1.01]'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
            }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-950/80 border border-orange-500/60 flex items-center justify-center shrink-0">
                <Zap size={20} className="text-orange-400" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                  {merchantFocusIndex === 0 && <span className="text-amber-400 font-bold">▶</span>}
                  <span>Overdrive Infusion (60s)</span>
                  {overdriveRemaining > 0 && (
                    <span className="bg-orange-950 text-orange-300 border border-orange-500/60 px-1.5 py-0.2 rounded text-[9px] font-bold animate-pulse">
                      ACTIVE ({Math.ceil(overdriveRemaining)}s)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  +40% Might, +25% Cooldown Haste & +20% Movement Speed for 60 seconds.
                </div>
              </div>
            </div>

            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 ${
              canAffordOverdrive
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}>
              <Coins size={12} />
              <span>{OVERDRIVE_COST}g</span>
            </div>
          </button>

          {/* Item 1: Blacksmith's Tempering (+1 Weapon Level) */}
          <button
            ref={(el) => {
              if (merchantItemsRef.current) merchantItemsRef.current[1] = el;
            }}
            onPointerEnter={() => onSelectIndex(1)}
            onClick={onBuyForceUpgrade}
            className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
              merchantFocusIndex === 1
                ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/90 shadow-lg scale-[1.01]'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
            }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-950/80 border border-sky-500/60 flex items-center justify-center shrink-0">
                <Hammer size={20} className="text-sky-400" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                  {merchantFocusIndex === 1 && <span className="text-amber-400 font-bold">▶</span>}
                  <span>Blacksmith's Tempering</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Force-upgrade an equipped non-max weapon by +1 Level immediately!
                </div>
              </div>
            </div>

            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 ${
              canAffordUpgrade
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}>
              <Coins size={12} />
              <span>{UPGRADE_COST}g</span>
            </div>
          </button>

          {/* Item 2: Arcane Fusion Catalyst */}
          <button
            ref={(el) => {
              if (merchantItemsRef.current) merchantItemsRef.current[2] = el;
            }}
            onPointerEnter={() => onSelectIndex(2)}
            onClick={onBuyCatalyst}
            className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
              merchantFocusIndex === 2
                ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/90 shadow-lg scale-[1.01]'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
            }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-500/60 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-purple-400" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                  {merchantFocusIndex === 2 && <span className="text-amber-400 font-bold">▶</span>}
                  <span>Arcane Fusion Catalyst</span>
                  {catalystAvailable && (
                    <span className="bg-purple-950 text-purple-300 border border-purple-500/60 px-1.5 py-0.2 rounded text-[9px] font-bold">
                      READY
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Single-use Catalyst: Synthesizes a weapon fusion without requiring Level 5! Fuses any compatible pair immediately.
                </div>
              </div>
            </div>

            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 ${
              canAffordCatalyst
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}>
              <Coins size={12} />
              <span>{CATALYST_COST}g</span>
            </div>
          </button>
        </div>

        {/* Done / Leave Button */}
        <button
          ref={(el) => {
            if (merchantItemsRef.current) merchantItemsRef.current[3] = el;
          }}
          onPointerEnter={() => onSelectIndex(3)}
          onClick={onClose}
          className={`w-full font-bold py-2.5 rounded-xl text-xs transition-all border ${
            merchantFocusIndex === 3
              ? 'bg-slate-700 text-amber-300 border-amber-400 ring-2 ring-amber-400 shadow-md scale-[1.01]'
              : 'bg-slate-800 hover:bg-slate-700 text-white border-transparent'
          }`}>
          Leave Black Market [Esc / B]
        </button>

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-3 pt-1 border-t border-slate-800/60 font-mono">
          <span>[W / S or D-Pad] Navigate</span>
          <span>[Enter / A] Purchase</span>
          <span>[Esc / B] Leave</span>
        </div>
      </div>
    </MenuOverlay>
  );
};

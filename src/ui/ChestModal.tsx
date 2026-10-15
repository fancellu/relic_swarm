import {Sparkles} from 'lucide-react';
import React from 'react';
import {ChestRewardData} from '../types/entities';
import {MenuOverlay} from '../../utils/helper';

export interface ChestModalProps {
  chestReward: ChestRewardData | null;
  onClaim: () => void;
}

export const ChestModal: React.FC<ChestModalProps> = ({chestReward, onClaim}) => {
  if (!chestReward) return null;

  return (
    <MenuOverlay tone="victory" zIndex={50}>
      <div className="w-full max-w-sm bg-[#0e0c1f] border-2 border-amber-500 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/80 p-2 flex items-center justify-center border border-amber-600 shadow-lg">
          <img
            src="assets/images/item_treasure_chest.png"
            alt="Chest"
            className="w-12 h-12 object-contain"
          />
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-0.5">
            Treasure Unlocked
          </div>
          <h2 className="text-xl md:text-2xl font-black text-amber-300">{chestReward.title}</h2>
          <div className="text-xs font-bold text-amber-400 mt-1">
            +{chestReward.gold} Sanctum Gold Acquired
          </div>
        </div>

        <div className="w-full bg-slate-950/90 p-3.5 rounded-xl border border-amber-600/50 flex flex-col gap-2 text-left">
          {chestReward.item ? (
            <div className="flex items-center gap-3">
              <img
                src={chestReward.item.icon}
                alt={chestReward.item.name}
                className="w-10 h-10 object-contain shrink-0"
              />
              <div>
                <div className="font-bold text-xs text-slate-100">{chestReward.item.name}</div>
                <div className="text-[11px] text-slate-300 mt-0.5">{chestReward.item.desc}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-200 leading-relaxed font-medium">
              {chestReward.description}
            </div>
          )}
        </div>

        <button
          onClick={onClaim}
          autoFocus
          className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-3 rounded-xl text-sm transition-all shadow-lg ring-2 ring-amber-300 hover:scale-[1.02] flex items-center justify-center gap-2">
          <Sparkles size={16} className="fill-slate-950" />
          <span>CLAIM REWARD (Enter / Space / A)</span>
        </button>
      </div>
    </MenuOverlay>
  );
};

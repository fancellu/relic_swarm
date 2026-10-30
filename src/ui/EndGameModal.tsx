import {Coins, RotateCw, Skull, Trophy} from 'lucide-react';
import React from 'react';
import {formatTime, MenuOverlay} from '../../utils/helper';
import {STAGE_THEMES} from '../core/LevelManager';

export interface EndGameModalProps {
  status: 'GAME_OVER' | 'VICTORY' | string;
  timer: number;
  totalRunTimer?: number;
  stage?: number;
  killCount: number;
  level: number;
  score: number;
  runGold: number;
  persistentGold: number;
  endScreenFocusIndex: number;
  onSelectIndex: (idx: number) => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  status,
  timer,
  totalRunTimer,
  stage = 1,
  killCount,
  level,
  score,
  runGold,
  persistentGold,
  endScreenFocusIndex,
  onSelectIndex,
  onRestart,
  onReturnToMenu,
}) => {
  if (status !== 'GAME_OVER' && status !== 'VICTORY') return null;

  if (status === 'GAME_OVER') {
    return (
      <MenuOverlay tone="danger" zIndex={50}>
        <div className="w-full max-w-md bg-[#130914] border-2 border-red-700/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center my-auto">
          <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-600 flex items-center justify-center text-red-400">
            <Skull size={32} />
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-red-400 font-bold mb-1">
              Fallen in the Sanctum
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-red-400">
              DEFEATED BY THE SWARM
            </h2>
          </div>

          {/* Gold Earned & Vault Display */}
          <div className="w-full bg-amber-950/40 border border-amber-800/40 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Coins size={15} />
              <span>Gold Earned: +{runGold}g</span>
            </div>
            <div className="font-bold text-amber-400">
              Vault: {persistentGold}g
            </div>
          </div>

          <div className="w-full bg-black/60 p-3 rounded-xl border border-red-950 text-xs text-slate-300 flex justify-around">
            <div>
              <div className="text-slate-400 text-[10px]">Realm Reached</div>
              <div className="font-bold text-purple-300 text-sm">Stage {stage}</div>
              <div className="text-[10px] text-purple-400 font-medium truncate max-w-[90px]">{STAGE_THEMES[(stage - 1) % STAGE_THEMES.length]?.name || 'Gothic Sanctum'}</div>
            </div>
            <div className="border-r border-slate-800" />
            <div>
              <div className="text-slate-400 text-[10px]">Total Time</div>
              <div className="font-bold text-slate-100 text-sm">{formatTime(totalRunTimer || timer || 0)}</div>
            </div>
            <div className="border-r border-slate-800" />
            <div>
              <div className="text-slate-400 text-[10px]">Kills</div>
              <div className="font-bold text-rose-400 text-sm">{killCount}</div>
            </div>
            <div className="border-r border-slate-800" />
            <div>
              <div className="text-slate-400 text-[10px]">Character</div>
              <div className="font-bold text-sky-400 text-sm">Lv. {level}</div>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2.5 pt-2">
            <button
              onClick={onRestart}
              onPointerEnter={() => onSelectIndex(0)}
              className={`w-full py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm md:text-base ${
                endScreenFocusIndex === 0
                  ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] shadow-xl shadow-red-950/60'
                  : 'bg-red-800/80 hover:bg-red-700 text-slate-200'
              }`}>
              <RotateCw size={18} />
              <span>QUICK RESTART [A / Enter]</span>
            </button>

            <button
              onClick={onReturnToMenu}
              onPointerEnter={() => onSelectIndex(1)}
              className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 font-semibold text-xs border ${
                endScreenFocusIndex === 1
                  ? 'bg-slate-700 text-white ring-4 ring-sky-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] border-sky-400'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}>
              <span>SANCTUM & CHAMPIONS [B / Esc]</span>
            </button>
          </div>
        </div>
      </MenuOverlay>
    );
  }

  return (
    <MenuOverlay tone="victory" zIndex={50}>
      <div className="w-full max-w-md bg-[#091512] border-2 border-emerald-600/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center my-auto">
        <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500 flex items-center justify-center text-emerald-400">
          <Trophy size={32} />
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
            Triumphant Victory
          </div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
            ABYSSAL TITAN VANQUISHED!
          </h2>
        </div>

        {/* Gold Earned & Vault Display */}
        <div className="w-full bg-amber-950/40 border border-amber-800/40 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Coins size={15} />
            <span>Gold Earned: +{runGold}g</span>
          </div>
          <div className="font-bold text-amber-400">
            Vault: {persistentGold}g
          </div>
        </div>

        <div className="w-full bg-black/60 p-3 rounded-xl border border-emerald-950 text-xs text-slate-300 flex justify-around">
          <div>
            <div className="text-slate-400 text-[10px]">Stages Cleared</div>
            <div className="font-bold text-amber-300 text-sm">{stage} Cleared</div>
          </div>
          <div className="border-r border-slate-800" />
          <div>
            <div className="text-slate-400 text-[10px]">Total Time</div>
            <div className="font-bold text-slate-100 text-sm">{formatTime(totalRunTimer || timer || 0)}</div>
          </div>
          <div className="border-r border-slate-800" />
          <div>
            <div className="text-slate-400 text-[10px]">Kills</div>
            <div className="font-bold text-rose-400 text-sm">{killCount}</div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2.5 pt-2">
          <button
            onClick={onRestart}
            onPointerEnter={() => onSelectIndex(0)}
            className={`w-full py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm md:text-base ${
              endScreenFocusIndex === 0
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] shadow-xl shadow-emerald-950/60'
                : 'bg-emerald-800/80 hover:bg-emerald-700 text-slate-200'
            }`}>
            <RotateCw size={18} />
            <span>SURVIVE AGAIN [A / Enter]</span>
          </button>

          <button
            onClick={onReturnToMenu}
            onPointerEnter={() => onSelectIndex(1)}
            className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 font-semibold text-xs border ${
              endScreenFocusIndex === 1
                ? 'bg-slate-700 text-white ring-4 ring-emerald-300 ring-offset-2 ring-offset-slate-950 scale-[1.02] border-emerald-400'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}>
            <span>SANCTUM & CHAMPIONS [B / Esc]</span>
          </button>
        </div>
      </div>
    </MenuOverlay>
  );
};

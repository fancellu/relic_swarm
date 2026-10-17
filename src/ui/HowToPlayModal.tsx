import {Compass, Flame, HelpCircle, Skull, Sparkles, X, Zap} from 'lucide-react';
import React from 'react';
import {MenuOverlay} from '../../utils/helper';

export interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({isOpen, onClose, scrollContainerRef}) => {
  if (!isOpen) return null;

  return (
    <MenuOverlay tone="neutral" zIndex={60}>
      <div
        ref={scrollContainerRef}
        className="w-full max-w-md bg-[#0e0c1f] border-2 border-indigo-500/70 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-indigo-900/50 pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="text-indigo-400" size={20} />
            <h2 className="text-xl font-black text-indigo-300">Controls & Mechanics</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="text-xs text-slate-300 flex flex-col gap-3">
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
              <Zap size={14} />
              <span>Movement & Sprint</span>
            </div>
            <div>• Keyboard: WASD / Arrow Keys to move, <span className="text-emerald-400 font-bold">Shift</span> to Sprint (+60% speed).</div>
            <div>• Gamepad: Left Stick / D-pad to move, <span className="text-emerald-400 font-bold">Button B / RT / LT / X</span> to Sprint.</div>
            <div>• Mobile: Drag virtual joystick + tap green Sprint button.</div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>Draft & Menu Navigation</span>
            </div>
            <div>• Direct Select: Press <span className="text-sky-300 font-bold">[1], [2], [3]</span> to immediately pick an upgrade.</div>
            <div>• Arrow Navigation: W/S or Up/Down + <span className="text-sky-300 font-bold">Enter / Space</span>.</div>
            <div>• Gamepad: D-pad / Left Stick Up/Down to navigate, <span className="text-sky-300 font-bold">Button A / Cross</span> to confirm. Press Y to Reroll!</div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
              <Flame size={14} />
              <span>Level 5 Weapon Merging / Evolution</span>
            </div>
            <div>• Max two compatible weapons to Level 5 (e.g. Magic Missile + Daggers, or Flame + Thunder) to unlock extraordinary <span className="text-amber-300 font-bold">Fusion Evolutions</span>!</div>
            <div>• Fusing combines both weapons into one supreme weapon, freeing an entire weapon slot for new builds!</div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
              <Skull size={14} />
              <span>Status Effects: Poison & Slow</span>
            </div>
            <div>• <span className="text-emerald-400 font-bold">Poison</span>: Deals continuous damage-over-time (green ticks) melting swarms.</div>
            <div>• <span className="text-cyan-400 font-bold">Slow</span>: Freezes and slows enemy charges by up to 50%.</div>
          </div>

          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="font-bold text-pink-400 mb-1 flex items-center gap-1.5">
              <Compass size={14} />
              <span>Arena Objectives & Spatial Trials</span>
            </div>
            <div>• <span className="text-pink-300 font-bold">Corrupted Obelisks</span>: Follow the HUD compass. Stand within the 150px zone to channel 100% purification (+30% swarm frenzy) for a holy shockwave & Chest/Magnet.</div>
            <div>• <span className="text-rose-300 font-bold">Cursed Blood Trials</span>: Pick up elite Blood Chalices to enter a 20s sealed 600x600 arena for +150 Gold, Chest & Purple XP.</div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center font-mono">
          [W,S / Arrows / Sticks] Scroll Guide • [Esc / Enter] Close
        </div>

        <button
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs transition-colors">
          Close Guide
        </button>
      </div>
    </MenuOverlay>
  );
};

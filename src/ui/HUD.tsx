import {Coins, Heart, Menu, Sparkles, Sword, Zap} from 'lucide-react';
import React from 'react';
import {EquippedItem} from '../types/entities';
import {ITEM_DEFS} from '../types/items';
import {clamp, formatTime} from '../../utils/helper';

export interface HUDProps {
  currentHp: number;
  maxHpDisplay: number;
  currentStamina: number;
  maxStaminaDisplay: number;
  level: number;
  timer: number;
  killCount: number;
  runGold: number;
  xpDisplay: number;
  nextLevelXpDisplay: number;
  equippedWeapons: EquippedItem[];
  equippedPassives: EquippedItem[];
  onOpenInventory: () => void;
  onOpenMenu: () => void;
  isMobile: boolean;
  isPlaying?: boolean;
  activeObjective?: {type: 'OBELISK' | 'BLOOD_TRIAL'; progress: number} | null;
  touchJoystickRef: React.RefObject<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    dx: number;
    dy: number;
    sprintTouch: boolean;
  }>;
}

export const HUD: React.FC<HUDProps> = ({
  currentHp,
  maxHpDisplay,
  currentStamina,
  maxStaminaDisplay,
  level,
  timer,
  killCount,
  runGold,
  xpDisplay,
  nextLevelXpDisplay,
  equippedWeapons,
  equippedPassives,
  onOpenInventory,
  onOpenMenu,
  isMobile,
  isPlaying = true,
  activeObjective,
  touchJoystickRef,
}) => {
  return (
    <>
      {/* --- HUD HEADER BAR --- */}
      <div className="w-full bg-[#0c0a1a]/95 backdrop-blur-md border-b border-rose-950/60 px-4 py-1.5 flex items-center justify-between z-20 shrink-0 text-xs md:text-sm">
        {/* Left: Health, Stamina & Level */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            {/* HP Bar */}
            <div className="flex items-center gap-1 font-bold text-rose-400 text-xs">
              <Heart size={14} className="fill-rose-500 text-rose-500" />
              <span>
                {currentHp}/{maxHpDisplay}
              </span>
            </div>
            {/* Stamina Bar */}
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <Zap size={13} className="fill-emerald-400 text-emerald-400" />
              <div className="w-16 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-emerald-950">
                <div
                  className="bg-emerald-400 h-full transition-all duration-100"
                  style={{
                    width: `${Math.min(100, (currentStamina / Math.max(1, maxStaminaDisplay)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sky-300 font-semibold bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
            <Sparkles size={14} />
            <span>Lv. {level}</span>
          </div>
        </div>

        {/* Center: Top-aligned XP Bar, Survival Timer & Active Objective */}
        <div className="flex-1 max-w-xs md:max-w-md mx-3 flex flex-col items-center gap-0.5">
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-sky-500 to-indigo-400 h-full transition-all duration-200"
              style={{
                width: `${Math.min(100, (xpDisplay / Math.max(1, nextLevelXpDisplay)) * 100)}%`,
              }}
            />
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span>Time: {formatTime(timer || 0)}</span>
            <span>•</span>
            <span className="text-rose-400">Kills: {killCount}</span>
          </div>
          {activeObjective && (
            <div
              className={`mt-0.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm animate-pulse ${
                activeObjective.type === 'OBELISK'
                  ? 'bg-purple-950/90 border-purple-400/80 text-purple-200'
                  : 'bg-rose-950/90 border-rose-400/80 text-rose-200'
              }`}>
              <span>
                {activeObjective.type === 'OBELISK'
                  ? `⚡ PURIFY OBELISK: ${activeObjective.progress}%`
                  : `💀 BLOOD TRIAL: ${activeObjective.progress}s REMAINING`}
              </span>
            </div>
          )}
        </div>

        {/* Right: Gold, Inventory Button & Menu Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            <Coins size={14} />
            <span>{runGold}</span>
          </div>

          <button
            onClick={onOpenInventory}
            title="Open Weapon Selling Sheet (Tab / I / Gamepad Y)"
            className="min-w-[40px] min-h-[36px] bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-700/60 flex items-center gap-1 text-xs font-bold transition-colors">
            <Sword size={14} />
            <span className="hidden sm:inline">Sell</span>
          </button>

          <button
            onClick={onOpenMenu}
            className="min-w-[40px] min-h-[36px] bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded-md border border-slate-600 transition-colors flex items-center justify-center"
            title="Menu (Esc / Start)">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* --- Active Weapon & Relic Dock --- */}
      <div className="w-full bg-[#0a0814]/80 px-4 py-1 flex items-center justify-between border-b border-slate-800/40 text-[11px] z-10 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Weapons:</span>
          {equippedWeapons.map((wep) => {
            const def = ITEM_DEFS[wep.id];
            return (
              <div
                key={wep.id}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                  def?.isFusion
                    ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                    : def?.isEvolution
                    ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                    : 'bg-slate-900/80 border-indigo-500/40 text-slate-200'
                }`}>
                <img src={def?.icon || ''} alt={def?.name || ''} className="w-3.5 h-3.5 object-contain" />
                <span className="font-medium truncate max-w-[90px]">{def?.name || wep.id}</span>
                <span className="text-amber-400 font-bold text-[10px]">
                  {def?.isEvolution ? 'EVO' : `L${wep.level}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Relics:</span>
          {equippedPassives.map((pas) => {
            const def = ITEM_DEFS[pas.id];
            return (
              <div
                key={pas.id}
                className="flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded border border-emerald-500/40">
                <img src={def?.icon || ''} alt={def?.name || ''} className="w-3.5 h-3.5 object-contain" />
                <span className="text-slate-200 font-medium truncate max-w-[80px]">{def?.name || pas.id}</span>
                <span className="text-emerald-400 font-bold text-[10px]">L{pas.level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MOBILE VIRTUAL CONTROLS --- */}
      {isMobile && isPlaying && (
        <div className="absolute inset-0 pointer-events-none z-30 flex justify-between items-end p-6">
          {/* Virtual Touch Joystick (Bottom Left) */}
          <div
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              if (touchJoystickRef.current) {
                touchJoystickRef.current.active = true;
                touchJoystickRef.current.startX = cx;
                touchJoystickRef.current.startY = cy;
                touchJoystickRef.current.currentX = e.clientX;
                touchJoystickRef.current.currentY = e.clientY;
                touchJoystickRef.current.dx = clamp((e.clientX - cx) / 40, -1, 1);
                touchJoystickRef.current.dy = clamp((e.clientY - cy) / 40, -1, 1);
              }
            }}
            onPointerMove={(e) => {
              if (!touchJoystickRef.current?.active) return;
              const {startX, startY} = touchJoystickRef.current;
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              const maxRad = 40;
              const mag = Math.hypot(dx, dy);
              const clampedMag = Math.min(maxRad, mag);
              const angle = Math.atan2(dy, dx);
              touchJoystickRef.current.dx = (Math.cos(angle) * clampedMag) / maxRad;
              touchJoystickRef.current.dy = (Math.sin(angle) * clampedMag) / maxRad;
            }}
            onPointerUp={() => {
              if (touchJoystickRef.current) {
                touchJoystickRef.current.active = false;
                touchJoystickRef.current.dx = 0;
                touchJoystickRef.current.dy = 0;
              }
            }}
            onPointerCancel={() => {
              if (touchJoystickRef.current) {
                touchJoystickRef.current.active = false;
                touchJoystickRef.current.dx = 0;
                touchJoystickRef.current.dy = 0;
              }
            }}
            className="w-28 h-28 rounded-full bg-slate-900/60 border-2 border-rose-500/40 pointer-events-auto flex items-center justify-center touch-none select-none shadow-lg">
            <div className="w-12 h-12 rounded-full bg-rose-500/80 shadow-md transform" />
          </div>

          {/* Mobile Right Controls: Sprint & Sell Buttons */}
          <div className="flex flex-col gap-3 pointer-events-auto">
            <button
              onPointerDown={() => {
                if (touchJoystickRef.current) touchJoystickRef.current.sprintTouch = true;
              }}
              onPointerUp={() => {
                if (touchJoystickRef.current) touchJoystickRef.current.sprintTouch = false;
              }}
              onPointerCancel={() => {
                if (touchJoystickRef.current) touchJoystickRef.current.sprintTouch = false;
              }}
              className="w-14 h-14 rounded-full bg-emerald-600/90 border-2 border-emerald-400 text-white flex flex-col items-center justify-center font-bold text-[10px] touch-none shadow-xl active:scale-95 transition-transform">
              <Zap size={18} />
              <span>SPRINT</span>
            </button>

            <button
              onClick={onOpenInventory}
              className="w-14 h-14 rounded-full bg-indigo-600/90 border-2 border-indigo-400 text-white flex flex-col items-center justify-center font-bold text-[10px] touch-none shadow-xl active:scale-95 transition-transform">
              <Sword size={18} />
              <span>SELL</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

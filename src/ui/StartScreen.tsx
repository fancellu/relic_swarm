import {Coins, HelpCircle, Play, Zap} from 'lucide-react';
import React, {useEffect, useRef} from 'react';
import {HeroData} from '../types/entities';
import {HEROES, ITEM_DEFS} from '../types/items';
import {gameAudio, MenuOverlay} from '../../utils/helper';

export function AnimatedHeroPortrait({
  imgUrl,
  color,
  isSelected,
  size = 48,
  totalFrames = 4,
  fps = 6,
}: {
  imgUrl: string;
  color: string;
  isSelected: boolean;
  size?: number;
  totalFrames?: number;
  fps?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imgUrl;

    let animId: number;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const frameIndex = Math.floor(elapsed * fps) % totalFrames;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (img.complete && img.naturalWidth > 0) {
        const fw = 512;
        const fh = 512;
        const sx = frameIndex * fw;
        const sy = 0;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, fw, fh, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    img.onload = () => {
      animId = requestAnimationFrame(render);
    };
    if (img.complete) {
      animId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [imgUrl, color, totalFrames, fps]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        imageRendering: 'pixelated',
      }}
      className="pointer-events-none"
    />
  );
}

export interface StartScreenProps {
  isOpen: boolean;
  selectedHeroIndex: number;
  onSelectHeroIndex: (idx: number) => void;
  persistentGold: number;
  onOpenSanctumShop: () => void;
  onStartGame: (heroIdx: number) => void;
  onOpenHowToPlay: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  isOpen,
  selectedHeroIndex,
  onSelectHeroIndex,
  persistentGold,
  onOpenSanctumShop,
  onStartGame,
  onOpenHowToPlay,
}) => {
  if (!isOpen) return null;

  const curHero = HEROES[selectedHeroIndex] || HEROES[0];
  const startWepDef = ITEM_DEFS[curHero.startingWeapon];
  const startPasDef = curHero.startingPassive ? ITEM_DEFS[curHero.startingPassive] : null;

  return (
    <MenuOverlay tone="neutral" zIndex={40}>
      <div className="w-full max-w-xl bg-[#0e0c1f] border-2 border-rose-900/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-5 my-auto">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-rose-400 font-bold mb-1">
            Relentless Roguelite Survival
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400">
            RELIC SWARM
          </h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-md">
            Master distinct hero archetypes, weapon fusions, and unleash divine supernovas upon the swarm.
          </p>
        </div>

        {/* Hero Selection Grid */}
        <div className="w-full flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Select Your Champion:</span>
            <span className="text-[10px] text-sky-400 font-normal">
              [A / D or D-Pad] Change Hero
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {HEROES.map((hero, idx) => {
              const isSelected = selectedHeroIndex === idx;
              return (
                <button
                  key={hero.id}
                  onClick={() => {
                    onSelectHeroIndex(idx);
                    gameAudio.playCrispClick();
                  }}
                  className={`p-2.5 rounded-xl flex flex-col items-center gap-1.5 border-2 transition-all text-center ${
                    isSelected
                      ? 'bg-rose-950/70 border-rose-500 shadow-lg shadow-rose-950/50 scale-105 ring-2 ring-rose-500/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                  }`}>
                  <div
                    className="w-14 h-14 rounded-lg bg-slate-950/90 flex items-center justify-center p-1 border overflow-hidden"
                    style={{borderColor: isSelected ? hero.color : '#334155'}}>
                    <AnimatedHeroPortrait
                      imgUrl={hero.idleSheet}
                      color={hero.color}
                      isSelected={isSelected}
                      size={48}
                      totalFrames={4}
                      fps={6}
                    />
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="font-bold text-xs text-slate-100 truncate">{hero.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{hero.title}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Hero Details Card */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg bg-slate-900 border flex items-center justify-center overflow-hidden"
                  style={{borderColor: curHero.color}}>
                  <AnimatedHeroPortrait
                    imgUrl={curHero.idleSheet}
                    color={curHero.color}
                    isSelected={true}
                    size={36}
                    totalFrames={4}
                    fps={6}
                  />
                </div>
                <div>
                  <span className="font-black text-sm" style={{color: curHero.color}}>
                    {curHero.name}
                  </span>
                  <span className="text-slate-400 text-xs ml-2">— {curHero.title}</span>
                </div>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Base HP: {curHero.baseHp}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {curHero.desc}
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                <img src={startWepDef?.icon || ''} alt="" className="w-5 h-5 object-contain shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] text-slate-500 uppercase font-semibold">Starting Weapon</div>
                  <div className="font-bold text-sky-300 truncate">{startWepDef?.name}</div>
                </div>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                {startPasDef && <img src={startPasDef.icon} alt="" className="w-5 h-5 object-contain shrink-0" />}
                <div className="min-w-0">
                  <div className="text-[9px] text-slate-500 uppercase font-semibold">Class Trait & Relic</div>
                  <div className="font-bold text-emerald-400 truncate">{curHero.statBonus}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Sanctum Gold & Meta-Shop Shortcut */}
        <div className="w-full flex items-center justify-between bg-amber-950/40 border border-amber-800/40 px-3.5 py-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Coins size={18} className="text-amber-400" />
            <span>Sanctum Vault: {persistentGold} Gold</span>
          </div>
          <button
            onClick={onOpenSanctumShop}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-md ring-1 ring-amber-300">
            <Zap size={14} className="fill-slate-950" />
            <span>Sanctum Shop [S / X]</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={() => onStartGame(selectedHeroIndex)}
            autoFocus
            className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-base md:text-lg py-3 rounded-xl shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2">
            <Play size={20} className="fill-white" />
            <span>START RUN (Enter / Space / A)</span>
          </button>

          <button
            onClick={onOpenHowToPlay}
            className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5">
            <HelpCircle size={14} />
            Gamepad, Keys & Combat Guide [H]
          </button>
        </div>
      </div>
    </MenuOverlay>
  );
};

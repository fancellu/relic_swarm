import React, {useCallback, useEffect, useRef, useState} from 'react';
import {getConfig} from './constants';
import BackgroundMusic from '../utils/BackgroundMusic';
import {
  createFixedStepper,
  gameAudio,
  GameState,
  useAssets,
  useInput,
  useIsMobile,
} from '../utils/helper';
import {usePlayground, usePlaygroundGameLifecycle, useRpc} from '../utils/usePlayground';
import {BACKGROUND_MUSIC_URL, ASSETS_MANIFEST} from './core/assets';
import {renderGame} from './core/renderer';
import {initSpriteRenderers} from './core/sprites';
import {applyChestReward, generateChestReward} from './entities/Chests';
import {applyUpgradeSelection, generateDraftChoices, sellEquippedItem} from './entities/Draft';
import {updateDrops} from './entities/Drops';
import {calculateDerivedStats, updatePlayerMovement} from './entities/Player';
import {updateProjectiles} from './entities/Projectiles';
import {updateEnemies, updateEnemySpawner} from './entities/Spawner';
import {updateWeaponCasting} from './entities/Weapons';
import {addDrop, ChestRewardData, EquippedItem, SimulationState} from './types/entities';
import {HEROES, ItemDef} from './types/items';
import {
  getStoredGold,
  getStoredMeta,
  GOLD_STORAGE_KEY,
  LEGACY_GOLD_STORAGE_KEY,
  META_STORAGE_KEY,
  META_UPGRADES,
} from './types/meta';
import {ChestModal} from './ui/ChestModal';
import {DraftModal} from './ui/DraftModal';
import {EndGameModal} from './ui/EndGameModal';
import {HowToPlayModal} from './ui/HowToPlayModal';
import {HUD} from './ui/HUD';
import {InventorySheet} from './ui/InventorySheet';
import {PauseMenu} from './ui/PauseMenu';
import {SanctumShop} from './ui/SanctumShop';
import {StartScreen} from './ui/StartScreen';

type PauseTab = 'STATS' | 'GRIMOIRE' | 'MENU';

function createSimulation(heroIndex = 0): SimulationState {
  const hero = HEROES[heroIndex] || HEROES[0];
  const weapons = [{id: hero.startingWeapon, level: 1}];
  const passives = hero.startingPassive ? [{id: hero.startingPassive, level: 1}] : [];

  return {
    hero,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 220,
    facingLeft: false,
    hp: hero.baseHp,
    maxHp: hero.baseHp,
    stamina: 100,
    maxStamina: 100,
    isSprinting: false,
    invulnTimer: 0,
    heroAnim: {currentAction: 'IDLE', currentFrame: 0, timer: 0},
    xp: 0,
    nextXp: 10,
    level: 1,
    weapons,
    passives,
    weaponTimers: {},
    weaponDamageDealt: {[hero.startingWeapon]: 0},
    enemies: [],
    projectiles: [],
    drops: [],
    particles: [],
    damageNumbers: [],
    camera: {x: 0, y: 0},
    screenShake: 0,
    spawnTimer: 0,
    runTimer: 0,
    kills: 0,
    gold: 0,
    nextEnemyId: 1,
    nextProjId: 1,
    nextDropId: 1,
    nextDmgId: 1,
    bossSpawned: false,
    bossDefeated: false,
    auraVisualAngle: 0,
    sprintParticlesTimer: 0,
    rapidRegenTimer: 0,
    bonusMaxHp: 0,
    bonusMight: 0,
    bonusSpeed: 0,
    bonusCdr: 0,
    bonusArmor: 0,
    bonusStamina: 0,
    aegisShieldTimer: 0,
    obelisk: null,
    obeliskSpawnTimer: 0,
    inObeliskZone: false,
    cursedArena: null,
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>(undefined);
  if (!stepperRef.current) {
    stepperRef.current = createFixedStepper(getConfig('stepMs'), getConfig('maxSubSteps'));
  }

  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');
  const isMobile = useIsMobile();
  const inputRef = useInput(canvasRef, true, {width: canvasWidth, height: canvasHeight});
  const spriteRenderersRef = useRef(initSpriteRenderers());
  const simRef = useRef<SimulationState>(createSimulation());

  const [gameState, setGameState] = useState<GameState>({status: 'START', score: 0, level: 1, timer: 0});
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  usePlaygroundGameLifecycle(gameState, sdk);

  const [persistentGold, setPersistentGold] = useState(getStoredGold);
  const [metaLevels, setMetaLevels] = useState<Record<string, number>>(getStoredMeta);
  const metaLevelsRef = useRef(metaLevels);
  metaLevelsRef.current = metaLevels;
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);

  const [selectedHeroIndex, setSelectedHeroIndex] = useState(0);
  const [isSanctumOpen, setIsSanctumOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [pauseTab, setPauseTab] = useState<PauseTab>('STATS');
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);
  const [chestReward, setChestReward] = useState<ChestRewardData | null>(null);
  const [choices, setChoices] = useState<ItemDef[]>([]);
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState(0);
  const [availableRerolls, setAvailableRerolls] = useState(0);
  const [sanctumFocusIndex, setSanctumFocusIndex] = useState(0);
  const [inventoryFocusIndex, setInventoryFocusIndex] = useState(0);
  const [pauseMenuFocusIndex, setPauseMenuFocusIndex] = useState(0);
  const [endScreenFocusIndex, setEndScreenFocusIndex] = useState(0);
  const [activeObjective, setActiveObjective] = useState<{type: 'OBELISK' | 'BLOOD_TRIAL'; progress: number} | null>(null);

  const [runGold, setRunGold] = useState(0);
  const [killCount, setKillCount] = useState(0);
  const [equippedWeapons, setEquippedWeapons] = useState<EquippedItem[]>([]);
  const [equippedPassives, setEquippedPassives] = useState<EquippedItem[]>([]);
  const currentHpState = useState(100);
  const currentHp = currentHpState[0];
  const setCurrentHp = currentHpState[1];
  const [maxHpDisplay, setMaxHpDisplay] = useState(100);
  const [currentStamina, setCurrentStamina] = useState(100);
  const [maxStaminaDisplay, setMaxStaminaDisplay] = useState(100);
  const [xpDisplay, setXpDisplay] = useState(0);
  const [nextLevelXpDisplay, setNextLevelXpDisplay] = useState(10);

  const equippedWeaponsRef = useRef(equippedWeapons);
  const equippedPassivesRef = useRef(equippedPassives);
  const choicesRef = useRef(choices);
  const selectedChoiceIndexRef = useRef(selectedChoiceIndex);
  const availableRerollsRef = useRef(availableRerolls);
  equippedWeaponsRef.current = equippedWeapons;
  equippedPassivesRef.current = equippedPassives;
  choicesRef.current = choices;
  selectedChoiceIndexRef.current = selectedChoiceIndex;
  availableRerollsRef.current = availableRerolls;

  const sanctumItemsRef = useRef<(HTMLDivElement | HTMLButtonElement | null)[]>([]);
  const inventoryItemsRef = useRef<(HTMLDivElement | HTMLButtonElement | null)[]>([]);
  const pauseMenuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const sanctumFocusIndexRef = useRef(0);
  const inventoryFocusIndexRef = useRef(0);
  const pauseMenuFocusIndexRef = useRef(0);
  const endScreenFocusIndexRef = useRef(0);
  endScreenFocusIndexRef.current = endScreenFocusIndex;
  const pauseScrollRef = useRef<HTMLDivElement>(null);
  const howToPlayScrollRef = useRef<HTMLDivElement>(null);
  const pauseTabRef = useRef(pauseTab);
  pauseTabRef.current = pauseTab;
  const touchJoystickRef = useRef({active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, dx: 0, dy: 0, sprintTouch: false});
  const keyboardSprintRef = useRef(false);
  const navCooldownRef = useRef(0);
  const lastGpConfirmRef = useRef(false);
  const lastGpCancelRef = useRef(false);
  const lastGpXRef = useRef(false);
  const lastGpYRef = useRef(false);
  const lastGpPauseRef = useRef(false);
  const lastKeyboardCancelRef = useRef(false);
  const runBankedRef = useRef(false);

  useEffect(() => {
    sanctumItemsRef.current[sanctumFocusIndex]?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }, [sanctumFocusIndex, isSanctumOpen]);
  useEffect(() => {
    inventoryItemsRef.current[inventoryFocusIndex]?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }, [inventoryFocusIndex, isInventoryOpen]);
  useEffect(() => {
    if (pauseTab === 'MENU') pauseMenuItemsRef.current[pauseMenuFocusIndex]?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    if (pauseScrollRef.current) pauseScrollRef.current.scrollTop = 0;
  }, [pauseMenuFocusIndex, pauseTab, isPauseOpen]);
  useEffect(() => {
    if (isHowToPlayOpen && howToPlayScrollRef.current) howToPlayScrollRef.current.scrollTop = 0;
  }, [isHowToPlayOpen]);
  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') gameAudio.playDefeatMotif();
    if (gameState.status === 'VICTORY') gameAudio.playVictoryFanfare();
  }, [gameState.status]);

  const syncEquipment = useCallback(() => {
    setEquippedWeapons([...simRef.current.weapons]);
    setEquippedPassives([...simRef.current.passives]);
  }, []);
  const syncStats = useCallback((maxHp: number, maxStamina: number) => {
    setMaxHpDisplay(maxHp);
    setMaxStaminaDisplay(maxStamina);
  }, []);
  const spawnDamageNumber = useCallback((x: number, y: number, text: string, color = '#facc15') => {
    const sim = simRef.current;
    sim.damageNumbers.push({id: sim.nextDmgId++, x: x + Math.random() * 20 - 10, y: y + Math.random() * 10 - 5, text, color, life: 0.65, maxLife: 0.65});
  }, []);
  const spawnParticles = useCallback((x: number, y: number, count = 8, color = '#e11d48', speed = 120) => {
    const sim = simRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const particleSpeed = speed * (0.4 + Math.random() * 0.8);
      sim.particles.push({x, y, vx: Math.cos(angle) * particleSpeed, vy: Math.sin(angle) * particleSpeed, life: 0.3 + Math.random() * 0.3, maxLife: 0.6, size: 3 + Math.random() * 4, color, alpha: 1});
    }
  }, []);
  const entityCallbacks = useCallback(() => ({
    onGoldChange: (gold: number) => setRunGold(gold),
    onHpChange: (hp: number) => setCurrentHp(hp),
    onStatsUpdate: syncStats,
    onWeaponsChange: (weapons: EquippedItem[]) => setEquippedWeapons(weapons),
    onPassivesChange: (passives: EquippedItem[]) => setEquippedPassives(passives),
  }), [syncStats]);

  const savePersistentData = useCallback((gold: number, meta: Record<string, number>) => {
    setPersistentGold(gold);
    setMetaLevels(meta);
    try {
      localStorage.setItem(GOLD_STORAGE_KEY, gold.toString());
      localStorage.setItem(LEGACY_GOLD_STORAGE_KEY, gold.toString());
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    } catch (error) {
      console.warn(error);
    }
  }, []);
  const bankRunGold = useCallback(() => {
    if (runBankedRef.current) return;
    const gold = simRef.current.gold;
    runBankedRef.current = true;
    if (gold <= 0) return;
    const total = getStoredGold() + gold;
    savePersistentData(total, metaLevelsRef.current);
  }, [savePersistentData]);
  const returnToStart = useCallback(() => {
    bankRunGold();
    setPersistentGold(getStoredGold());
    setActiveObjective(null);
    setIsPauseOpen(false);
    setIsInventoryOpen(false);
    setIsLevelUpOpen(false);
    setChestReward(null);
    endScreenFocusIndexRef.current = 0;
    setEndScreenFocusIndex(0);
    navCooldownRef.current = 0.4;
    lastKeyboardCancelRef.current = true;
    lastGpCancelRef.current = true;
    lastGpConfirmRef.current = true;
    gameStateRef.current = {...gameStateRef.current, status: 'START'};
    setGameState((state) => ({...state, status: 'START'}));
  }, [bankRunGold]);

  const initGame = useCallback((heroIndex = selectedHeroIndex) => {
    const sim = createSimulation(heroIndex);
    const stats = calculateDerivedStats(sim, metaLevelsRef.current);
    sim.maxHp = stats.maxHp;
    sim.hp = stats.maxHp;
    sim.maxStamina = stats.maxStamina;
    sim.stamina = stats.maxStamina;
    sim.speed = stats.speed;
    simRef.current = sim;
    runBankedRef.current = false;
    setSelectedHeroIndex(heroIndex);
    setActiveObjective(null);
    setRunGold(0);
    setKillCount(0);
    setEquippedWeapons([...sim.weapons]);
    setEquippedPassives([...sim.passives]);
    setCurrentHp(sim.hp);
    setMaxHpDisplay(sim.maxHp);
    setCurrentStamina(sim.stamina);
    setMaxStaminaDisplay(sim.maxStamina);
    setXpDisplay(0);
    setNextLevelXpDisplay(sim.nextXp);
    setAvailableRerolls(3 + (metaLevelsRef.current.rerolls || 0));
    setChoices([]);
    setChestReward(null);
    setIsSanctumOpen(false);
    setIsHowToPlayOpen(false);
    setIsInventoryOpen(false);
    setIsPauseOpen(false);
    setIsLevelUpOpen(false);
    setEndScreenFocusIndex(0);
    setGameState({status: 'PLAYING', score: 0, level: 1, timer: 0});
    gameAudio.playConfirmSelect();
    sdk?.startGame();
  }, [sdk, selectedHeroIndex]);

  const triggerLevelUp = useCallback(() => {
    gameAudio.playLevelUpStinger();
    const nextChoices = generateDraftChoices(simRef.current);
    setChoices(nextChoices);
    setSelectedChoiceIndex(0);
    setIsLevelUpOpen(true);
  }, []);
  const selectUpgrade = useCallback((item: ItemDef) => {
    applyUpgradeSelection(simRef.current, item, metaLevelsRef.current, spawnParticles, spawnDamageNumber, entityCallbacks());
    syncEquipment();
    setIsLevelUpOpen(false);
    setChestReward(null);
  }, [entityCallbacks, spawnDamageNumber, spawnParticles, syncEquipment]);
  const claimChestReward = useCallback(() => {
    const reward = chestReward;
    if (!reward) return;
    applyChestReward(simRef.current, reward, metaLevelsRef.current, spawnParticles, spawnDamageNumber, entityCallbacks());
    syncEquipment();
    setChestReward(null);
  }, [chestReward, entityCallbacks, spawnDamageNumber, spawnParticles, syncEquipment]);
  const reroll = useCallback(() => {
    if (availableRerollsRef.current <= 0) {
      gameAudio.playErrorBuzz();
      return;
    }
    setAvailableRerolls((value) => value - 1);
    setChoices(generateDraftChoices(simRef.current));
    setSelectedChoiceIndex(0);
    gameAudio.playCrispClick();
  }, []);
  const sellItem = useCallback((itemId: string) => {
    sellEquippedItem(simRef.current, itemId, metaLevelsRef.current, entityCallbacks());
    syncEquipment();
    if (isLevelUpOpen) setChoices(generateDraftChoices(simRef.current));
  }, [entityCallbacks, isLevelUpOpen, syncEquipment]);
  const openInventory = useCallback(() => {
    inventoryFocusIndexRef.current = 0;
    setInventoryFocusIndex(0);
    setIsInventoryOpen(true);
    gameAudio.playCrispClick();
  }, []);
  const openSanctum = useCallback(() => {
    setPersistentGold(getStoredGold());
    sanctumFocusIndexRef.current = 0;
    setSanctumFocusIndex(0);
    setIsSanctumOpen(true);
    gameAudio.playCrispClick();
  }, []);
  const buyMetaUpgrade = useCallback((upgradeId: string) => {
    const upgrade = META_UPGRADES[upgradeId];
    const level = metaLevelsRef.current[upgradeId] || 0;
    const cost = upgrade.costBase + level * upgrade.costStep;
    const storedGold = getStoredGold();
    if (level >= upgrade.maxLevel || storedGold < cost) {
      gameAudio.playErrorBuzz();
      return;
    }
    savePersistentData(storedGold - cost, {...metaLevelsRef.current, [upgradeId]: level + 1});
    gameAudio.playConfirmSelect();
  }, [savePersistentData]);
  const triggerPauseMenuAction = useCallback((index: number) => {
    if (index === 0) setIsPauseOpen(false);
    else if (index === 1) openInventory();
    else if (index === 2) setMusicMuted((value) => !value);
    else if (index === 3) setSfxMuted(gameAudio.toggleMute());
    else if (index === 4) setIsHowToPlayOpen(true);
    else if (index === 5) initGame();
    else if (index === 6) returnToStart();
    gameAudio.playCrispClick();
  }, [initGame, openInventory, returnToStart]);

  const update = useCallback((dt: number) => {
    const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const gamepad = gamepads[0] || gamepads[1] || null;
    let gpX = 0;
    let gpY = 0;
    let confirm = false;
    let cancel = false;
    let xPressed = false;
    let yPressed = false;
    let navUp = false;
    let navDown = false;
    let navLeft = false;
    let navRight = false;
    const pausePressed = Boolean(gamepad?.buttons[9]?.pressed);
    if (gamepad) {
      gpX = Math.abs(gamepad.axes[0] || 0) > 0.25 ? gamepad.axes[0] : 0;
      gpY = Math.abs(gamepad.axes[1] || 0) > 0.25 ? gamepad.axes[1] : 0;
      if (gamepad.buttons[14]?.pressed) gpX = -1;
      if (gamepad.buttons[15]?.pressed) gpX = 1;
      if (gamepad.buttons[12]?.pressed) gpY = -1;
      if (gamepad.buttons[13]?.pressed) gpY = 1;
      confirm = Boolean(gamepad.buttons[0]?.pressed);
      cancel = Boolean(gamepad.buttons[1]?.pressed);
      xPressed = Boolean(gamepad.buttons[2]?.pressed);
      yPressed = Boolean(gamepad.buttons[3]?.pressed);
      navUp = gpY < -0.45;
      navDown = gpY > 0.45;
      navLeft = gpX < -0.45 || Boolean(gamepad.buttons[4]?.pressed);
      navRight = gpX > 0.45 || Boolean(gamepad.buttons[5]?.pressed);
    }
    const rightStickY = Math.abs(gamepad?.axes[3] || 0) > 0.2 ? (gamepad?.axes[3] || 0) : 0;

    const confirmJustPressed = confirm && !lastGpConfirmRef.current;
    const cancelJustPressed = cancel && !lastGpCancelRef.current;
    const xJustPressed = xPressed && !lastGpXRef.current;
    const yJustPressed = yPressed && !lastGpYRef.current;
    const pauseJustPressed = pausePressed && !lastGpPauseRef.current;

    lastGpConfirmRef.current = confirm;
    lastGpCancelRef.current = cancel;
    lastGpXRef.current = xPressed;
    lastGpYRef.current = yPressed;
    lastGpPauseRef.current = pausePressed;

    navCooldownRef.current -= dt;
    if (pauseJustPressed && navCooldownRef.current <= 0 && gameStateRef.current.status === 'PLAYING') {
      setIsPauseOpen((value) => !value);
      navCooldownRef.current = 0.3;
      gameAudio.playCrispClick();
    }

    if (gameStateRef.current.status === 'START') {
      if (isSanctumOpen) {
        const total = Object.keys(META_UPGRADES).length + 1;
        if (navCooldownRef.current <= 0 && navUp) {
          sanctumFocusIndexRef.current = (sanctumFocusIndexRef.current + total - 1) % total;
          setSanctumFocusIndex(sanctumFocusIndexRef.current);
          navCooldownRef.current = 0.2;
        } else if (navCooldownRef.current <= 0 && navDown) {
          sanctumFocusIndexRef.current = (sanctumFocusIndexRef.current + 1) % total;
          setSanctumFocusIndex(sanctumFocusIndexRef.current);
          navCooldownRef.current = 0.2;
        } else if (confirmJustPressed) {
          const values = Object.values(META_UPGRADES);
          sanctumFocusIndexRef.current < values.length
            ? buyMetaUpgrade(values[sanctumFocusIndexRef.current].id)
            : setIsSanctumOpen(false);
          navCooldownRef.current = 0.3;
        } else if (cancelJustPressed) {
          setIsSanctumOpen(false);
        }
      } else if (isHowToPlayOpen) {
        if (confirmJustPressed || cancelJustPressed) {
          setIsHowToPlayOpen(false);
          navCooldownRef.current = 0.3;
        } else {
          let scrollY = 0;
          if (Math.abs(rightStickY) > 0.2) scrollY = rightStickY * 700 * dt;
          else if (navUp || gpY < -0.3) scrollY = -700 * dt;
          else if (navDown || gpY > 0.3) scrollY = 700 * dt;
          if (scrollY !== 0 && howToPlayScrollRef.current) {
            howToPlayScrollRef.current.scrollTop += scrollY;
          }
        }
      } else if (navCooldownRef.current <= 0) {
        if (navLeft) {
          setSelectedHeroIndex((index) => (index + HEROES.length - 1) % HEROES.length);
          navCooldownRef.current = 0.2;
        } else if (navRight) {
          setSelectedHeroIndex((index) => (index + 1) % HEROES.length);
          navCooldownRef.current = 0.2;
        } else if (confirmJustPressed) {
          navCooldownRef.current = 0.3;
          initGame();
        } else if (xJustPressed || yJustPressed) {
          openSanctum();
        }
      }
      return;
    }

    if (gameStateRef.current.status === 'GAME_OVER' || gameStateRef.current.status === 'VICTORY') {
      if (navCooldownRef.current <= 0 && (navUp || navLeft)) {
        endScreenFocusIndexRef.current = 0;
        setEndScreenFocusIndex(0);
        navCooldownRef.current = 0.2;
      } else if (navCooldownRef.current <= 0 && (navDown || navRight)) {
        endScreenFocusIndexRef.current = 1;
        setEndScreenFocusIndex(1);
        navCooldownRef.current = 0.2;
      } else if (confirmJustPressed) {
        navCooldownRef.current = 0.4;
        if (endScreenFocusIndexRef.current === 0) initGame();
        else returnToStart();
      } else if (cancelJustPressed) {
        navCooldownRef.current = 0.4;
        returnToStart();
      }
      return;
    }

    if (chestReward) {
      if (confirmJustPressed || cancelJustPressed) claimChestReward();
      return;
    }

    if (isLevelUpOpen) {
      if (navCooldownRef.current <= 0 && navUp) {
        setSelectedChoiceIndex((index) => (index + choicesRef.current.length - 1) % choicesRef.current.length);
        navCooldownRef.current = 0.2;
      } else if (navCooldownRef.current <= 0 && navDown) {
        setSelectedChoiceIndex((index) => (index + 1) % choicesRef.current.length);
        navCooldownRef.current = 0.2;
      } else if (confirmJustPressed) {
        selectUpgrade(choicesRef.current[selectedChoiceIndexRef.current]);
      } else if (yJustPressed) {
        reroll();
      } else if (xJustPressed) {
        openInventory();
      }
      return;
    }

    if (isInventoryOpen) {
      const totalItems = equippedWeaponsRef.current.length + equippedPassivesRef.current.length + 1;
      if (navCooldownRef.current <= 0 && navUp) {
        inventoryFocusIndexRef.current = (inventoryFocusIndexRef.current + totalItems - 1) % totalItems;
        setInventoryFocusIndex(inventoryFocusIndexRef.current);
        navCooldownRef.current = 0.2;
      } else if (navCooldownRef.current <= 0 && navDown) {
        inventoryFocusIndexRef.current = (inventoryFocusIndexRef.current + 1) % totalItems;
        setInventoryFocusIndex(inventoryFocusIndexRef.current);
        navCooldownRef.current = 0.2;
      } else if (confirmJustPressed) {
        const weaponCount = equippedWeaponsRef.current.length;
        const passiveCount = equippedPassivesRef.current.length;
        const index = inventoryFocusIndexRef.current;
        if (index < weaponCount) sellItem(equippedWeaponsRef.current[index].id);
        else if (index < weaponCount + passiveCount) sellItem(equippedPassivesRef.current[index - weaponCount].id);
        else setIsInventoryOpen(false);
        navCooldownRef.current = 0.3;
      } else if (cancelJustPressed || yJustPressed) {
        setIsInventoryOpen(false);
        navCooldownRef.current = 0.3;
      }
      return;
    }

    if (isPauseOpen) {
      if (cancelJustPressed) {
        setIsPauseOpen(false);
      } else if (navCooldownRef.current <= 0 && navLeft) {
        setPauseTab((tab) => (tab === 'STATS' ? 'MENU' : tab === 'GRIMOIRE' ? 'STATS' : 'GRIMOIRE'));
        navCooldownRef.current = 0.25;
      } else if (navCooldownRef.current <= 0 && navRight) {
        setPauseTab((tab) => (tab === 'STATS' ? 'GRIMOIRE' : tab === 'GRIMOIRE' ? 'MENU' : 'STATS'));
        navCooldownRef.current = 0.25;
      } else if (yJustPressed) {
        openInventory();
      } else if (pauseTabRef.current === 'MENU') {
        if (navCooldownRef.current <= 0 && navUp) {
          pauseMenuFocusIndexRef.current = (pauseMenuFocusIndexRef.current + 6) % 7;
          setPauseMenuFocusIndex(pauseMenuFocusIndexRef.current);
          navCooldownRef.current = 0.2;
        } else if (navCooldownRef.current <= 0 && navDown) {
          pauseMenuFocusIndexRef.current = (pauseMenuFocusIndexRef.current + 1) % 7;
          setPauseMenuFocusIndex(pauseMenuFocusIndexRef.current);
          navCooldownRef.current = 0.2;
        } else if (confirmJustPressed) {
          triggerPauseMenuAction(pauseMenuFocusIndexRef.current);
          navCooldownRef.current = 0.3;
        }
        if (Math.abs(rightStickY) > 0.2 && pauseScrollRef.current) {
          pauseScrollRef.current.scrollTop += rightStickY * 700 * dt;
        }
      } else {
        let scrollY = 0;
        if (Math.abs(rightStickY) > 0.2) scrollY = rightStickY * 700 * dt;
        else if (navUp || gpY < -0.3) scrollY = -700 * dt;
        else if (navDown || gpY > 0.3) scrollY = 700 * dt;
        if (scrollY !== 0 && pauseScrollRef.current) {
          pauseScrollRef.current.scrollTop += scrollY;
        }
        if (confirmJustPressed) {
          if (pauseTabRef.current === 'STATS') openInventory();
          navCooldownRef.current = 0.3;
        }
      }
      return;
    }

    // Toggle Inventory with Button Y while playing
    if (yJustPressed && navCooldownRef.current <= 0) {
      openInventory();
      navCooldownRef.current = 0.3;
      return;
    }

    const sim = simRef.current;
    const stats = calculateDerivedStats(sim, metaLevelsRef.current);
    sim.runTimer += dt;
    sim.auraVisualAngle += dt * 3;
    updatePlayerMovement(
      sim,
      inputRef.current.actions,
      touchJoystickRef.current,
      keyboardSprintRef.current,
      gpX,
      gpY,
      Boolean(gamepad?.buttons[1]?.pressed || gamepad?.buttons[6]?.pressed || gamepad?.buttons[7]?.pressed),
      stats,
      dt,
      setCurrentStamina,
      setCurrentHp,
    );
    sim.screenShake = Math.max(0, sim.screenShake - dt * 30);
    const heroRenderer = spriteRenderersRef.current[sim.hero.spriteKey];
    sim.heroAnim = heroRenderer.getNextState(sim.heroAnim, dt);
    updateWeaponCasting(sim, stats, dt, spawnDamageNumber, spawnParticles);
    updateProjectiles(sim, dt, spawnDamageNumber, spawnParticles, (damage) => setCurrentHp(Math.round(sim.hp)));
    updateEnemySpawner(sim, dt);
    let bossDefeated = false;
    const died = updateEnemies(
      sim,
      stats,
      dt,
      spriteRenderersRef.current,
      spawnDamageNumber,
      spawnParticles,
      setKillCount,
      (score) => setGameState((state) => ({...state, score: state.score + score})),
      () => {
        bossDefeated = true;
        bankRunGold();
        endScreenFocusIndexRef.current = 0;
        setEndScreenFocusIndex(0);
        navCooldownRef.current = 0.5;
        gameStateRef.current = {...gameStateRef.current, status: 'VICTORY'};
        setGameState((state) => ({...state, status: 'VICTORY'}));
      },
      () => setCurrentHp(Math.round(sim.hp)),
    );
    if (died) {
      bankRunGold();
      endScreenFocusIndexRef.current = 0;
      setEndScreenFocusIndex(0);
      navCooldownRef.current = 0.5;
      gameStateRef.current = {...gameStateRef.current, status: 'GAME_OVER'};
      setGameState((state) => ({...state, status: 'GAME_OVER'}));
      return;
    }
    if (bossDefeated) {
      return;
    }
    updateDrops(
      sim,
      stats,
      dt,
      spawnDamageNumber,
      spawnParticles,
      () => {
        setGameState((state) => ({...state, level: sim.level}));
        triggerLevelUp();
      },
      () => setChestReward(generateChestReward(sim)),
      setCurrentHp,
      setRunGold,
      (score) => setGameState((state) => ({...state, score: state.score + score})),
      (xp, nextXp) => {
        setXpDisplay(xp);
        setNextLevelXpDisplay(nextXp);
      },
    );

    // Corrupted Obelisk Mechanics: Zone Detection & Charging
    if (sim.obelisk) {
      const distToObelisk = Math.hypot(sim.x - sim.obelisk.x, sim.y - sim.obelisk.y);
      if (distToObelisk <= sim.obelisk.radius) {
        sim.inObeliskZone = true;
        sim.obelisk.charge = Math.min(100, sim.obelisk.charge + dt * 12);

        if (Math.random() < 0.25) {
          spawnParticles(sim.obelisk.x, sim.obelisk.y, 2, '#ec4899', 80);
        }

        if (sim.obelisk.charge >= 100) {
          gameAudio.playVictoryFanfare();
          sim.screenShake = 18;
          spawnDamageNumber(sim.obelisk.x, sim.obelisk.y, 'OBELISK PURIFIED!', '#f43f5e');
          spawnParticles(sim.obelisk.x, sim.obelisk.y, 50, '#ec4899', 320);

          sim.enemies.forEach((enemy) => {
            const edx = enemy.x - sim.obelisk!.x;
            const edy = enemy.y - sim.obelisk!.y;
            const edist = Math.hypot(edx, edy) || 1;
            const push = Math.max(60, 420 - edist * 0.35);
            enemy.x += (edx / edist) * push;
            enemy.y += (edy / edist) * push;
            const shockDmg = Math.round(200 * stats.mightMult);
            enemy.hp -= shockDmg;
            spawnDamageNumber(enemy.x, enemy.y, shockDmg.toString(), '#f43f5e');
          });

          if (Math.random() < 0.6) {
            addDrop(sim, {
              id: sim.nextDropId++,
              type: 'chest',
              x: sim.obelisk.x,
              y: sim.obelisk.y,
              value: 100,
              attracted: false,
            });
          } else {
            addDrop(sim, {
              id: sim.nextDropId++,
              type: 'magnet',
              x: sim.obelisk.x,
              y: sim.obelisk.y,
              value: 1,
              attracted: false,
            });
          }

          sim.obelisk = null;
          sim.inObeliskZone = false;
        }
      } else {
        sim.inObeliskZone = false;
      }
    } else {
      sim.inObeliskZone = false;
    }

    // Cursed Arena Trial Countdown & Survival Reward
    if (sim.cursedArena && sim.cursedArena.active) {
      sim.cursedArena.duration -= dt;
      if (sim.cursedArena.duration <= 0) {
        gameAudio.playVictoryFanfare();
        sim.screenShake = 15;
        spawnDamageNumber(sim.x, sim.y, 'TRIAL SURVIVED!', '#f59e0b');
        spawnParticles(sim.cursedArena.x, sim.cursedArena.y, 45, '#ef4444', 260);

        addDrop(sim, {
          id: sim.nextDropId++,
          type: 'chest',
          x: sim.x,
          y: sim.y,
          value: 150,
          attracted: false,
        });
        addDrop(sim, {
          id: sim.nextDropId++,
          type: 'gold',
          x: sim.x + 25,
          y: sim.y,
          value: Math.round(150 * stats.greedMult),
          attracted: false,
        });
        addDrop(sim, {
          id: sim.nextDropId++,
          type: 'xp_purple',
          x: sim.x - 25,
          y: sim.y,
          value: 120,
          attracted: false,
        });

        sim.cursedArena = null;
      }
    }

    // Synchronize Active Objective Banner
    if (sim.cursedArena && sim.cursedArena.active) {
      setActiveObjective({type: 'BLOOD_TRIAL', progress: Math.ceil(sim.cursedArena.duration)});
    } else if (sim.obelisk) {
      setActiveObjective({type: 'OBELISK', progress: Math.round(sim.obelisk.charge)});
    } else {
      setActiveObjective(null);
    }

    for (let i = sim.particles.length - 1; i >= 0; i--) {
      const particle = sim.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.life <= 0) sim.particles.splice(i, 1);
    }
    for (let i = sim.damageNumbers.length - 1; i >= 0; i--) {
      const damage = sim.damageNumbers[i];
      damage.life -= dt;
      damage.y -= 30 * dt;
      if (damage.life <= 0) sim.damageNumbers.splice(i, 1);
    }
    setGameState((state) => ({...state, timer: Math.floor(sim.runTimer)}));
  }, [
    bankRunGold,
    buyMetaUpgrade,
    chestReward,
    claimChestReward,
    initGame,
    isHowToPlayOpen,
    isInventoryOpen,
    isLevelUpOpen,
    isPauseOpen,
    isSanctumOpen,
    openInventory,
    openSanctum,
    reroll,
    selectUpgrade,
    spawnDamageNumber,
    spawnParticles,
    triggerLevelUp,
  ]);

  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => {
    let raf = 0;
    const frame = (time: number) => {
      const cancelPressed = inputRef.current.actions.cancel;
      if (cancelPressed && !lastKeyboardCancelRef.current) {
        if (gameStateRef.current.status === 'PLAYING') setIsPauseOpen((value) => !value);
        else if (gameStateRef.current.status === 'START') void exitChat({});
      }
      lastKeyboardCancelRef.current = cancelPressed;
      stepperRef.current?.(time, (dt) => updateRef.current(dt));
      const context = canvasRef.current?.getContext('2d');
      if (context) {
        renderGame(
          context,
          simRef.current,
          calculateDerivedStats(simRef.current, metaLevelsRef.current),
          assets as Record<string, HTMLImageElement>,
          spriteRenderersRef.current,
          canvasWidth,
          canvasHeight,
        );
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [assets, canvasHeight, canvasWidth, exitChat]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Control') keyboardSprintRef.current = true;
      if (isHowToPlayOpen) {
        if (event.key === 'Escape' || event.key === 'h' || event.key === 'H' || event.key === 'Enter') {
          event.preventDefault();
          setIsHowToPlayOpen(false);
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
          event.preventDefault();
          howToPlayScrollRef.current?.scrollBy({top: -100, behavior: 'smooth'});
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
          event.preventDefault();
          howToPlayScrollRef.current?.scrollBy({top: 100, behavior: 'smooth'});
          return;
        }
        if (event.key === 'PageUp') {
          event.preventDefault();
          howToPlayScrollRef.current?.scrollBy({top: -260, behavior: 'smooth'});
          return;
        }
        if (event.key === 'PageDown' || event.key === ' ') {
          event.preventDefault();
          howToPlayScrollRef.current?.scrollBy({top: 260, behavior: 'smooth'});
          return;
        }
        return;
      }
      if (gameStateRef.current.status === 'START') {
        if (isSanctumOpen && (event.key === 'Escape' || event.key === 'Backspace')) {
          setIsSanctumOpen(false);
          return;
        }
        if (!isSanctumOpen && !isHowToPlayOpen) {
          if (event.key === 's' || event.key === 'S') {
            event.preventDefault();
            openSanctum();
            return;
          }
          if (event.key === 'h' || event.key === 'H' || event.key === '?') {
            setIsHowToPlayOpen(true);
            return;
          }
          if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
            setSelectedHeroIndex((index) => (index + HEROES.length - 1) % HEROES.length);
            return;
          }
          if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
            setSelectedHeroIndex((index) => (index + 1) % HEROES.length);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (navCooldownRef.current > 0) return;
            initGame();
            return;
          }
        }
      }
      if (gameStateRef.current.status === 'GAME_OVER' || gameStateRef.current.status === 'VICTORY') {
        if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W' || event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
          event.preventDefault();
          endScreenFocusIndexRef.current = 0;
          setEndScreenFocusIndex(0);
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S' || event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
          event.preventDefault();
          endScreenFocusIndexRef.current = 1;
          setEndScreenFocusIndex(1);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (endScreenFocusIndexRef.current === 0) initGame();
          else returnToStart();
          return;
        }
        if (event.key === 'Escape' || event.key === 'Backspace') {
          event.preventDefault();
          returnToStart();
          return;
        }
        return;
      }
      if (chestReward && (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape')) {
        event.preventDefault();
        claimChestReward();
        return;
      }
      if (isLevelUpOpen) {
        if (/^[1-3]$/.test(event.key)) {
          selectUpgrade(choicesRef.current[Number(event.key) - 1]);
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
          setSelectedChoiceIndex((index) => (index + choicesRef.current.length - 1) % choicesRef.current.length);
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
          setSelectedChoiceIndex((index) => (index + 1) % choicesRef.current.length);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          selectUpgrade(choicesRef.current[selectedChoiceIndexRef.current]);
          return;
        }
        if (event.key === 'r' || event.key === 'R') {
          reroll();
          return;
        }
      }
      if (isInventoryOpen) {
        if (
          event.key === 'Escape' ||
          event.key === 'Backspace' ||
          event.key === 'Tab' ||
          event.key === 'i' ||
          event.key === 'I'
        ) {
          event.preventDefault();
          setIsInventoryOpen(false);
        }
        return;
      }
      if (isPauseOpen) {
        if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
          event.preventDefault();
          setIsPauseOpen(false);
          return;
        }
        if (event.key === '1') {
          setPauseTab('STATS');
          return;
        }
        if (event.key === '2') {
          setPauseTab('GRIMOIRE');
          return;
        }
        if (event.key === '3') {
          setPauseTab('MENU');
          return;
        }
        if (event.key === 'Tab' || event.key === 'i' || event.key === 'I') {
          event.preventDefault();
          openInventory();
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'q' || event.key === 'Q') {
          event.preventDefault();
          setPauseTab((tab) => (tab === 'STATS' ? 'MENU' : tab === 'GRIMOIRE' ? 'STATS' : 'GRIMOIRE'));
          return;
        }
        if (event.key === 'ArrowRight' || event.key === 'e' || event.key === 'E') {
          event.preventDefault();
          setPauseTab((tab) => (tab === 'STATS' ? 'GRIMOIRE' : tab === 'GRIMOIRE' ? 'MENU' : 'STATS'));
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
          event.preventDefault();
          if (pauseTabRef.current === 'MENU') {
            pauseMenuFocusIndexRef.current = (pauseMenuFocusIndexRef.current + 6) % 7;
            setPauseMenuFocusIndex(pauseMenuFocusIndexRef.current);
          } else if (pauseScrollRef.current) {
            pauseScrollRef.current.scrollBy({top: -100, behavior: 'smooth'});
          }
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
          event.preventDefault();
          if (pauseTabRef.current === 'MENU') {
            pauseMenuFocusIndexRef.current = (pauseMenuFocusIndexRef.current + 1) % 7;
            setPauseMenuFocusIndex(pauseMenuFocusIndexRef.current);
          } else if (pauseScrollRef.current) {
            pauseScrollRef.current.scrollBy({top: 100, behavior: 'smooth'});
          }
          return;
        }
        if (event.key === 'PageUp') {
          event.preventDefault();
          pauseScrollRef.current?.scrollBy({top: -260, behavior: 'smooth'});
          return;
        }
        if (event.key === 'PageDown') {
          event.preventDefault();
          pauseScrollRef.current?.scrollBy({top: 260, behavior: 'smooth'});
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          pauseScrollRef.current?.scrollTo({top: 0, behavior: 'smooth'});
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          pauseScrollRef.current?.scrollTo({top: 99999, behavior: 'smooth'});
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          if (pauseTabRef.current === 'MENU') {
            event.preventDefault();
            triggerPauseMenuAction(pauseMenuFocusIndexRef.current);
          } else if (pauseTabRef.current === 'STATS') {
            event.preventDefault();
            openInventory();
          }
          return;
        }
        return;
      }
      if (gameStateRef.current.status === 'PLAYING') {
        if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
          event.preventDefault();
          setIsPauseOpen(true);
        } else if (event.key === 'Tab' || event.key === 'i' || event.key === 'I') {
          event.preventDefault();
          openInventory();
        }
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Control') keyboardSprintRef.current = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [
    chestReward,
    claimChestReward,
    initGame,
    isHowToPlayOpen,
    isInventoryOpen,
    isLevelUpOpen,
    isPauseOpen,
    isSanctumOpen,
    openInventory,
    openSanctum,
    reroll,
    returnToStart,
    selectUpgrade,
  ]);

  const stats = calculateDerivedStats(simRef.current, metaLevels);
  // Pausing playback does not change the player's persistent music-muted preference.
  // Closing the pause menu therefore restores BGM only when it was previously enabled.
  const musicPlaying = gameState.status === 'PLAYING' && !isPauseOpen && !musicMuted;
  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-center bg-[#07050e] text-white font-sans select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950 text-xl font-bold tracking-wider text-rose-400 animate-pulse">
          Summoning Relics & Swarms...
        </div>
      )}
      <BackgroundMusic url={BACKGROUND_MUSIC_URL} isPlaying={musicPlaying} isMuted={musicMuted} />
      <HUD
        currentHp={currentHp}
        maxHpDisplay={maxHpDisplay}
        currentStamina={currentStamina}
        maxStaminaDisplay={maxStaminaDisplay}
        level={gameState.level}
        timer={gameState.timer || 0}
        killCount={killCount}
        runGold={runGold}
        xpDisplay={xpDisplay}
        nextLevelXpDisplay={nextLevelXpDisplay}
        equippedWeapons={equippedWeapons}
        equippedPassives={equippedPassives}
        onOpenInventory={openInventory}
        onOpenMenu={() => setIsPauseOpen(true)}
        isMobile={isMobile}
        isPlaying={gameState.status === 'PLAYING'}
        activeObjective={activeObjective}
        touchJoystickRef={touchJoystickRef}
      />
      {assetsReady && (
        <div className="flex-1 w-full min-h-0 flex items-center justify-center bg-black relative">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
            }}
            className="h-auto max-w-full max-h-full"
          />
        </div>
      )}
      <StartScreen
        isOpen={gameState.status === 'START'}
        selectedHeroIndex={selectedHeroIndex}
        onSelectHeroIndex={setSelectedHeroIndex}
        persistentGold={persistentGold}
        onOpenSanctumShop={openSanctum}
        onStartGame={initGame}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
      />
      <SanctumShop
        isOpen={isSanctumOpen}
        onClose={() => setIsSanctumOpen(false)}
        persistentGold={persistentGold}
        metaLevels={metaLevels}
        sanctumFocusIndex={sanctumFocusIndex}
        onSelectIndex={(index) => {
          sanctumFocusIndexRef.current = index;
          setSanctumFocusIndex(index);
        }}
        onBuyUpgrade={buyMetaUpgrade}
        sanctumItemsRef={sanctumItemsRef}
      />
      <InventorySheet
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        equippedWeapons={equippedWeapons}
        equippedPassives={equippedPassives}
        inventoryFocusIndex={inventoryFocusIndex}
        onSelectIndex={(index) => {
          inventoryFocusIndexRef.current = index;
          setInventoryFocusIndex(index);
        }}
        onSellItem={sellItem}
        inventoryItemsRef={inventoryItemsRef}
      />
      <DraftModal
        isOpen={isLevelUpOpen}
        level={gameState.level}
        choices={choices}
        selectedChoiceIndex={selectedChoiceIndex}
        onSelectIndex={setSelectedChoiceIndex}
        onSelectUpgrade={selectUpgrade}
        equippedWeapons={equippedWeapons}
        equippedPassives={equippedPassives}
        availableRerolls={availableRerolls}
        onReroll={reroll}
        onOpenInventory={openInventory}
      />
      <ChestModal chestReward={chestReward} onClaim={claimChestReward} />
      <PauseMenu
        isOpen={isPauseOpen}
        onClose={() => setIsPauseOpen(false)}
        timer={gameState.timer || 0}
        pauseTab={pauseTab}
        setPauseTab={setPauseTab}
        stats={stats}
        currentHp={currentHp}
        maxHpDisplay={maxHpDisplay}
        equippedWeapons={equippedWeapons}
        equippedPassives={equippedPassives}
        weaponDamageDealt={simRef.current.weaponDamageDealt}
        pauseMenuFocusIndex={pauseMenuFocusIndex}
        onSelectMenuIndex={(index) => {
          pauseMenuFocusIndexRef.current = index;
          setPauseMenuFocusIndex(index);
        }}
        onTriggerMenuAction={triggerPauseMenuAction}
        musicMuted={musicMuted}
        sfxMuted={sfxMuted}
        pauseMenuItemsRef={pauseMenuItemsRef}
        onOpenInventory={openInventory}
        activeObjective={activeObjective}
        scrollContainerRef={pauseScrollRef}
      />
      <EndGameModal
        status={gameState.status}
        timer={gameState.timer || 0}
        killCount={killCount}
        level={gameState.level}
        score={gameState.score}
        runGold={runGold}
        persistentGold={persistentGold}
        endScreenFocusIndex={endScreenFocusIndex}
        onSelectIndex={(index) => {
          endScreenFocusIndexRef.current = index;
          setEndScreenFocusIndex(index);
        }}
        onRestart={() => initGame()}
        onReturnToMenu={returnToStart}
      />
      <HowToPlayModal isOpen={isHowToPlayOpen} onClose={() => setIsHowToPlayOpen(false)} scrollContainerRef={howToPlayScrollRef} />
    </div>
  );
}

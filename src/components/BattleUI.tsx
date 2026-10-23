import React, { useState, useEffect } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { TYPE_COLORS } from '../game/data/typesChart';
import { combatEngine } from '../game/combat/CombatEngine';
import { sound } from '../game/audio/SoundEffects';
import { Move, Item } from '../types/game';
import { battleVfx, BattleSide } from '../game/graphics/BattleVfx';
import { activeRenderer } from '../game/graphics/LuminatiRenderer';
import { FlowchainEngine } from '../game/combat/FlowchainEngine';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { Sword, Swords, Scroll, Flame, Briefcase, Users, LogOut, Sparkles, Heart, Zap, ArrowLeft, ChevronDown, ChevronUp, Shield } from 'lucide-react';

interface DamageNumberPopup {
  id: string;
  amount: number;
  side: BattleSide;
  isCrit: boolean;
  typeMultiplier: number;
  isHeal?: boolean;
  screenPos?: { x: number; y: number };
  randomOffset: { x: number; y: number };
}

const RunSilhouette: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    stroke="none"
  >
    <circle cx="15.5" cy="4.5" r="2.2" />
    <path d="M12.8 8.8L10 22h2.2l1.9-7.5 2.5 2.2v5.3h2.2v-6.8l-2.4-2.4.7-3.4c1.2.7 2.6 1.1 4.1 1.1v-2.2c-1.4 0-2.6-.5-3.5-1.5l-1.3-1.6c-.4-.5-1-.8-1.7-.8-.4 0-.7.1-1.1.2L8.2 7.2V12h2.2V8.8z" />
  </svg>
);

const getElementIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'fire':
    case 'fuego':
      return '🔥';
    case 'water':
    case 'agua':
      return '💧';
    case 'grass':
    case 'planta':
      return '🌿';
    case 'electric':
    case 'rayo':
      return '⚡';
    case 'ice':
    case 'hielo':
      return '❄️';
    case 'earth':
    case 'tierra':
      return '⛰️';
    case 'wind':
    case 'viento':
      return '🌪️';
    case 'dark':
    case 'sombra':
    case 'oscuridad':
      return '🌑';
    case 'light':
    case 'luz':
      return '☀️';
    default:
      return '✦';
  }
};

export const BattleUI: React.FC = () => {
  const state = useGameStore();
  const battle = state.battleState;

  const [activeMenu, setActiveMenu] = useState<'root' | 'moves' | 'items' | 'switch'>('root');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [shakeCount, setShakeCount] = useState<number>(0);

  // Floating jumping damage numbers & status card hit shake
  const [damagePopups, setDamagePopups] = useState<DamageNumberPopup[]>([]);
  const [hitShakeSide, setHitShakeSide] = useState<BattleSide | null>(null);

  const spawnDamagePopup = (
    side: BattleSide,
    amount: number,
    isCrit: boolean,
    typeMultiplier: number,
    isHeal = false
  ) => {
    if (amount <= 0 && !isHeal) return;

    // Trigger hit shake animation on defender status card
    if (!isHeal) {
      setHitShakeSide(side);
      setTimeout(() => setHitShakeSide(null), 450);
    }

    const screenPos = activeRenderer?.getDollScreenPosition(side) || undefined;
    const randomOffset = {
      x: (Math.random() - 0.5) * 36,
      y: (Math.random() - 0.5) * 16,
    };

    const newPopup: DamageNumberPopup = {
      id: `dmg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount,
      side,
      isCrit,
      typeMultiplier,
      isHeal,
      screenPos,
      randomOffset,
    };

    setDamagePopups(prev => [...prev, newPopup]);

    setTimeout(() => {
      setDamagePopups(prev => prev.filter(p => p.id !== newPopup.id));
    }, 1350);
  };

  // Set latest log message - MUST BE CALLED BEFORE EARLY RETURN
  useEffect(() => {
    if (battle?.log && battle.log.length > 0) {
      setCurrentMessage(battle.log[battle.log.length - 1]);
    }
  }, [battle?.log]);

  if (!battle || !battle.isActive) return null;

  const playerDoll = state.playerParty[battle.playerActiveIndex];
  const opponentDoll = battle.opponentDoll;
  if (!playerDoll || !opponentDoll) return null;

  const triggerHaptic = (ms = 15) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(ms);
      }
    } catch {
      // Haptics optional
    }
  };

  // Execute Player Move
  const handleSelectMove = async (move: Move) => {
    if (move.currentPp <= 0) {
      gameStore.showToast('¡No te quedan puntos de poder (PP) para esta habilidad!');
      return;
    }
    if (isExecuting) return;

    triggerHaptic(20);
    sound.playSelect();
    setIsExecuting(true);
    setActiveMenu('root');

    // Deduct PP
    move.currentPp--;

    // 1. Determine speed turn priority
    const playerSpeed = playerDoll.stats.spd;
    const opponentSpeed = opponentDoll.stats.spd;
    const playerFirst = (move.priority || 0) > 0 || playerSpeed >= opponentSpeed;

    // Pick random move for opponent
    const eligibleOpponentMoves = opponentDoll.moves.filter(m => m.currentPp > 0);
    const opponentMove = eligibleOpponentMoves.length > 0
      ? eligibleOpponentMoves[Math.floor(Math.random() * eligibleOpponentMoves.length)]
      : opponentDoll.moves[0];

    // Helper for executing attack
    const executeAttack = async (
      attacker: typeof playerDoll,
      defender: typeof opponentDoll,
      selectedMove: Move,
      isAttackerPlayer: boolean
    ): Promise<boolean> => {
      const announce = `¡${attacker.nickname} usó ${selectedMove.name}!`;
      battle.log.push(announce);
      setCurrentMessage(announce);
      gameStore.setState({ battleState: { ...battle } });
      await new Promise(r => setTimeout(r, 520));

      // Check Flowchain
      const fcResult = FlowchainEngine.checkFlowchain(attacker, selectedMove);
      if (fcResult.triggered && fcResult.bonusMsg) {
        battle.log.push(fcResult.bonusMsg);
      }

      // Check Shield or Mitigation move
      const tags = selectedMove.tags || [];
      if (tags.includes('Shield') || selectedMove.shieldRatio) {
        const shieldMsg = combatEngine.applyShieldMove(attacker, selectedMove.shieldRatio || 0.35);
        battle.log.push(shieldMsg);
        setCurrentMessage(shieldMsg);
        gameStore.setState({ battleState: { ...battle } });
        return false;
      }
      if (selectedMove.mitigationType || tags.includes('IronPosture') || tags.includes('ShadowStep')) {
        const mitType = selectedMove.mitigationType || (tags.includes('IronPosture') ? 'iron_posture' : 'shadow_step');
        const mitMsg = combatEngine.applyMitigationMove(attacker, mitType);
        battle.log.push(mitMsg);
        setCurrentMessage(mitMsg);
        gameStore.setState({ battleState: { ...battle } });
        return false;
      }

      // Combat resolution stays in the CombatEngine (no visual dependency).
      const res = combatEngine.calculateDamage(attacker, defender, selectedMove);
      const mitResult = combatEngine.processMoveMitigationAndShield(attacker, defender, selectedMove, res.damage);
      if (mitResult.message) {
        battle.log.push(mitResult.message);
      }
      const finalDmg = mitResult.finalDamage;
      const drained = mitResult.drainedHp;

      // Rolls that the visual layer must know about (to stay truthful).
      const statusApplied =
        selectedMove.statusEffect &&
        Math.random() * 100 < selectedMove.statusEffect.chance &&
        !defender.status
          ? selectedMove.statusEffect.condition
          : null;

      const attackerSide: BattleSide = isAttackerPlayer ? 'player' : 'opponent';
      const defenderSide: BattleSide = isAttackerPlayer ? 'opponent' : 'player';

      // The visual layer plays anticipation -> travel -> impact and resolves
      // on the impact frame, so HP is applied exactly when the hit lands.
      await battleVfx.playAttack({
        move: selectedMove,
        attacker: attackerSide,
        defender: defenderSide,
        damage: finalDmg,
        isCrit: res.isCrit,
        typeMultiplier: res.typeMultiplier,
        statusApplied,
        healedAmount: drained,
      });

      // --- Impact frame: results are applied here ---
      defender.currentHp = Math.max(0, defender.currentHp - finalDmg);
      if (finalDmg > 0 || res.typeMultiplier === 0) {
        spawnDamagePopup(defenderSide, finalDmg, res.isCrit, res.typeMultiplier, false);
      }
      if (drained > 0) {
        spawnDamagePopup(attackerSide, drained, false, 1.0, true);
        battle.log.push(`¡${attacker.nickname} drenó ${drained} HP del oponente!`);
      }

      if (res.typeMultiplier >= 2.0) {
        sound.playSuperEffective();
      } else if (res.isCrit) {
        sound.playCrit();
      } else {
        sound.playHit();
      }

      if (res.typeMultiplier >= 2.0) {
        battle.log.push('¡Es súper efectivo!');
      } else if (res.typeMultiplier > 0 && res.typeMultiplier < 1.0) {
        battle.log.push('No es muy efectivo...');
      } else if (res.typeMultiplier === 0) {
        battle.log.push('¡No tiene ningún efecto!');
      }

      if (res.isCrit) {
        battle.log.push('¡Un golpe crítico!');
      }

      if (statusApplied) {
        defender.status = statusApplied;
        battle.log.push(`¡${defender.nickname} sufre de ${statusApplied}!`);
      }

      if (drained > 0) {
        sound.playHeal();
        battle.log.push(`¡${attacker.nickname} drenó ${drained} puntos de salud!`);
      }

      setCurrentMessage(battle.log[battle.log.length - 1]);
      gameStore.setState({ battleState: { ...battle } });
      await new Promise(r => setTimeout(r, 1150));

      if (defender.currentHp <= 0) {
        battleVfx.playFaint(defenderSide);
        sound.playFaint();
        battle.log.push(`¡${defender.nickname} cayó debilitado!`);
        setCurrentMessage(`¡${defender.nickname} cayó debilitado!`);
        gameStore.setState({ battleState: { ...battle } });
        await new Promise(r => setTimeout(r, 1200));
        return true;
      }
      return false;
    };

    if (playerFirst) {
      const oppFainted = await executeAttack(playerDoll, opponentDoll, move, true);
      if (oppFainted) {
        await handleOpponentFainted();
        setIsExecuting(false);
        return;
      }

      if (opponentMove) {
        opponentMove.currentPp = Math.max(0, opponentMove.currentPp - 1);
        const playerFainted = await executeAttack(opponentDoll, playerDoll, opponentMove, false);
        if (playerFainted) {
          handlePlayerFainted();
        }
      }
    } else {
      if (opponentMove) {
        opponentMove.currentPp = Math.max(0, opponentMove.currentPp - 1);
        const playerFainted = await executeAttack(opponentDoll, playerDoll, opponentMove, false);
        if (playerFainted) {
          handlePlayerFainted();
          setIsExecuting(false);
          return;
        }
      }

      const oppFainted = await executeAttack(playerDoll, opponentDoll, move, true);
      if (oppFainted) {
        await handleOpponentFainted();
        setIsExecuting(false);
        return;
      }
    }

    setIsExecuting(false);
  };

  // Opponent defeated
  const handleOpponentFainted = async () => {
    sound.playLevelUp();
    const expRes = combatEngine.awardExp(playerDoll, opponentDoll, battle.isTrainerBattle);
    
    for (const msg of expRes.messages) {
      battle.log.push(msg);
      setCurrentMessage(msg);
      gameStore.setState({ battleState: { ...battle } });
      await new Promise(r => setTimeout(r, 1100));
    }

    if (expRes.evolutionReady) {
      await new Promise(r => setTimeout(r, 500));
      gameStore.endBattle(true);
      gameStore.startEvolutionSequence(playerDoll);
      return;
    }

    await new Promise(r => setTimeout(r, 800));
    gameStore.endBattle(true);
  };

  // Player doll fainted
  const handlePlayerFainted = () => {
    const nextAlive = state.playerParty.find(d => d.currentHp > 0);
    if (nextAlive) {
      setActiveMenu('switch');
      gameStore.showToast(`¡Elige a tu siguiente SoulDoll para continuar el combate!`);
    } else {
      battle.log.push('¡Todos tus SoulDolls han caído! Te retiras al Santuario...');
      setCurrentMessage('¡Todos tus SoulDolls han caído! Te retiras al Santuario...');
      gameStore.setState({ battleState: { ...battle } });
      setTimeout(() => {
        gameStore.healParty();
        gameStore.endBattle(false);
      }, 2500);
    }
  };

  // Attempt Capture
  const handleThrowVial = async (item: Item) => {
    if (battle.isTrainerBattle) {
      gameStore.showToast('¡No puedes capturar el SoulDoll de otro Domador!');
      return;
    }
    if (item.count <= 0) return;
    if (isExecuting) return;

    triggerHaptic(20);
    item.count--;
    sound.playSelect();
    setIsExecuting(true);
    setActiveMenu('root');

    const captureResult = combatEngine.attemptCapture(opponentDoll, item);

    for (let i = 0; i < captureResult.messages.length; i++) {
      const msg = captureResult.messages[i];
      battle.log.push(msg);
      setCurrentMessage(msg);
      if (msg.includes('vibra')) {
        sound.playVialShake();
        triggerHaptic(35);
        setShakeCount(prev => prev + 1);
      }
      gameStore.setState({ battleState: { ...battle } });
      await new Promise(r => setTimeout(r, 1100));
    }

    if (captureResult.success) {
      sound.playVialSuccess();
      await new Promise(r => setTimeout(r, 1000));
      gameStore.addCaughtSoulDoll(opponentDoll);
      gameStore.endBattle(true);
    } else {
      const oppMove = opponentDoll.moves[0];
      if (oppMove) {
        const announce = `¡${opponentDoll.nickname} contraataca furioso con ${oppMove.name}!`;
        battle.log.push(announce);
        setCurrentMessage(announce);
        gameStore.setState({ battleState: { ...battle } });
        await new Promise(r => setTimeout(r, 1000));

        const res = combatEngine.calculateDamage(opponentDoll, playerDoll, oppMove);
        await battleVfx.playAttack({
          move: oppMove,
          attacker: 'opponent',
          defender: 'player',
          damage: res.damage,
          isCrit: res.isCrit,
          typeMultiplier: res.typeMultiplier,
        });
        playerDoll.currentHp = Math.max(0, playerDoll.currentHp - res.damage);
        sound.playHit();
        if (res.damage > 0 || res.typeMultiplier === 0) {
          spawnDamagePopup('player', res.damage, res.isCrit, res.typeMultiplier, false);
        }
        gameStore.setState({ battleState: { ...battle } });
        await new Promise(r => setTimeout(r, 1000));

        if (playerDoll.currentHp <= 0) {
          handlePlayerFainted();
        }
      }
    }

    setShakeCount(0);
    setIsExecuting(false);
  };

  // Switch Active Doll
  const handleSwitchDoll = (index: number) => {
    const target = state.playerParty[index];
    if (target.currentHp <= 0) {
      gameStore.showToast('¡Ese SoulDoll está debilitado y no puede combatir!');
      return;
    }
    if (index === battle.playerActiveIndex) {
      gameStore.showToast('¡Ese SoulDoll ya está en combate!');
      return;
    }

    triggerHaptic(20);
    sound.playSelect();
    battleVfx.playRecall('player');
    battle.playerActiveIndex = index;
    battle.log.push(`¡Regresa, ${playerDoll.nickname}! ¡Adelante, ${target.nickname}!`);
    setCurrentMessage(`¡Adelante, ${target.nickname}!`);
    setActiveMenu('root');
    gameStore.setState({ battleState: { ...battle } });
  };

  // Flee
  const handleFlee = () => {
    if (battle.isTrainerBattle) {
      gameStore.showToast('¡No puedes huir de un duelo oficial de Domadores!');
      return;
    }
    triggerHaptic(20);
    sound.playSelect();
    gameStore.showToast('¡Lograste escapar con éxito del combate salvaje!');
    gameStore.endBattle(false);
  };

  const getHpColor = (cur: number, max: number) => {
    const ratio = cur / max;
    if (ratio > 0.5) return 'sd-bar-hp-ki';
    if (ratio > 0.2) return 'sd-bar-hp-caution';
    return 'sd-bar-hp-critical';
  };

  const toggleTab = (tab: 'moves' | 'items' | 'switch') => {
    triggerHaptic(15);
    sound.playSelect();
    setActiveMenu(prev => (prev === tab ? 'root' : tab));
  };

  const playerSpecies = SOULDOLL_SPECIES[playerDoll.speciesId];
  const opponentSpecies = SOULDOLL_SPECIES[opponentDoll.speciesId];
  const playerTypes = playerSpecies?.types || [playerDoll.moves[0]?.type || 'Fire'];
  const opponentTypes = opponentSpecies?.types || [opponentDoll.moves[0]?.type || 'Fire'];

  return (
    <div
      className="absolute inset-0 w-[100dvw] h-[100dvh] max-w-[100dvw] max-h-[100dvh] overflow-hidden pointer-events-none flex flex-col justify-between z-40 select-none touch-none px-1.5 min-[360px]:px-2.5 sm:px-4"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
      }}
    >
      {/* 1. TOP ORNATE BANNER & STATUS ROW */}
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-1.5 sm:gap-2 pointer-events-auto">
        {/* Top Ornate Header Bar */}
        <div className="w-full flex items-center justify-between px-0.5 sm:px-1">
          {/* Left: Tamer / Level Pill */}
          <div className="sd-battle-frame px-2 py-0.5 min-[360px]:px-2.5 min-[360px]:py-1 rounded-full flex items-center gap-1 min-[360px]:gap-1.5 text-[7px] min-[360px]:text-[8px] sm:text-[9px] font-pixel text-[#e8b84a] shadow-md">
            <span className="text-[#9b6bff]">👁️</span>
            <span className="truncate max-w-[110px] sm:max-w-none">
              {battle.isTrainerBattle ? battle.trainerName : `Nv. ${opponentDoll.level}`}
            </span>
          </div>

          {/* Center: Spire Diamond Star Ornament */}
          <div className="flex items-center gap-1 sm:gap-2 text-[#8a6a3b] shrink-0">
            <div className="h-[1px] w-3 min-[360px]:w-6 sm:w-12 bg-gradient-to-r from-transparent to-[#8a6a3b]" />
            <span className="text-[#e8b84a] text-[10px] sm:text-sm drop-shadow-[0_0_8px_rgba(232,184,74,0.8)]">✦</span>
            <div className="h-[1px] w-3 min-[360px]:w-6 sm:w-12 bg-gradient-to-l from-transparent to-[#8a6a3b]" />
          </div>

          {/* Right: Souldoll Badge */}
          <div className="sd-battle-frame px-2 py-0.5 min-[360px]:px-2.5 min-[360px]:py-1 rounded-full flex items-center gap-1 min-[360px]:gap-1.5 text-[7px] min-[360px]:text-[8px] sm:text-[9px] font-pixel text-amber-200 shadow-md">
            <Sparkles className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 text-[#e8b84a] animate-pulse" />
            <span>Souldoll</span>
          </div>
        </div>

        {/* Opponent Status Box (Aligned Left) */}
        <div
          className={`self-start sd-battle-frame p-2 min-[360px]:p-2.5 sm:p-3.5 rounded-2xl w-auto max-w-full xs:max-w-[310px] sm:max-w-xs transition-transform flex items-center gap-2 min-[360px]:gap-2.5 sm:gap-3 ${
            hitShakeSide === 'opponent' ? 'animate-shake' : 'sd-panel-enter-left'
          }`}
        >
          {/* Left Diamond Sigil (Gold Flame/Emblem) */}
          <div className="w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-9 sm:h-9 rotate-45 border-2 border-[#8a6a3b] bg-[#14101c] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(232,184,74,0.4)]">
            <div className="-rotate-45 text-[#e8b84a] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e8b84a]" />
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Name and Level */}
            <div className="flex justify-between items-center gap-1.5 mb-1 min-w-0">
              <span className="font-pixel text-[9.5px] min-[360px]:text-[11px] sm:text-xs text-[#fef08a] font-bold truncate flex-1 min-w-0 tracking-wide drop-shadow">
                {opponentDoll.nickname}
              </span>
              <span className="font-pixel text-[7px] min-[360px]:text-[8px] sm:text-[9px] bg-[#14101c] text-[#e8b84a] px-1.5 py-0.5 rounded border border-[#8a6a3b] font-bold shadow-inner shrink-0">
                Nv. {opponentDoll.level}
              </span>
            </div>

            {/* Row 2: Elemental Affinity Badges and Status */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-1 items-center">
              {opponentTypes.filter(Boolean).map((t, idx) => {
                const typeTheme = TYPE_COLORS[t!] || TYPE_COLORS.Fire;
                return (
                  <span
                    key={`opp-type-${idx}`}
                    className={`sd-badge-affinity text-[7px] min-[360px]:text-[8px] sm:text-[9px] font-pixel px-1.5 py-0.5 rounded font-bold shadow-sm flex items-center gap-0.5 min-[360px]:gap-1 transition-all ${
                      hitShakeSide === 'player' ? 'animate-affinity-flash' : ''
                    }`}
                    style={{
                      backgroundColor: typeTheme.bg,
                      color: typeTheme.text,
                    }}
                  >
                    <span>{getElementIcon(t!)}</span>
                    <span>{t}</span>
                  </span>
                );
              })}
              {opponentDoll.status && (
                <span className="text-[7px] min-[360px]:text-[8px] sm:text-[9px] font-pixel uppercase px-1.5 py-0.5 rounded bg-[#c2234b] text-white font-bold animate-pulse shadow">
                  {opponentDoll.status}
                </span>
              )}
              {opponentDoll.activeShield && opponentDoll.activeShield.amount > 0 && (
                <span className="text-[6.5px] min-[360px]:text-[7.5px] sm:text-[8px] font-pixel px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5 inline" /> {opponentDoll.activeShield.amount}
                </span>
              )}
            </div>

            {/* Row 3: HP Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-pixel text-[8px] min-[360px]:text-[9px] sm:text-[10px] text-[#5fe3d2] font-bold tracking-wider drop-shadow shrink-0 animate-ki-pulse">
                HP
              </span>
              <div className="sd-bar-track flex-1 min-w-[50px] h-2.5 sm:h-3.5 rounded-full overflow-hidden p-[1px]">
                <div
                  className={`h-full rounded-full ${getHpColor(
                    opponentDoll.currentHp,
                    opponentDoll.maxHp
                  )}`}
                  style={{ width: `${Math.max(0, Math.min(100, (opponentDoll.currentHp / opponentDoll.maxHp) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE AREA: Empty spacer for unobstructed 3D Battle Arena Stage */}
      <div className="flex-1 pointer-events-none min-h-[30px] sm:min-h-[50px]" />

      {/* 3. BOTTOM SECTION: Player Card + Dialogue/Drawer + Action Grid */}
      <div className="pointer-events-auto flex flex-col gap-2 sm:gap-2.5 w-full max-w-4xl mx-auto z-40">
        {/* Player Status Card (Aligned Right) */}
        <div
          className={`self-end sd-battle-frame p-2 min-[360px]:p-2.5 sm:p-3.5 rounded-2xl w-auto max-w-full xs:max-w-[325px] sm:max-w-sm mb-0.5 transition-transform flex items-center gap-2 min-[360px]:gap-2.5 sm:gap-3 ${
            hitShakeSide === 'player' ? 'animate-shake' : 'sd-panel-enter-right'
          }`}
        >
          {/* Left Diamond Sigil (Soul Violet with ambient luminescence) */}
          <div className="w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-9 sm:h-9 rotate-45 border-2 border-[#9b6bff] bg-[#14101c] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(155,107,255,0.45)] animate-soul-glow">
            <div className="-rotate-45 text-[#9b6bff] flex items-center justify-center">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9b6bff] drop-shadow-[0_0_6px_#9b6bff]" />
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Nickname and Level */}
            <div className="flex justify-between items-center gap-1.5 mb-1 min-w-0">
              <span className="font-pixel text-[9.5px] min-[360px]:text-[11px] sm:text-xs text-white font-bold truncate flex-1 min-w-0 tracking-wide drop-shadow">
                {playerDoll.nickname}
              </span>
              <span className="font-pixel text-[7px] min-[360px]:text-[8px] sm:text-[9px] bg-[#14101c] text-[#e8b84a] px-1.5 py-0.5 rounded border border-[#8a6a3b] font-bold shadow-inner shrink-0">
                Nv. {playerDoll.level}
              </span>
            </div>

            {/* Row 2: Elemental Affinity Badges and Buffs */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-1 items-center">
              {playerTypes.filter(Boolean).map((t, idx) => {
                const typeTheme = TYPE_COLORS[t!] || TYPE_COLORS.Fire;
                return (
                  <span
                    key={`ply-type-${idx}`}
                    className={`sd-badge-affinity text-[7px] min-[360px]:text-[8px] sm:text-[9px] font-pixel px-1.5 py-0.5 rounded font-bold shadow-sm flex items-center gap-0.5 min-[360px]:gap-1 transition-all ${
                      hitShakeSide === 'opponent' ? 'animate-affinity-flash' : ''
                    }`}
                    style={{
                      backgroundColor: typeTheme.bg,
                      color: typeTheme.text,
                    }}
                  >
                    <span>{getElementIcon(t!)}</span>
                    <span>{t}</span>
                  </span>
                );
              })}
              {playerDoll.status && (
                <span className="text-[7px] min-[360px]:text-[8px] sm:text-[9px] font-pixel uppercase px-1.5 py-0.5 rounded bg-[#c2234b] text-white font-bold animate-pulse shadow">
                  {playerDoll.status}
                </span>
              )}
              {playerDoll.activeShield && playerDoll.activeShield.amount > 0 && (
                <span className="text-[6.5px] min-[360px]:text-[7.5px] sm:text-[8px] font-pixel px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5 inline" /> {playerDoll.activeShield.amount}
                </span>
              )}
              {playerDoll.activeMitigation && (
                <span className="text-[6.5px] min-[360px]:text-[7.5px] sm:text-[8px] font-pixel px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-400">
                  {playerDoll.activeMitigation.type === 'shadow_step' ? 'Paso Sombrío' : 'Postura Férrea'}
                </span>
              )}
            </div>

            {/* Row 3: HP Bar with numbers (44/49) */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <span className="font-pixel text-[8px] min-[360px]:text-[9px] sm:text-[10px] text-[#5fe3d2] font-bold tracking-wider drop-shadow shrink-0">
                HP
              </span>
              <div className="sd-bar-track flex-1 min-w-[50px] h-2.5 sm:h-3.5 rounded-full overflow-hidden p-[1px]">
                <div
                  className={`h-full rounded-full ${getHpColor(
                    playerDoll.currentHp,
                    playerDoll.maxHp
                  )}`}
                  style={{ width: `${Math.max(0, Math.min(100, (playerDoll.currentHp / playerDoll.maxHp) * 100))}%` }}
                />
              </div>
              <span className="font-pixel text-[7px] min-[360px]:text-[8px] sm:text-[9px] text-[#fef3c7] font-bold shrink-0">
                {playerDoll.currentHp}/{playerDoll.maxHp}
              </span>
            </div>

            {/* Row 4: EXP Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-pixel text-[7px] min-[360px]:text-[7.5px] sm:text-[9px] text-[#38bdf8] font-bold tracking-wider drop-shadow shrink-0">
                EXP
              </span>
              <div className="sd-bar-track flex-1 min-w-[50px] h-1.5 sm:h-2 rounded-full overflow-hidden p-[0.5px]">
                <div
                  className="sd-bar-exp-soul h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, ((playerDoll.currentXp % 100) / 100) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. CUADRO DE MENSAJES (Cuando no hay cajón abierto) */}
        {activeMenu === 'root' && (
          <div className="sd-dialog-ornate sd-dialog-enter px-3 py-2 sm:px-4 sm:py-3 rounded-xl flex items-center justify-between min-h-[46px] sm:min-h-[58px] relative">
            <p className="font-pixel text-[8px] min-[360px]:text-[9.5px] sm:text-xs text-amber-100 leading-relaxed break-words pixelated drop-shadow pr-3">
              {currentMessage || '¿Qué orden darás a tu SoulDoll?'}
            </p>
            <span className="text-[#9b6bff] text-xs sm:text-sm drop-shadow-[0_0_8px_rgba(155,107,255,0.8)] select-none shrink-0 animate-soul-glow">
              ✦
            </span>
          </div>
        )}

        {/* Collapsible Menu Drawer (Reemplaza el espacio del mensaje para no tapar la arena) */}
        {activeMenu !== 'root' && (
          <div className="sd-dialog-ornate p-2.5 sm:p-3.5 rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200 border-2 border-[#8a6a3b]">
            {/* Header with Title and Collapse Button */}
            <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-[#8a6a3b]/50">
              <span className="font-pixel text-[8.5px] min-[360px]:text-[10px] text-[#e8b84a] font-bold flex items-center gap-1.5 drop-shadow truncate">
                {activeMenu === 'moves' && '✦ ELIGE UNA HABILIDAD:'}
                {activeMenu === 'items' && '🏺 LANZAR VIAL DE CAPTURA:'}
                {activeMenu === 'switch' && '👥 CAMBIAR SOULDOLL ACTIVO:'}
              </span>
              <button
                onClick={() => {
                  triggerHaptic(15);
                  setActiveMenu('root');
                }}
                className="sd-action-btn sd-btn-flee px-2 py-0.5 min-[360px]:px-2.5 min-[360px]:py-1 text-[8px] min-[360px]:text-[9px] flex items-center gap-1 shrink-0"
              >
                <ChevronDown className="w-3 h-3" />
                <span>PLEGAR</span>
              </button>
            </div>

            {/* TAB: MOVES (6 Slots) */}
            {activeMenu === 'moves' && (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 max-h-40 min-[360px]:max-h-48 sm:max-h-56 overflow-y-auto touch-pan-y pr-1">
                {/* Habilidades Base (1-4) */}
                {playerDoll.moves.map((move, i) => (
                  <button
                    key={`base-${i}`}
                    disabled={isExecuting || move.currentPp <= 0}
                    onClick={() => handleSelectMove(move)}
                    className="sd-action-btn text-left p-1.5 sm:p-2.5 rounded-xl bg-[#2a1f2d] hover:bg-[#3d2f40] border-[#8a6a3b] transition-all disabled:opacity-40"
                  >
                    <div className="font-pixel text-[8px] min-[360px]:text-[9px] text-[#fef08a] truncate mb-0.5">
                      [#{i + 1}] {move.name}
                    </div>
                    <div className="flex justify-between items-center text-[6.5px] min-[360px]:text-[7.5px] font-pixel">
                      <span
                        className="sd-badge-affinity px-1 py-0.5 rounded font-bold"
                        style={{
                          backgroundColor: TYPE_COLORS[move.type]?.bg || '#ef4444',
                          color: TYPE_COLORS[move.type]?.text || '#ffffff',
                        }}
                      >
                        {move.type}
                      </span>
                      <span className="text-amber-200">
                        {move.currentPp}/{move.maxPp} PP
                      </span>
                    </div>
                  </button>
                ))}

                {/* Habilidad Memoria (5) */}
                {playerDoll.memoryMove && (
                  <button
                    disabled={isExecuting || playerDoll.memoryMove.currentPp <= 0}
                    onClick={() => handleSelectMove(playerDoll.memoryMove!)}
                    className="sd-action-btn text-left p-1.5 sm:p-2.5 rounded-xl bg-[#3f2714] hover:bg-[#52341b] border-[#e8b84a] text-amber-200 transition-all disabled:opacity-40"
                  >
                    <div className="font-pixel text-[8px] min-[360px]:text-[9px] text-[#fde047] truncate mb-0.5">
                      [Memoria] {playerDoll.memoryMove.name}
                    </div>
                    <div className="flex justify-between items-center text-[6.5px] min-[360px]:text-[7.5px] font-pixel">
                      <span className="text-amber-300 font-bold">Slot 5</span>
                      <span className="text-amber-200">
                        {playerDoll.memoryMove.currentPp}/{playerDoll.memoryMove.maxPp} PP
                      </span>
                    </div>
                  </button>
                )}

                {/* Habilidad Reacción (6) */}
                {playerDoll.reactionMove && (
                  <button
                    disabled={isExecuting || playerDoll.reactionMove.currentPp <= 0}
                    onClick={() => handleSelectMove(playerDoll.reactionMove!)}
                    className="sd-action-btn text-left p-1.5 sm:p-2.5 rounded-xl bg-[#132e22] hover:bg-[#1e4433] border-[#5fe3d2] text-[#5fe3d2] transition-all disabled:opacity-40"
                  >
                    <div className="font-pixel text-[8px] min-[360px]:text-[9px] text-[#5fe3d2] truncate mb-0.5">
                      [Reacción] {playerDoll.reactionMove.name}
                    </div>
                    <div className="flex justify-between items-center text-[6.5px] min-[360px]:text-[7.5px] font-pixel">
                      <span className="text-emerald-300 font-bold">Slot 6</span>
                      <span className="text-emerald-200">
                        {playerDoll.reactionMove.currentPp}/{playerDoll.reactionMove.maxPp} PP
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* TAB: VIALS (VIAJES) */}
            {activeMenu === 'items' && (
              <div className="flex flex-col gap-1.5 max-h-40 min-[360px]:max-h-48 sm:max-h-56 overflow-y-auto touch-pan-y pr-1">
                {['animus_vial', 'great_vial', 'celestial_vial'].map((vialId) => {
                  const vial = state.inventory[vialId];
                  if (!vial || vial.count <= 0) return null;
                  return (
                    <button
                      key={vialId}
                      disabled={isExecuting || battle.isTrainerBattle}
                      onClick={() => handleThrowVial(vial)}
                      className="sd-action-btn p-2 sm:p-2.5 rounded-xl bg-[#2a1f2d] hover:bg-[#3a2b3d] border-[#8a6a3b] flex justify-between items-center text-left min-h-[46px] disabled:opacity-40"
                    >
                      <div>
                        <div className="font-pixel text-[9px] min-[360px]:text-[10px] text-[#fef08a] font-bold">
                          {vial.name}
                        </div>
                        <div className="text-[8px] text-amber-200/80 mt-0.5">{vial.description}</div>
                      </div>
                      <span className="font-pixel text-[10px] sm:text-xs text-[#e8b84a] bg-[#14101c] px-2 py-0.5 rounded border border-[#8a6a3b] ml-2 shrink-0">
                        x{vial.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* TAB: SWITCH (ALMAS) */}
            {activeMenu === 'switch' && (
              <div className="flex flex-col gap-1.5 max-h-40 min-[360px]:max-h-48 sm:max-h-56 overflow-y-auto touch-pan-y pr-1">
                {state.playerParty.map((doll, idx) => (
                  <button
                    key={doll.uuid}
                    disabled={isExecuting || doll.currentHp <= 0 || idx === battle.playerActiveIndex}
                    onClick={() => handleSwitchDoll(idx)}
                    className={`sd-action-btn p-2 sm:p-2.5 rounded-xl flex justify-between items-center text-left min-h-[46px] ${
                      idx === battle.playerActiveIndex
                        ? 'bg-[#3b2d42] border-[#e8b84a]'
                        : doll.currentHp <= 0
                        ? 'bg-[#14101c]/80 border-[#4a1525] opacity-40'
                        : 'bg-[#2a1f2d] hover:bg-[#3a2b3d] border-[#8a6a3b]'
                    }`}
                  >
                    <div>
                      <span className="font-pixel text-[9px] min-[360px]:text-[10px] text-[#fef08a] font-bold">
                        {doll.nickname} (Nv.{doll.level})
                      </span>
                      {idx === battle.playerActiveIndex && (
                        <span className="ml-2 font-pixel text-[7.5px] text-[#5fe3d2] font-bold">[ACTIVO]</span>
                      )}
                    </div>
                    <span className="font-pixel text-[8px] sm:text-[9px] text-amber-200 font-bold">
                      {doll.currentHp}/{doll.maxHp} HP
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. BOTONES INFERIORES: 4-Column Grid with Antique Metal Framing & Thematic Chromatic Hierarchy */}
        <div className="grid grid-cols-4 gap-1.5 min-[360px]:gap-2 sm:gap-3 w-full">
          {/* LUCHAR: Carmesí */}
          <button
            disabled={isExecuting}
            onClick={() => toggleTab('moves')}
            className={`sd-action-btn sd-btn-fight min-h-[48px] min-[360px]:min-h-[54px] sm:min-h-[62px] text-[7px] min-[360px]:text-[8px] sm:text-[10px] md:text-xs flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 p-1 min-[360px]:p-1.5 ${
              activeMenu === 'moves' ? 'active-tab' : ''
            }`}
          >
            <Swords className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-rose-200 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
            <span className="tracking-tighter min-[360px]:tracking-tight font-extrabold">LUCHAR</span>
          </button>

          {/* VIAJES: Oro / Pergamino / Bronce */}
          <button
            disabled={isExecuting}
            onClick={() => toggleTab('items')}
            className={`sd-action-btn sd-btn-travel min-h-[48px] min-[360px]:min-h-[54px] sm:min-h-[62px] text-[7px] min-[360px]:text-[8px] sm:text-[10px] md:text-xs flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 p-1 min-[360px]:p-1.5 ${
              activeMenu === 'items' ? 'active-tab' : ''
            }`}
          >
            <Scroll className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-amber-200 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
            <span className="tracking-tighter min-[360px]:tracking-tight font-extrabold">VIAJES</span>
          </button>

          {/* ALMAS: Violeta / Llama de Espíritu */}
          <button
            disabled={isExecuting}
            onClick={() => toggleTab('switch')}
            className={`sd-action-btn sd-btn-souls min-h-[48px] min-[360px]:min-h-[54px] sm:min-h-[62px] text-[7px] min-[360px]:text-[8px] sm:text-[10px] md:text-xs flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 p-1 min-[360px]:p-1.5 ${
              activeMenu === 'switch' ? 'active-tab' : ''
            }`}
          >
            <Flame className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-purple-200 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-soul-glow" />
            <span className="tracking-tighter min-[360px]:tracking-tight font-extrabold">ALMAS</span>
          </button>

          {/* HUIR: Turquesa / Azul Oscuro / Corredor */}
          <button
            disabled={isExecuting}
            onClick={handleFlee}
            className="sd-action-btn sd-btn-flee min-h-[48px] min-[360px]:min-h-[54px] sm:min-h-[62px] text-[7px] min-[360px]:text-[8px] sm:text-[10px] md:text-xs flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 p-1 min-[360px]:p-1.5"
          >
            <RunSilhouette className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-[#5fe3d2] shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
            <span className="tracking-tighter min-[360px]:tracking-tight font-extrabold">HUIR</span>
          </button>
        </div>

        {/* Center Golden/Cyan Diamond Crest Ornament underneath buttons */}
        <div className="flex items-center justify-center -mt-1 select-none pointer-events-none">
          <div className="flex items-center gap-2 text-[#8a6a3b]">
            <span className="text-[10px] text-[#e8b84a]">✦</span>
            <div className="w-3.5 h-3.5 rotate-45 border border-[#8a6a3b] bg-[#14101c] flex items-center justify-center shadow-[0_0_8px_rgba(95,227,210,0.7)] animate-ki-pulse">
              <div className="w-1.5 h-1.5 bg-[#5fe3d2]" />
            </div>
            <span className="text-[10px] text-[#e8b84a]">✦</span>
          </div>
        </div>
      </div>

      {/* 4. FLOATING BOUNCING DAMAGE NUMBERS OVERLAY */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {damagePopups.map((popup) => {
          const baseLeft = popup.screenPos
            ? `${popup.screenPos.x + popup.randomOffset.x}px`
            : popup.side === 'player'
            ? '32%'
            : '66%';
          const baseTop = popup.screenPos
            ? `${popup.screenPos.y + popup.randomOffset.y}px`
            : popup.side === 'player'
            ? '58%'
            : '34%';

          const isEffective = popup.typeMultiplier >= 2.0;
          const isResisted = popup.typeMultiplier > 0 && popup.typeMultiplier < 1.0;
          const isImmune = popup.typeMultiplier === 0;

          return (
            <div
              key={popup.id}
              className={`absolute flex flex-col items-center justify-center select-none pointer-events-none will-change-transform ${
                popup.isCrit ? 'animate-crit-bounce' : 'animate-damage-bounce'
              }`}
              style={{ left: baseLeft, top: baseTop }}
            >
              {/* Optional Crit / Super Effective Tag Badge */}
              {popup.isCrit && (
                <div className="font-pixel text-[9px] sm:text-[10px] text-amber-300 font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/85 border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.95)] mb-1 animate-pulse">
                  ¡CRÍTICO!
                </div>
              )}
              {isEffective && !popup.isCrit && (
                <div className="font-pixel text-[8px] sm:text-[9px] text-orange-400 font-bold tracking-tight px-1.5 py-0.5 rounded-md bg-black/80 border border-orange-500/80 mb-1">
                  ¡EFICAZ!
                </div>
              )}
              {isResisted && !popup.isCrit && (
                <div className="font-pixel text-[8px] sm:text-[9px] text-slate-300 font-semibold tracking-tight px-1.5 py-0.5 rounded-md bg-black/70 border border-slate-600/70 mb-1">
                  RESISTIDO
                </div>
              )}

              {/* Main Jumping / Bouncing Damage Number */}
              <div
                className={`font-pixel flex items-center font-bold tracking-tighter ${
                  popup.isHeal
                    ? 'text-emerald-400 text-2xl sm:text-3xl'
                    : popup.isCrit
                    ? 'text-amber-300 text-3xl sm:text-4xl'
                    : isEffective
                    ? 'text-orange-400 text-2xl sm:text-3xl'
                    : isResisted
                    ? 'text-slate-300 text-lg sm:text-xl'
                    : isImmune
                    ? 'text-slate-400 text-base sm:text-lg'
                    : 'text-rose-400 text-2xl sm:text-3xl'
                }`}
                style={{
                  WebkitTextStroke: popup.isCrit
                    ? '1.8px #78350f'
                    : popup.isHeal
                    ? '1.5px #064e3b'
                    : isResisted
                    ? '1.2px #1e293b'
                    : '1.5px #450a0a',
                  filter: popup.isCrit
                    ? 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.95)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.95))'
                    : popup.isHeal
                    ? 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.9)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.95))'
                    : 'drop-shadow(0 0 10px rgba(225, 29, 72, 0.85)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.95))',
                }}
              >
                <span>
                  {popup.isHeal ? '+' : '-'}
                  {isImmune ? '0' : popup.amount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

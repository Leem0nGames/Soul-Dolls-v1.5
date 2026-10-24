import React, { useState, useEffect } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { sound } from '../game/audio/SoundEffects';
import { combatEngine } from '../game/combat/CombatEngine';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle } from 'lucide-react';
import { GameCabinetModal } from './ui/GameCabinetModal';
import { SoulDollSprite } from './ui/SoulDollSprite';

export const EvolutionModal: React.FC = () => {
  const state = useGameStore();
  const doll = state.evolutionCandidate;

  const [step, setStep] = useState<'anticipation' | 'ascending' | 'complete'>('anticipation');
  const [spriteToggle, setSpriteToggle] = useState(false);
  const [evoMousePos, setEvoMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (state.view !== 'EVOLUTION' || !doll) return;

    sound.playEvolution();
    setStep('anticipation');

    // 1. Anticipation phase (0s - 2s)
    const t1 = setTimeout(() => {
      setStep('ascending');
    }, 2000);

    // 2. Ascending phase with rapid Pokémon-style sprite flashing (2s - 4.5s)
    const flashInterval = setInterval(() => {
      setSpriteToggle(prev => !prev);
    }, 120);

    // 3. Complete phase (4.5s)
    const t2 = setTimeout(() => {
      clearInterval(flashInterval);
      setStep('complete');
      sound.playLevelUp();
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#fef08a'],
      });

      // Perform actual evolution mutation on doll instance
      combatEngine.evolveSoulDoll(doll);
      // Register seen & caught in store immutably
      const currentCaught = new Set(gameStore.getState().caughtSoulDolls);
      const currentSeen = new Set(gameStore.getState().seenSoulDolls);
      currentCaught.add(doll.speciesId);
      currentSeen.add(doll.speciesId);
      gameStore.setState({ caughtSoulDolls: currentCaught, seenSoulDolls: currentSeen });
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(flashInterval);
    };
  }, [state.view, doll?.uuid]);

  if (state.view !== 'EVOLUTION' || !doll) return null;

  const currentSpecies = SOULDOLL_SPECIES[doll.speciesId];
  // Note: if evolution already completed, doll.speciesId is already evolved species
  const targetSpeciesId = currentSpecies?.evolution?.evolvesInto || doll.speciesId;
  const targetSpecies = SOULDOLL_SPECIES[targetSpeciesId] || currentSpecies;

  return (
    <GameCabinetModal
      title={step === 'complete' ? 'METAMORFOSIS COMPLETADA' : 'ASCENSIÓN DEL ALMA'}
      subtitle={`Evolución de ${doll.nickname}`}
      icon={<Sparkles className="w-4 h-4 text-amber-300 animate-spin" />}
      onClose={() => {
        gameStore.setState({ evolutionCandidate: null });
        gameStore.setView('OVERWORLD');
      }}
      maxWidth="max-w-2xl"
    >
      <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-between overflow-y-auto scrollbar-thin">
        {/* Top Announcement Banner */}
        <div className="flex items-center gap-2 mb-2 bg-[#2b170c]/80 px-4 py-2 rounded-xl border border-[#8c5a2b] shadow">
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span className="font-pixel text-[10px] sm:text-xs text-amber-200 tracking-wider font-bold">
            {step === 'complete'
              ? '¡FORMA LEGENDARIA DESPERTADA!'
              : step === 'ascending'
              ? '⚡ ¡MUTACIÓN Y CAMBIO DE FORMA EN PROCESO! ⚡'
              : 'SINTONIZANDO ARMÓNICOS CÓSMICOS...'}
          </span>
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        </div>

        {/* Altar Stage with Pokémon-style Sprite Flash & Parallax */}
        <div
          className="relative w-52 h-52 sm:w-64 sm:h-64 my-3 flex items-center justify-center rounded-full bg-black/50 border-2 border-amber-600/40 shadow-inner overflow-hidden cursor-pointer"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            setEvoMousePos({ x, y });
          }}
          onMouseLeave={() => setEvoMousePos({ x: 0, y: 0 })}
          style={{
            transform: `perspective(700px) rotateX(${evoMousePos.y * -16}deg) rotateY(${evoMousePos.x * 16}deg)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* Glowing Aura Rings */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/30 via-purple-500/30 to-sky-400/30 blur-2xl transition-all duration-1000 ${
              step === 'ascending' ? 'scale-125 opacity-90 animate-pulse' : 'scale-90 opacity-40'
            }`}
          />

          {/* Creature Display */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {step === 'anticipation' && (
              <div className="flex flex-col items-center animate-bounce">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-[#14101c]/90 p-2 flex items-center justify-center border-4 border-amber-300 shadow-2xl relative">
                  <div
                    className="absolute inset-0 opacity-20 rounded-xl"
                    style={{ backgroundColor: currentSpecies.colorTheme.primary }}
                  />
                  <SoulDollSprite
                    speciesId={currentSpecies.id}
                    className="h-full w-auto max-w-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)] relative z-10"
                    alt={currentSpecies.name}
                  />
                </div>
                <span className="font-pixel text-[10px] sm:text-xs text-amber-200 mt-2 font-bold bg-[#190c06] px-2.5 py-1 rounded border border-[#7a4921]">
                  {currentSpecies.name}
                </span>
              </div>
            )}

            {step === 'ascending' && (
              <div className="relative flex flex-col items-center">
                <div className="w-36 h-36 rounded-full bg-white animate-ping opacity-60 absolute" />
                <div
                  className={`w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-[#14101c]/90 p-2 flex items-center justify-center border-4 border-white shadow-2xl transition-all duration-75 relative ${
                    spriteToggle ? 'filter brightness-200 scale-110 rotate-3' : 'filter brightness-90 scale-95 -rotate-3'
                  }`}
                >
                  <div
                    className="absolute inset-0 opacity-30 rounded-xl"
                    style={{
                      backgroundColor: spriteToggle ? targetSpecies.colorTheme.primary : currentSpecies.colorTheme.primary,
                    }}
                  />
                  <SoulDollSprite
                    speciesId={spriteToggle ? targetSpecies.id : currentSpecies.id}
                    className="h-full w-auto max-w-full drop-shadow-[0_8px_20px_rgba(255,255,255,0.8)] relative z-10"
                    alt={spriteToggle ? targetSpecies.name : currentSpecies.name}
                  />
                </div>
                <span className="font-pixel text-[10px] sm:text-xs text-amber-300 mt-2 font-bold animate-pulse">
                  {spriteToggle ? targetSpecies.name : currentSpecies.name} ...
                </span>
              </div>
            )}

            {step === 'complete' && (
              <div className="flex flex-col items-center animate-in zoom-in-75 duration-700">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-[#14101c]/90 p-2 flex items-center justify-center border-4 border-amber-300 shadow-2xl ring-4 ring-amber-500/50 relative">
                  <div
                    className="absolute inset-0 opacity-25 rounded-xl"
                    style={{ backgroundColor: targetSpecies.colorTheme.primary }}
                  />
                  <SoulDollSprite
                    speciesId={targetSpecies.id}
                    className="h-full w-auto max-w-full drop-shadow-[0_10px_25px_rgba(232,184,74,0.7)] relative z-10"
                    alt={targetSpecies.name}
                  />
                </div>
                <span className="font-pixel text-xs sm:text-sm text-amber-200 mt-2.5 font-bold bg-[#190c06] px-3 py-1.5 rounded-lg border border-amber-500/60 shadow">
                  {targetSpecies.name} (Fase {targetSpecies.stage})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="sd-brand-panel sd-brand-panel-raised w-full p-3 my-2 text-amber-100">
          <p className="font-sans text-xs sm:text-sm font-bold text-center leading-relaxed">
            {step === 'complete'
              ? `¡Tu alma compañera ha trascendido a su forma legendaria! Ha despertado un poder elemental insondable.`
              : `¡Energía ancestral fluyendo! El núcleo de ${doll.nickname} está transformando su esencia en una nueva forma...`}
          </p>
        </div>

        {/* Stat Growth Comparison Grid */}
        {step === 'complete' && (
          <div className="sd-brand-panel sd-brand-panel-surface w-full p-3 shadow-inner my-2">
            <div className="text-[10px] font-pixel text-amber-200 mb-2 font-bold uppercase tracking-wider text-center">
              ESTADÍSTICAS TRAS LA METAMORFOSIS
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-pixel">
              {[
                { label: 'HP', val: doll.maxHp },
                { label: 'ATK', val: doll.stats.atk },
                { label: 'DEF', val: doll.stats.def },
                { label: 'SP.ATK', val: doll.stats.spAtk },
                { label: 'SP.DEF', val: doll.stats.spDef },
                { label: 'SPD', val: doll.stats.spd },
              ].map((st) => (
                <div
                  key={st.label}
                  className="bg-[#14101c] p-2 rounded-lg flex justify-between items-center border border-[#8a6a3b]/60"
                >
                  <span className="text-amber-200/70 font-bold">{st.label}</span>
                  <span className="text-amber-100 font-extrabold">{st.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        {step === 'complete' && (
          <button
            onClick={() => {
              sound.playSelect();
              gameStore.setState({ evolutionCandidate: null });
              gameStore.setView('OVERWORLD');
            }}
            className="sd-brand-button sd-brand-button-primary w-full py-3 px-6 text-xs sm:text-sm flex items-center justify-center gap-2 mt-2"
          >
            <CheckCircle className="w-4 h-4 text-slate-950" />
            ¡CONTINUAR LA AVENTURA!
          </button>
        )}
      </div>
    </GameCabinetModal>
  );
};

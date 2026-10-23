import React, { useState, useEffect } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { sound } from '../game/audio/SoundEffects';
import { combatEngine } from '../game/combat/CombatEngine';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle } from 'lucide-react';
import { GameCabinetModal } from './ui/GameCabinetModal';

export const EvolutionModal: React.FC = () => {
  const state = useGameStore();
  const doll = state.evolutionCandidate;

  const [step, setStep] = useState<'anticipation' | 'ascending' | 'complete'>('anticipation');
  const [spriteToggle, setSpriteToggle] = useState(false);

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

        {/* Altar Stage with Pokémon-style Sprite Flash */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 my-3 flex items-center justify-center rounded-full bg-black/40 border-2 border-amber-600/40 shadow-inner overflow-hidden">
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
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center border-4 border-amber-300 shadow-xl"
                  style={{ backgroundColor: currentSpecies.colorTheme.primary }}
                >
                  <span className="font-pixel text-3xl text-white font-bold drop-shadow">
                    {currentSpecies.name[0]}
                  </span>
                </div>
                <span className="font-pixel text-[10px] sm:text-xs text-amber-200 mt-2 font-bold bg-[#190c06] px-2 py-0.5 rounded border border-[#7a4921]">
                  {currentSpecies.name}
                </span>
              </div>
            )}

            {step === 'ascending' && (
              <div className="relative flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-white animate-ping opacity-60 absolute" />
                <div
                  className={`w-28 h-28 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center border-4 border-white shadow-2xl transition-all duration-75 ${
                    spriteToggle ? 'filter brightness-200 scale-110 rotate-3' : 'filter brightness-75 scale-95 -rotate-3'
                  }`}
                  style={{
                    backgroundColor: spriteToggle ? targetSpecies.colorTheme.primary : currentSpecies.colorTheme.primary,
                  }}
                >
                  <span className="font-pixel text-4xl text-white font-bold drop-shadow">
                    {spriteToggle ? targetSpecies.name[0] : currentSpecies.name[0]}
                  </span>
                </div>
                <span className="font-pixel text-[10px] text-amber-300 mt-2 font-bold animate-pulse">
                  {spriteToggle ? targetSpecies.name : currentSpecies.name} ...
                </span>
              </div>
            )}

            {step === 'complete' && (
              <div className="flex flex-col items-center animate-in zoom-in-75 duration-700">
                <div
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center border-4 border-amber-300 shadow-2xl ring-4 ring-amber-500/50"
                  style={{ backgroundColor: targetSpecies.colorTheme.primary }}
                >
                  <span className="font-pixel text-3xl text-white font-bold drop-shadow">
                    {targetSpecies.name[0]}
                  </span>
                </div>
                <span className="font-pixel text-xs sm:text-sm text-amber-200 mt-2 font-bold bg-[#190c06] px-3 py-1 rounded-lg border border-amber-500/60 shadow">
                  {targetSpecies.name} (Fase {targetSpecies.stage})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Lore / Description Card (Parchment style) */}
        <div
          className="w-full p-3 rounded-xl border-2 border-[#967853] shadow-md my-2"
          style={{
            background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
            color: '#3d2514',
          }}
        >
          <p className="font-sans text-xs sm:text-sm font-bold text-center leading-relaxed">
            {step === 'complete'
              ? `¡Tu alma compañera ha trascendido a su forma legendaria! Ha despertado un poder elemental insondable.`
              : `¡Energía ancestral fluyendo! El núcleo de ${doll.nickname} está transformando su esencia en una nueva forma...`}
          </p>
        </div>

        {/* Stat Growth Comparison Grid (Parchment) */}
        {step === 'complete' && (
          <div
            className="w-full p-3 rounded-xl border-2 border-[#967853] shadow-inner my-2"
            style={{
              background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
              color: '#3d2514',
            }}
          >
            <div className="text-[10px] font-pixel text-[#6d4323] mb-2 font-bold uppercase tracking-wider text-center">
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
                  className="bg-[#ecd5b3] p-2 rounded-lg flex justify-between items-center border border-[#b8976a]"
                >
                  <span className="text-[#6d4323] font-bold">{st.label}</span>
                  <span className="text-amber-950 font-extrabold">{st.val}</span>
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
            className="w-full py-3 px-6 rounded-xl font-pixel text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 shadow-lg border-2 border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
          >
            <CheckCircle className="w-4 h-4 text-slate-950" />
            ¡CONTINUAR LA AVENTURA!
          </button>
        )}
      </div>
    </GameCabinetModal>
  );
};

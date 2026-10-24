import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { sound } from '../game/audio/SoundEffects';
import { combatEngine } from '../game/combat/CombatEngine';
import { activeRenderer } from '../game/graphics/LuminatiRenderer';
import { SoulDollSprite } from './ui/SoulDollSprite';
import { BrandButton } from './ui/BrandKit';

type EvolutionStep = 'anticipation' | 'ascending' | 'complete';

export const EvolutionModal: React.FC = () => {
  const state = useGameStore();
  const doll = state.evolutionCandidate;
  const [step, setStep] = useState<EvolutionStep>('anticipation');
  const [sourceSpeciesId, setSourceSpeciesId] = useState<string | null>(null);
  const [targetSpeciesId, setTargetSpeciesId] = useState<string | null>(null);

  useEffect(() => {
    if (state.view !== 'EVOLUTION' || !doll) return;

    const source = SOULDOLL_SPECIES[doll.speciesId];
    const targetId = source?.evolution?.evolvesInto;
    if (!source || !targetId) {
      gameStore.showToast('No se encontró una forma compatible para esta evolución.');
      gameStore.setState({ evolutionCandidate: null });
      gameStore.setView('OVERWORLD');
      return;
    }

    setSourceSpeciesId(source.id);
    setTargetSpeciesId(targetId);
    setStep('anticipation');
    activeRenderer?.beginEvolutionScene(source.id, targetId);

    const ascendingTimer = window.setTimeout(() => {
      setStep('ascending');
      activeRenderer?.setEvolutionPhase('ascending');
    }, 1800);

    const completeTimer = window.setTimeout(() => {
      setStep('complete');
      activeRenderer?.setEvolutionPhase('complete');
      sound.playLevelUp();
      confetti({
        particleCount: 180,
        spread: 120,
        startVelocity: 48,
        origin: { y: 0.58 },
        colors: ['#f59e0b', '#fef3c7', '#38bdf8', '#a78bfa', '#5fe3d2'],
      });

      const result = combatEngine.evolveSoulDoll(doll);
      if (result.success) {
        const caught = new Set(gameStore.getState().caughtSoulDolls).add(doll.speciesId);
        const seen = new Set(gameStore.getState().seenSoulDolls).add(doll.speciesId);
        gameStore.setState({ caughtSoulDolls: caught, seenSoulDolls: seen });
      }
    }, 4700);

    return () => {
      window.clearTimeout(ascendingTimer);
      window.clearTimeout(completeTimer);
    };
  }, [state.view, doll?.uuid]);

  if (state.view !== 'EVOLUTION' || !doll || !sourceSpeciesId || !targetSpeciesId) return null;

  const sourceSpecies = SOULDOLL_SPECIES[sourceSpeciesId];
  const targetSpecies = SOULDOLL_SPECIES[targetSpeciesId];
  if (!sourceSpecies || !targetSpecies) return null;

  const closeEvolution = () => {
    sound.playSelect();
    activeRenderer?.endEvolutionScene();
    gameStore.setState({ evolutionCandidate: null });
    gameStore.setView('OVERWORLD');
  };

  return (
    <div className="fixed inset-0 z-40 flex min-h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(76,29,149,0.2),rgba(8,7,20,0.4)_48%,rgba(5,5,14,0.75))] text-amber-50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,5,18,0.65),transparent_26%,transparent_66%,rgba(6,5,18,0.86))]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:repeating-linear-gradient(0deg,transparent_0px,transparent_3px,rgba(255,255,255,0.08)_4px)]" />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[max(18px,env(safe-area-inset-top))] sm:px-8">
        <div>
          <div className="flex items-center gap-2 font-pixel text-[9px] uppercase tracking-[0.28em] text-violet-200/70">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Santuario de la metamorfosis
          </div>
          <h1 className="mt-1 font-fantasy text-xl font-bold tracking-wide text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.45)] sm:text-3xl">
            {step === 'complete' ? 'Una nueva forma despierta' : 'El alma está cambiando'}
          </h1>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-amber-200/20 bg-black/30 px-3 py-2 font-pixel text-[9px] text-amber-100/70 backdrop-blur sm:flex">
          NIVEL {doll.level}
          <span className="text-amber-400">✦</span>
          FASE {sourceSpecies.stage} → {targetSpecies.stage}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-between px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pt-10">
        <div className="flex w-full max-w-3xl items-center justify-between gap-3 sm:gap-10">
          <div className={`flex min-w-0 items-center gap-2 transition-opacity duration-500 sm:gap-4 ${step === 'complete' ? 'opacity-45' : 'opacity-100'}`}>
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-amber-200/40 bg-[#17121f]/85 p-1 shadow-[0_0_24px_rgba(251,191,36,0.12)] sm:h-16 sm:w-16">
              <SoulDollSprite speciesId={sourceSpecies.id} crop="bust" className="h-full w-full object-contain" alt={sourceSpecies.name} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-pixel text-[9px] text-amber-100/60 sm:text-[10px]">FORMA ACTUAL</div>
              <div className="truncate font-fantasy text-sm font-bold text-amber-100 sm:text-lg">{sourceSpecies.name}</div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1 text-amber-300/80">
            <span className={`font-pixel text-[8px] tracking-[0.18em] ${step === 'ascending' ? 'animate-pulse text-amber-200' : ''}`}>
              {step === 'anticipation' ? 'SINTONÍA' : step === 'ascending' ? 'TRASCENDIENDO' : 'DESPERTAR'}
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((part) => (
                <span
                  key={part}
                  className={`h-1 w-3 rounded-full transition-colors duration-500 sm:w-5 ${
                    step === 'complete' || (step === 'ascending' && part < 4) || (step === 'anticipation' && part < 2)
                      ? 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className={`flex min-w-0 items-center justify-end gap-2 transition-all duration-700 sm:gap-4 ${step === 'complete' ? 'opacity-100' : 'opacity-60'}`}>
            <div className="min-w-0 text-right">
              <div className="truncate font-pixel text-[9px] text-violet-100/60 sm:text-[10px]">FORMA ASCENDIDA</div>
              <div className="truncate font-fantasy text-sm font-bold text-violet-100 sm:text-lg">{targetSpecies.name}</div>
            </div>
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-violet-200/35 bg-[#17121f]/85 p-1 shadow-[0_0_24px_rgba(139,92,246,0.18)] sm:h-16 sm:w-16">
              <SoulDollSprite speciesId={targetSpecies.id} crop="bust" className="h-full w-full object-contain" alt={targetSpecies.name} />
            </div>
          </div>
        </div>

        <div className="pointer-events-none flex flex-col items-center text-center">
          <div className={`mb-3 font-pixel text-[9px] uppercase tracking-[0.24em] transition-colors sm:text-[11px] ${step === 'complete' ? 'text-amber-200' : 'text-violet-100/75'}`}>
            {step === 'anticipation'
              ? `${doll.nickname} responde al llamado del santuario`
              : step === 'ascending'
                ? 'La energía ancestral rompe sus límites'
                : '¡La metamorfosis se ha completado!'}
          </div>
          {step === 'ascending' && (
            <div className="animate-pulse font-fantasy text-3xl font-bold tracking-[0.35em] text-white drop-shadow-[0_0_24px_rgba(196,181,253,0.95)] sm:text-5xl">
              ✦ ✦ ✦
            </div>
          )}
          {step === 'complete' && (
            <div className="animate-in zoom-in-75 duration-700 font-fantasy text-2xl font-bold text-amber-100 drop-shadow-[0_0_24px_rgba(251,191,36,0.8)] sm:text-4xl">
              {targetSpecies.name}
              <span className="ml-2 align-top font-pixel text-xs text-amber-300">FASE {targetSpecies.stage}</span>
            </div>
          )}
        </div>

        <footer className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-4">
          {step === 'complete' ? (
            <>
              <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
                {[
                  { label: 'HP', value: doll.maxHp },
                  { label: 'ATK', value: doll.stats.atk },
                  { label: 'DEF', value: doll.stats.def },
                  { label: 'SP.ATK', value: doll.stats.spAtk },
                  { label: 'SP.DEF', value: doll.stats.spDef },
                  { label: 'VEL', value: doll.stats.spd },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-amber-200/15 bg-[#110d1c]/75 px-2 py-2 text-center backdrop-blur">
                    <div className="font-pixel text-[8px] text-amber-200/55">{stat.label}</div>
                    <div className="mt-1 font-pixel text-xs font-bold text-amber-100">{stat.value}</div>
                  </div>
                ))}
              </div>
              <BrandButton onClick={closeEvolution} variant="primary" className="min-h-12 w-full max-w-sm px-6 py-3 text-xs shadow-[0_0_28px_rgba(251,191,36,0.3)]">
                <CheckCircle className="mr-2 inline h-4 w-4" />
                CONTINUAR AVENTURA
              </BrandButton>
            </>
          ) : (
            <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 font-sans text-[11px] text-violet-100/70 backdrop-blur sm:text-sm">
              {step === 'anticipation'
                ? 'El núcleo de ánima reúne su energía…'
                : 'La esencia antigua y la nueva forma se funden…'}
            </div>
          )}
        </footer>
      </main>
    </div>
  );
};

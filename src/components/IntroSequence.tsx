import React, { useEffect, useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SoulDollSprite } from './ui/SoulDollSprite';
import { sound } from '../game/audio/SoundEffects';
import { SOULDOLL_SPECIES, STARTER_SPECIES } from '../game/data/souldolls';
import type { IntroStep } from '../types/game';

/**
 * IntroSequence
 * ---------------------------------------------------------------------------
 * Opening flow: wake at home, then choose a starter at the research lab.
 *
 * The overworld renderer only accepts input once the store reaches the
 * 'gameplay' intro step (see the key handlers in App.tsx).
 */

export const IntroSequence: React.FC = () => {
  const state = useGameStore();
  const step = state.introStep;
  const [highlight, setHighlight] = useState(0);

  // The player wakes at home; starter selection is reserved for the lab.
  useEffect(() => {
    if (step !== 'home_wake') return;
    gameStore.setDialogue(
      'Mamá',
      '¡Por fin despiertas! La investigadora Iris te espera en el laboratorio de Villa Marionette. Allí podrás conocer a tu primer SoulDoll.\n\nSal de casa y sigue el camino hasta el edificio del laboratorio.',
      () => {
        gameStore.setIntroStep('gameplay');
      }
    );
  }, [step]);

  // Touch-first entry point: the title advances on tap; keyboard stays as a desktop fallback.
  const startIntro = () => {
    sound.playSelect();
    gameStore.setIntroStep('home_wake');
  };

  // Keyboard input for the title and the lab's starter choice.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const cur = gameStore.getState().introStep;

      if (cur === 'title') {
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startIntro();
        }
      } else if (cur === 'home_wake') {
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          gameStore.clearDialogue();
        }
      } else if (cur === 'starter_choice') {
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          setHighlight((h) => Math.min(h + 1, STARTER_SPECIES.length - 1));
          return;
        }
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
          return;
        }
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          sound.playSelect();
          gameStore.chooseStarter(STARTER_SPECIES[highlight]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, highlight]);

  const handleSelect = (speciesId: string) => {
    sound.playSelect();
    gameStore.chooseStarter(speciesId);
  };

  if (step === 'gameplay') return null;

  if (step === 'title') {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 pointer-events-auto cursor-pointer select-none touch-none"
        onClick={startIntro}
      >
        <div className="pixel-box rounded-xl border-4 border-amber-400/80 bg-slate-900/90 px-8 py-10 md:px-14 md:py-14 shadow-2xl flex flex-col items-center">
          <h1 className="font-pixel text-4xl md:text-6xl text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]">SOULDolls</h1>
          <p className="font-pixel text-[10px] md:text-xs text-slate-300 mt-3 tracking-[0.25em]">EL REINO DEL ALMA</p>
          <p className="font-pixel text-[8px] md:text-[10px] text-slate-400 mt-8 animate-pulse">PULSA PARA COMENZAR</p>
        </div>
      </div>
    );
  }

  if (step === 'starter_choice') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 pointer-events-auto">
        <div className="min-h-full flex flex-col items-center justify-center py-6">
        <h2 className="font-pixel text-xl md:text-2xl text-amber-300 mb-2">ELIGE TU SOULDOLL INICIAL</h2>
        <p className="font-pixel text-[8px] md:text-[10px] text-slate-400 mb-8">ESCOGE A TU PRIMER COMPAÑERO EN EL LABORATORIO</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl px-4">
          {STARTER_SPECIES.map((id, idx) => {
            const sp = SOULDOLL_SPECIES[id];
            const active = state.selectedStarterId === id;
            return (
              <button
                key={id}
                onPointerDown={() => setHighlight(idx)}
                onClick={() => handleSelect(id)}
                className={`pixel-box flex flex-col items-center gap-1 rounded-xl p-3 border-4 transition-colors ${
                  idx === highlight ? 'border-amber-400 bg-slate-800/90' : 'border-slate-700 bg-slate-900/70'
                }`}
              >
                <SoulDollSprite speciesId={id} className="w-20 h-28 md:w-24 md:h-32" />
                <span className="font-pixel text-[8px] text-slate-100 mt-2">{sp?.name}</span>
                <span className="font-pixel text-[7px] text-slate-400">{sp?.types.join(' / ')}</span>
                {active && <span className="font-pixel text-[7px] text-amber-300">SELECCIONADO</span>}
              </button>
            );
          })}
        </div>
        <p className="font-pixel text-[7px] text-slate-400 mt-8 text-center px-4">TOCA UNA CARTA PARA ELEGIR · FLECHAS: MOVER · E / ESPACIO: CONFIRMAR</p>
        </div>
      </div>
    );
  }

  // 'home_wake' is rendered by the shared DialogueBox through the store.
  // 'gameplay' renders nothing (handled by the overworld).
  return null;
};

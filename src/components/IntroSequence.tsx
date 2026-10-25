import React, { useEffect, useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SoulDollSprite } from './ui/SoulDollSprite';
import { sound } from '../game/audio/SoundEffects';
import { SOULDOLL_SPECIES, STARTER_SPECIES } from '../game/data/souldolls';
import type { IntroStep } from '../types/game';
import { BrandButton, BrandPanel } from './ui/BrandKit';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#090713] pointer-events-auto select-none">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-105 bg-cover bg-[center_68%]"
          style={{ backgroundImage: "url('/assets/homebg.png')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(20,16,28,0.08)_0%,rgba(10,8,17,0.48)_48%,rgba(8,6,13,0.94)_100%),linear-gradient(180deg,rgba(10,8,17,0.18)_0%,rgba(10,8,17,0.1)_45%,rgba(10,8,17,0.88)_100%)]"
        />
        <div aria-hidden="true" className="absolute inset-3 rounded-2xl border border-amber-200/20 shadow-[inset_0_0_80px_rgba(8,6,13,0.62)] sm:inset-5" />

        <BrandPanel
          variant="inset"
          className="relative mx-5 flex w-full max-w-xl flex-col items-center overflow-hidden rounded-2xl border-[color:var(--sd-gold)]/50 bg-[linear-gradient(180deg,rgba(35,26,43,0.83),rgba(13,10,20,0.91))] px-6 py-8 text-center shadow-[0_24px_100px_rgba(0,0,0,0.7),0_0_55px_rgba(232,184,74,0.12)] sm:mx-8 sm:px-12 sm:py-11"
        >
          <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
          <div className="mb-4 flex items-center gap-3 text-[color:var(--sd-gold)] sm:mb-5">
            <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-transparent to-current sm:w-14" />
            <span className="sd-type-label text-amber-100/80">Una aventura de almas</span>
            <span aria-hidden="true" className="h-px w-8 bg-gradient-to-l from-transparent to-current sm:w-14" />
          </div>

          <div className="relative mb-3 flex h-24 w-24 items-center justify-center text-[color:var(--sd-gold)] drop-shadow-[0_0_18px_rgba(232,184,74,0.5)] sm:mb-4 sm:h-28 sm:w-28">
            <div aria-hidden="true" className="absolute inset-1 rounded-full border border-amber-200/55 shadow-[0_0_25px_rgba(232,184,74,0.2),inset_0_0_20px_rgba(232,184,74,0.12)]" />
            <div aria-hidden="true" className="absolute inset-3 rotate-45 border border-violet-300/55" />
            <svg viewBox="0 0 100 100" className="relative h-[72%] w-[72%]" fill="none" aria-hidden="true">
              <path d="M50 9 60 34 84 20 70 44 94 50 70 57 84 80 60 66 50 91 40 66 16 80 30 57 6 50 30 44 16 20 40 34 50 9Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
              <circle cx="50" cy="50" r="12" fill="#9B6BFF" fillOpacity=".28" stroke="#E8B84A" strokeWidth="2" />
              <path d="M50 40c-5 6-6 9-6 12a6 6 0 0 0 12 0c0-3-1-6-6-12Z" fill="#E8B84A" fillOpacity=".9" />
              <circle cx="50" cy="50" r="3" fill="#FFF3C4" />
            </svg>
          </div>

          <h1 className="font-fantasy text-4xl font-black uppercase leading-none tracking-[0.12em] text-[#fff1c5] drop-shadow-[0_3px_0_rgba(67,43,19,0.9),0_0_28px_rgba(232,184,74,0.28)] sm:text-6xl sm:tracking-[0.16em]">
            SoulDolls
          </h1>
          <div className="mt-3 flex items-center gap-2 text-amber-300/70">
            <span aria-hidden="true" className="h-px w-10 bg-gradient-to-r from-transparent to-current sm:w-16" />
            <span className="sd-type-label text-[0.65rem] tracking-[0.3em] text-amber-100/80 sm:text-xs">El Reino del Alma</span>
            <span aria-hidden="true" className="h-px w-10 bg-gradient-to-l from-transparent to-current sm:w-16" />
          </div>

          <p className="mt-5 max-w-sm sd-type-body text-amber-50/70 sm:mt-6">
            Forja un vínculo. Descubre tu destino.
          </p>
          <BrandButton
            onClick={startIntro}
            variant="primary"
            className="mt-7 min-h-12 min-w-56 px-8 py-3 sd-type-label tracking-[0.14em] shadow-[0_0_26px_rgba(232,184,74,0.22)] sm:mt-8"
          >
            Comenzar aventura
          </BrandButton>
          <p className="mt-4 sd-type-meta text-amber-100/45">
            Pulsa Enter, E o Espacio
          </p>
        </BrandPanel>
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

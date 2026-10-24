import React, { useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { TYPE_COLORS } from '../game/data/typesChart';
import { sound } from '../game/audio/SoundEffects';
import { Users, Sparkles, ArrowUpCircle } from 'lucide-react';
import { GameCabinetModal } from './ui/GameCabinetModal';
import { SoulDollSprite } from './ui/SoulDollSprite';

export const PartyModal: React.FC = () => {
  const state = useGameStore();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [partyMousePos, setPartyMousePos] = useState({ x: 0, y: 0 });

  if (state.view !== 'PARTY') return null;

  const party = state.playerParty;
  const currentDoll = party[selectedIdx] || party[0];
  const species = SOULDOLL_SPECIES[currentDoll.speciesId] || SOULDOLL_SPECIES.ignisaur;

  // Move doll to first position (Party Leader)
  const handleMakeLeader = () => {
    if (selectedIdx === 0) return;
    sound.playSelect();
    const newParty = [...party];
    const [moved] = newParty.splice(selectedIdx, 1);
    newParty.unshift(moved);
    gameStore.setState({ playerParty: newParty });
    setSelectedIdx(0);
    gameStore.showToast(`¡${moved.nickname} es ahora el líder de tu equipo!`);
  };

  // Trigger dynamic evolution test directly from party modal
  const handleTriggerEvolution = () => {
    if (!species.evolution) {
      gameStore.showToast('¡Este SoulDoll ya se encuentra en su fase máxima de ascensión!');
      return;
    }
    sound.playSelect();
    gameStore.startEvolutionSequence(currentDoll);
  };

  return (
    <GameCabinetModal
      title="EQUIPO DE SOULDOLLS"
      subtitle={`${party.length}/6 Aliados Activos`}
      icon={<Users className="w-4 h-4 text-emerald-400" />}
      onClose={() => gameStore.setView('OVERWORLD')}
      maxWidth="max-w-4xl"
    >
      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#14101c]/90">
        {/* Left: Party Member Slots */}
        <div className="w-full md:w-[40%] p-3 sm:p-4 border-b md:border-b-0 md:border-r-2 border-[#8c5a2b]/30 flex flex-col gap-2 max-h-[40vh] md:max-h-none overflow-y-auto touch-pan-y shrink-0 md:shrink scrollbar-thin bg-[#0f0b16]/60">
          <div className="flex justify-between items-center mb-2 px-1">
             <span className="font-pixel text-[10px] text-amber-300">EQUIPO (6/6)</span>
          </div>
          {party.map((doll, idx) => {
            const dollSpecies = SOULDOLL_SPECIES[doll.speciesId] || SOULDOLL_SPECIES.ignisaur;
            const isSelected = selectedIdx === idx;
            const hpPct = Math.floor((doll.currentHp / doll.maxHp) * 100);

            return (
              <button
                key={doll.uuid}
                onClick={() => {
                  sound.playSelect();
                  setSelectedIdx(idx);
                }}
                className={`w-full text-left p-2 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-violet-900/50 border-emerald-400/50 shadow-inner'
                    : 'bg-[#14101c]/80 hover:bg-[#2a1f2d] border-[#7a4921]/40'
                }`}
              >
                  <div className="w-12 h-12 rounded-lg bg-black/40 border border-[#8c5a2b]/30 p-0.5 flex items-center justify-center shrink-0">
                    <SoulDollSprite
                      speciesId={doll.speciesId}
                      crop="bust"
                      className="h-full w-auto max-w-full"
                      alt={doll.nickname}
                    />
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="font-pixel text-[10px] text-amber-200 truncate">{doll.nickname}</div>
                    <div className="font-pixel text-[8px] text-amber-100/60 mt-0.5">Lv. {doll.level}</div>
                    <div className="w-full bg-black/40 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full ${hpPct > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${hpPct}%` }} />
                    </div>
                  </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Doll Inspector & Actions */}
        <div className="w-full md:w-1/2 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto space-y-4 scrollbar-thin bg-[#17121f]/70">
          <div className="space-y-3">
              {/* Sprite Focus */}
              <div
                className="w-full aspect-square flex items-center justify-center relative bg-[#0d0a13]/70 rounded-2xl border-2 border-[#8c5a2b]/40"
              >
                  <SoulDollSprite
                    speciesId={currentDoll.speciesId}
                    crop="full"
                    className="h-full w-auto drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)]"
                    alt={currentDoll.nickname}
                  />
                  {/* Elemental Orb */}
                  <div className="absolute top-2 left-2 w-10 h-10 rounded-full border-2 border-[#8c5a2b] bg-[#1a0f08] flex items-center justify-center">
                    <span className="font-pixel text-[10px] text-amber-300">{species.types[0]}</span>
                  </div>
              </div>

            {/* Stats Box */}
            <div className="sd-brand-panel sd-brand-panel-surface p-3 shadow-inner">
              <div className="font-pixel text-[10px] text-amber-200 mb-2 font-bold uppercase tracking-wider">
                ESTADÍSTICAS ACTUALES
              </div>
              <div className="grid grid-cols-3 gap-2 font-pixel text-[9px]">
                {[
                  { label: 'HP', val: currentDoll.maxHp },
                  { label: 'ATK', val: currentDoll.stats.atk },
                  { label: 'DEF', val: currentDoll.stats.def },
                  { label: 'SP.ATK', val: currentDoll.stats.spAtk },
                  { label: 'SP.DEF', val: currentDoll.stats.spDef },
                  { label: 'SPD', val: currentDoll.stats.spd },
                ].map(s => (
                  <div key={s.label} className="bg-[#14101c] p-2 rounded-lg border border-[#8a6a3b]/60 flex justify-between">
                    <span className="text-amber-200/70 font-bold">{s.label}</span>
                    <span className="text-amber-100 font-extrabold">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Moveset (4 + 1 + 1 Slot Architecture) */}
            <div className="sd-brand-panel sd-brand-panel-surface p-3 shadow-inner space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="font-pixel text-[10px] text-amber-200 font-bold uppercase tracking-wider">
                  ARQUITECTURA DE SLOTS (4 + 1 + 1)
                </div>
                <span className="text-[8px] font-pixel bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded border border-amber-600 font-bold">
                  Identidad Fija
                </span>
              </div>

              {/* Slots 1-4: Base Skills */}
              <div>
                <div className="text-[9px] font-pixel text-amber-300 mb-1 font-bold">Slots 1–4: Habilidades Base de Clase</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {currentDoll.moves.slice(0, 4).map((move, i) => (
                    <div key={move.id + i} className="bg-[#14101c] p-1.5 rounded-lg border border-[#8a6a3b]/60">
                      <div className="font-pixel text-[8px] text-amber-100 font-bold truncate mb-0.5">
                        [#{i+1}] {move.name}
                      </div>
                      <div className="flex justify-between items-center text-[7px] font-pixel">
                        <span
                          className="px-1 py-0.2 rounded font-bold"
                          style={{ backgroundColor: TYPE_COLORS[move.type].bg, color: TYPE_COLORS[move.type].text }}
                        >
                          {move.type}
                        </span>
                        <span className="text-amber-200/70">{move.currentPp}/{move.maxPp} PP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slots 5 & 6: Memory & Reaction */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#b8976a]/60">
                <div className="bg-[#14101c] p-1.5 rounded-lg border border-[#8a6a3b]/60">
                  <div className="text-[8px] font-pixel text-amber-300 font-bold mb-0.5">Slot 5: Memoria</div>
                  <div className="font-pixel text-[8px] text-amber-100 truncate">
                    {currentDoll.memoryMove ? currentDoll.memoryMove.name : '(Vacío - Ranura Ítem)'}
                  </div>
                </div>
                <div className="bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-700/60">
                  <div className="text-[8px] font-pixel text-emerald-200 font-bold mb-0.5">Slot 6: Reacción / Purga</div>
                  <div className="font-pixel text-[8px] text-emerald-100 truncate">
                    {currentDoll.reactionMove ? currentDoll.reactionMove.name : 'Vía de Limpieza Estándar'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#8c5a2b] shrink-0 mt-2">
            {selectedIdx !== 0 && (
              <button
                onClick={handleMakeLeader}
                className="sd-brand-button sd-brand-button-secondary w-full py-2.5 px-4 text-[10px] flex items-center justify-center gap-1.5"
              >
                <ArrowUpCircle className="w-3.5 h-3.5 text-amber-400" />
                NOMBRAR LÍDER DE EQUIPO
              </button>
            )}

            {species.evolution && (
              <button
                onClick={handleTriggerEvolution}
                className="sd-brand-button sd-brand-button-primary w-full py-3 px-4 text-xs flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                DESPERTAR METAMORFOSIS ASCENDIDA
              </button>
            )}
          </div>
        </div>
      </div>
    </GameCabinetModal>
  );
};

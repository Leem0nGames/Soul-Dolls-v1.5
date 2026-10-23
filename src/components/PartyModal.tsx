import React, { useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { TYPE_COLORS } from '../game/data/typesChart';
import { sound } from '../game/audio/SoundEffects';
import { Users, Sparkles, ArrowUpCircle } from 'lucide-react';
import { GameCabinetModal } from './ui/GameCabinetModal';

export const PartyModal: React.FC = () => {
  const state = useGameStore();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

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
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#241309]/90">
        {/* Left: Party Member Slots */}
        <div className="w-full md:w-1/2 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-[#8c5a2b] flex flex-col gap-2 max-h-[35vh] md:max-h-none overflow-y-auto touch-pan-y shrink-0 md:shrink scrollbar-thin">
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
                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#4a2b16] border-emerald-400 ring-2 ring-emerald-500/30 shadow-inner'
                    : 'bg-[#190c06]/80 hover:bg-[#2b170c] border-[#7a4921]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-pixel text-sm font-bold text-white shadow-md border border-white/20"
                    style={{ backgroundColor: dollSpecies.colorTheme.primary }}
                  >
                    {doll.nickname[0]}
                  </div>

                  <div>
                    <div className="font-pixel text-xs text-amber-200 flex items-center gap-2">
                      <span>{doll.nickname}</span>
                      {idx === 0 && (
                        <span className="font-pixel text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">
                          LÍDER
                        </span>
                      )}
                    </div>
                    <div className="font-pixel text-[9px] text-amber-100/70 mt-0.5">
                      Nv. {doll.level} • {dollSpecies.types[0]}
                    </div>
                  </div>
                </div>

                {/* HP Indicator */}
                <div className="w-28 flex flex-col items-end gap-1">
                  <span className="font-pixel text-[9px] text-amber-200">
                    {doll.currentHp}/{doll.maxHp} HP
                  </span>
                  <div className="w-full bg-[#190c06] h-2 rounded-full overflow-hidden border border-[#7a4921]">
                    <div
                      className={`h-full ${
                        hpPct > 50 ? 'bg-emerald-500' : hpPct > 20 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Doll Inspector & Actions (Parchment & Wood Theme) */}
        <div className="w-full md:w-1/2 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto space-y-4 scrollbar-thin">
          <div className="space-y-3">
            {/* Header profile card */}
            <div
              className="p-3.5 sm:p-4 rounded-2xl border-2 border-[#967853] shadow-md flex items-center gap-3.5"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center font-pixel text-2xl font-bold text-white border-2 border-[#8c5a2b] shadow-md shrink-0"
                style={{ backgroundColor: species.colorTheme.primary }}
              >
                {currentDoll.nickname[0]}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-fantasy text-sm sm:text-base text-[#452713] font-bold truncate">
                  {currentDoll.nickname}
                </h3>
                <div className="flex gap-1.5 my-1">
                  {species.types.map(t => t && (
                    <span
                      key={t}
                      className="font-pixel text-[9px] px-2 py-0.5 rounded font-bold shadow-sm"
                      style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="font-pixel text-[9px] text-[#6d4323]">
                  Fase {species.stage} • EXP: {currentDoll.currentXp}
                </div>
              </div>
            </div>

            {/* Stats Box (Parchment card) */}
            <div
              className="p-3 rounded-xl border-2 border-[#967853] shadow-inner"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              <div className="font-pixel text-[10px] text-[#6d4323] mb-2 font-bold uppercase tracking-wider">
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
                  <div key={s.label} className="bg-[#ecd5b3] p-2 rounded-lg border border-[#b8976a] flex justify-between">
                    <span className="text-[#6d4323] font-bold">{s.label}</span>
                    <span className="text-[#3d2514] font-extrabold">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Moveset (4 + 1 + 1 Slot Architecture) */}
            <div
              className="p-3 rounded-xl border-2 border-[#967853] shadow-inner space-y-2.5"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              <div className="flex justify-between items-center">
                <div className="font-pixel text-[10px] text-[#6d4323] font-bold uppercase tracking-wider">
                  ARQUITECTURA DE SLOTS (4 + 1 + 1)
                </div>
                <span className="text-[8px] font-pixel bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded border border-amber-600 font-bold">
                  Identidad Fija
                </span>
              </div>

              {/* Slots 1-4: Base Skills */}
              <div>
                <div className="text-[9px] font-pixel text-[#8c5a2b] mb-1 font-bold">Slots 1–4: Habilidades Base de Clase</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {currentDoll.moves.slice(0, 4).map((move, i) => (
                    <div key={move.id + i} className="bg-[#ecd5b3] p-1.5 rounded-lg border border-[#b8976a]">
                      <div className="font-pixel text-[8px] text-[#452713] font-bold truncate mb-0.5">
                        [#{i+1}] {move.name}
                      </div>
                      <div className="flex justify-between items-center text-[7px] font-pixel">
                        <span
                          className="px-1 py-0.2 rounded font-bold"
                          style={{ backgroundColor: TYPE_COLORS[move.type].bg, color: TYPE_COLORS[move.type].text }}
                        >
                          {move.type}
                        </span>
                        <span className="text-[#6d4323]">{move.currentPp}/{move.maxPp} PP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slots 5 & 6: Memory & Reaction */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#b8976a]/60">
                <div className="bg-[#e4cbab] p-1.5 rounded-lg border border-[#9a744b]">
                  <div className="text-[8px] font-pixel text-amber-900 font-bold mb-0.5">Slot 5: Memoria</div>
                  <div className="font-pixel text-[8px] text-[#452713] truncate">
                    {currentDoll.memoryMove ? currentDoll.memoryMove.name : '(Vacío - Ranura Ítem)'}
                  </div>
                </div>
                <div className="bg-[#d2e2cd] p-1.5 rounded-lg border border-[#6b9e65]">
                  <div className="text-[8px] font-pixel text-emerald-900 font-bold mb-0.5">Slot 6: Reacción / Purga</div>
                  <div className="font-pixel text-[8px] text-emerald-950 truncate">
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
                className="w-full py-2.5 px-4 rounded-xl font-pixel text-[10px] font-bold bg-[#3d2212] hover:bg-[#4a2b16] text-amber-200 border border-[#8c5a2b] shadow flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <ArrowUpCircle className="w-3.5 h-3.5 text-amber-400" />
                NOMBRAR LÍDER DE EQUIPO
              </button>
            )}

            {species.evolution && (
              <button
                onClick={handleTriggerEvolution}
                className="w-full py-3 px-4 rounded-xl font-pixel text-xs font-bold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 border border-amber-300 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
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

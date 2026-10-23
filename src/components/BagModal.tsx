import React, { useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { sound } from '../game/audio/SoundEffects';
import { Briefcase, Check } from 'lucide-react';
import { ItemCategory } from '../types/game';
import { GameCabinetModal } from './ui/GameCabinetModal';

export const BagModal: React.FC = () => {
  const state = useGameStore();
  const [activeCategory, setActiveCategory] = useState<ItemCategory>('vial');
  const [selectedItemId, setSelectedItemId] = useState<string>('animus_vial');
  const [targetDollUuid, setTargetDollUuid] = useState<string>(state.playerParty[0]?.uuid || '');

  if (state.view !== 'BAG') return null;

  const items = Object.values(state.inventory);
  const filteredItems = items.filter(it => it.category === activeCategory);
  const selectedItem = state.inventory[selectedItemId] || filteredItems[0];

  const handleUseItem = () => {
    if (!selectedItem || selectedItem.count <= 0) return;

    if (selectedItem.category === 'vial') {
      gameStore.showToast('¡Los Viales de Ánima se utilizan directamente durante el combate contra SoulDolls salvajes!');
      return;
    }

    const success = gameStore.useMedicine(selectedItem.id, targetDollUuid);
    if (success) {
      sound.playSelect();
    }
  };

  return (
    <GameCabinetModal
      title="MOCHILA DEL DOMADOR"
      subtitle={`${state.soulShards} ✦ Fragmentos de Alma`}
      icon={<Briefcase className="w-4 h-4 text-amber-300" />}
      onClose={() => gameStore.setView('OVERWORLD')}
      maxWidth="max-w-3xl"
    >
      {/* Categories Bar */}
      <div className="flex border-b-2 border-[#8c5a2b] bg-[#2b170c] p-2 gap-2 shrink-0">
        {(
          [
            { id: 'vial', label: 'VIALES' },
            { id: 'medicine', label: 'REMEDIOS' },
            { id: 'evolution', label: 'ARTEFACTOS' },
          ] as { id: ItemCategory; label: string }[]
        ).map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              sound.playSelect();
              setActiveCategory(cat.id);
              const first = items.find(it => it.category === cat.id);
              if (first) setSelectedItemId(first.id);
            }}
            className={`px-4 py-2 rounded-lg font-pixel text-[10px] transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-amber-600 text-slate-950 font-bold shadow-md'
                : 'bg-[#190c06] text-amber-200/80 hover:bg-[#3d2212] border border-[#7a4921]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#241309]/90">
        {/* Items list */}
        <div className="w-full md:w-1/2 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-[#8c5a2b] flex flex-col gap-2 max-h-[35vh] md:max-h-none overflow-y-auto touch-pan-y shrink-0 md:shrink scrollbar-thin">
          {filteredItems.map(item => {
            const isSelected = selectedItemId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  sound.playSelect();
                  setSelectedItemId(item.id);
                }}
                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#4a2b16] border-amber-400 shadow-inner'
                    : 'bg-[#190c06]/80 hover:bg-[#2b170c] border-[#7a4921]'
                }`}
              >
                <div>
                  <div className="font-pixel text-[11px] text-amber-200 font-bold">{item.name}</div>
                  <div className="font-sans text-[10px] text-amber-100/70 mt-0.5 truncate max-w-[200px]">
                    {item.description}
                  </div>
                </div>
                <span className="font-pixel text-xs text-amber-300 bg-[#2b170c] px-2.5 py-1 rounded border border-[#8c5a2b] font-bold">
                  x{item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Item details & Target Doll selector */}
        <div className="w-full md:w-1/2 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto scrollbar-thin">
          {selectedItem ? (
            <div className="space-y-4">
              {/* Parchment details card */}
              <div
                className="p-4 rounded-2xl border-2 border-[#967853] shadow-md"
                style={{
                  background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                  color: '#3d2514',
                }}
              >
                <h3 className="font-fantasy text-sm text-[#452713] font-bold mb-1">
                  {selectedItem.name}
                </h3>
                <p className="font-sans text-xs text-[#5c371d] leading-relaxed">
                  {selectedItem.description}
                </p>
                <div className="mt-2 text-[10px] font-pixel text-[#8c5a2b] font-bold">
                  Disponibles: <span className="text-[#3d2514]">{selectedItem.count} unidades</span>
                </div>
              </div>

              {/* Target SoulDoll Selection for Medicine & Artifacts */}
              {selectedItem.category !== 'vial' && (
                <div className="bg-[#190c06] p-3 rounded-xl border border-[#7a4921]">
                  <div className="font-pixel text-[10px] text-amber-300 mb-2 font-bold">
                    APLICAR SOBRE SOULDOLL:
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                    {state.playerParty.map(doll => (
                      <button
                        key={doll.uuid}
                        onClick={() => setTargetDollUuid(doll.uuid)}
                        className={`w-full text-left p-2 rounded-lg flex justify-between items-center border cursor-pointer ${
                          targetDollUuid === doll.uuid
                            ? 'bg-[#4a2b16] border-amber-400 text-white shadow-inner'
                            : 'bg-[#2b170c] border-[#7a4921] text-amber-200/80 hover:bg-[#3d2212]'
                        }`}
                      >
                        <span className="font-pixel text-[10px] font-bold">
                          {doll.nickname} (Nv.{doll.level})
                        </span>
                        <span className="font-pixel text-[9px] text-amber-300">
                          {doll.currentHp}/{doll.maxHp} HP
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center font-pixel text-xs text-amber-200/60 py-10">
              Selecciona un objeto de la lista
            </div>
          )}

          {selectedItem && (
            <button
              disabled={selectedItem.count <= 0}
              onClick={handleUseItem}
              className="mt-3 w-full py-3 px-6 rounded-xl font-pixel text-xs font-bold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 shadow-lg border-2 border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40"
            >
              <Check className="w-4 h-4 text-slate-950" />
              USAR OBJETO
            </button>
          )}
        </div>
      </div>
    </GameCabinetModal>
  );
};

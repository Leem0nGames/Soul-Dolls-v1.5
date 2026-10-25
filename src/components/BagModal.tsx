import React, { useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { sound } from '../game/audio/SoundEffects';
import { Briefcase, Check } from 'lucide-react';
import { ItemCategory } from '../types/game';
import { GameCabinetModal } from './ui/GameCabinetModal';
import { SoulDollSprite } from './ui/SoulDollSprite';
import { BrandBadge, BrandButton, BrandPanel, BrandSectionTitle } from './ui/BrandKit';

export const BagModal: React.FC = () => {
  const state = useGameStore();
  const [activeCategory, setActiveCategory] = useState<ItemCategory>('vial');
  const [selectedItemId, setSelectedItemId] = useState<string>('animus_vial');
  const [targetDollUuid, setTargetDollUuid] = useState<string>(state.playerParty[0]?.uuid || '');

  if (state.view !== 'BAG') return null;

  const items = Object.values(state.inventory);
  const filteredItems = items.filter(it => it.category === activeCategory);
  const selectedItem =
    items.find(item => item.id === selectedItemId && item.category === activeCategory) || filteredItems[0];

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
      <div className="sd-cabinet-header flex overflow-x-auto p-2 gap-2 shrink-0">
        {(
          [
            { id: 'vial', label: 'VIALES' },
            { id: 'medicine', label: 'REMEDIOS' },
            { id: 'evolution', label: 'ARTEFACTOS' },
            { id: 'special', label: 'EXPERIENCIA' },
          ] as { id: ItemCategory; label: string }[]
        ).map(cat => (
          <BrandButton
            key={cat.id}
            onClick={() => {
              sound.playSelect();
              setActiveCategory(cat.id);
              const first = items.find(it => it.category === cat.id);
              if (first) setSelectedItemId(first.id);
            }}
            variant={activeCategory === cat.id ? 'primary' : 'secondary'}
            aria-pressed={activeCategory === cat.id}
            className={`whitespace-nowrap px-4 py-2 sd-type-label ${
              activeCategory === cat.id
                ? 'font-bold'
                : 'text-amber-200/80'
            }`}
          >
            {cat.label}
          </BrandButton>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[color:var(--sd-ink)]/90">
        {/* Items list */}
        <div className="w-full md:w-1/2 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-[color:var(--sd-bronze)] flex flex-col gap-2 max-h-[35vh] md:max-h-none overflow-y-auto touch-pan-y shrink-0 md:shrink scrollbar-thin">
          <div className="flex items-center justify-between gap-2 pb-1">
            <BrandSectionTitle>Objetos disponibles</BrandSectionTitle>
            <BrandBadge>{filteredItems.length} tipos</BrandBadge>
          </div>
          {filteredItems.length > 0 ? filteredItems.map(item => {
            const isSelected = selectedItemId === item.id;
            return (
              <BrandButton
                key={item.id}
                onClick={() => {
                  sound.playSelect();
                  setSelectedItemId(item.id);
                }}
                variant="select"
                aria-pressed={isSelected}
                className="w-full p-3 rounded-xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="sd-type-body font-bold text-amber-100 truncate">{item.name}</div>
                  <div className="sd-type-meta text-amber-100/70 mt-0.5 truncate max-w-[200px]">
                    {item.description}
                  </div>
                </div>
                <BrandBadge className="shrink-0">
                  x{item.count}
                </BrandBadge>
              </BrandButton>
            );
          }) : (
            <BrandPanel variant="inset" className="p-4 text-center sd-type-body text-amber-100/60">
              No tienes objetos en esta categoría.
            </BrandPanel>
          )}
        </div>

        {/* Item details & Target Doll selector */}
        <div className="w-full md:w-1/2 p-4 sm:p-5 flex flex-col justify-between gap-4 overflow-y-auto scrollbar-thin">
          {selectedItem ? (
            <div className="space-y-4">
              <BrandPanel variant="raised" className="p-4">
                <h3 className="sd-type-heading text-amber-100 font-bold mb-1">
                  {selectedItem.name}
                </h3>
                <p className="sd-type-body text-amber-100/70">
                  {selectedItem.description}
                </p>
                <div className="mt-2 sd-type-meta text-amber-300 font-bold">
                  Disponibles: <span className="text-amber-100">{selectedItem.count} unidades</span>
                </div>
              </BrandPanel>

              {/* Target SoulDoll Selection for Medicine & Artifacts */}
              {selectedItem.category !== 'vial' && (
                <BrandPanel variant="inset" className="p-3">
                  <BrandSectionTitle className="mb-2">Aplicar sobre SoulDoll</BrandSectionTitle>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                    {state.playerParty.length > 0 ? state.playerParty.map(doll => (
                      <BrandButton
                        key={doll.uuid}
                        onClick={() => setTargetDollUuid(doll.uuid)}
                        variant="select"
                        aria-pressed={targetDollUuid === doll.uuid}
                        className="w-full p-2 rounded-lg flex justify-between items-center gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[color:var(--sd-ink)] border border-[color:var(--sd-bronze)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                            <SoulDollSprite
                              speciesId={doll.speciesId}
                              crop="bust"
                              className="h-full w-auto max-w-full drop-shadow"
                              alt={doll.nickname}
                            />
                          </div>
                          <span className="sd-type-meta font-bold truncate">
                            {doll.nickname} (Nv.{doll.level})
                          </span>
                        </div>
                        <span className="sd-type-meta text-amber-300 shrink-0">
                          {selectedItem.grantsLevel
                            ? `${doll.currentXp.toLocaleString()} / ${doll.xpToNext.toLocaleString()} EXP`
                            : `${doll.currentHp}/${doll.maxHp} HP`}
                        </span>
                      </BrandButton>
                    )) : (
                      <p className="sd-type-meta text-amber-100/60 py-2">No tienes SoulDolls en tu equipo.</p>
                    )}
                  </div>
                </BrandPanel>
              )}
            </div>
          ) : (
            <div className="text-center sd-type-body text-amber-200/60 py-10">
              Selecciona un objeto de la lista
            </div>
          )}

          {selectedItem && (
            <BrandButton
              disabled={selectedItem.count <= 0}
              onClick={handleUseItem}
              variant="primary"
              className="w-full py-3 px-6 sd-type-label flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              USAR OBJETO
            </BrandButton>
          )}
        </div>
      </div>
    </GameCabinetModal>
  );
};

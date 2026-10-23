import React from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { ecs } from '../game/ecs/World';
import { ITEMS_DATABASE } from '../game/data/items';
import { GameCabinetModal } from './ui/GameCabinetModal';
import { ShoppingBag, X } from 'lucide-react';

export const ShopModal: React.FC = () => {
  const state = useGameStore();
  
  if (state.view !== 'SHOP' || state.activeShopId === null) return null;
  
  const shop = ecs.shops.get(state.activeShopId);
  if (!shop) return null;

  const handleBuy = (itemId: string, price: number) => {
    if (state.soulShards >= price) {
      gameStore.setState({ soulShards: state.soulShards - price });
      const currentItem = state.inventory[itemId];
      gameStore.setState({ 
        inventory: { 
          ...state.inventory, 
          [itemId]: { ...ITEMS_DATABASE[itemId], count: (currentItem?.count || 0) + 1 } 
        } 
      });
      gameStore.showToast(`¡Compraste ${ITEMS_DATABASE[itemId].name}!`);
    } else {
      gameStore.showToast('¡No tienes suficientes fragmentos de alma!');
    }
  };

  return (
    <GameCabinetModal
      title={shop.name}
      subtitle="Comercio de Almas"
      icon={<ShoppingBag className="w-4 h-4 text-amber-400" />}
      onClose={() => gameStore.setView('OVERWORLD')}
      maxWidth="max-w-md"
    >
      <div className="p-4 space-y-3">
        <div className="font-pixel text-sm text-amber-200">
          Fragmentos Disponibles: <span className="font-bold text-amber-500">{state.soulShards} 🪙</span>
        </div>
        <div className="space-y-2">
          {shop.items.map(item => {
            const itemData = ITEMS_DATABASE[item.id];
            return (
              <div key={item.id} className="bg-[#2b170c] p-3 rounded-lg border border-[#7a4921] flex justify-between items-center">
                <div>
                  <div className="font-pixel text-xs text-amber-100">{itemData.name}</div>
                  <div className="font-sans text-[10px] text-amber-200/70">{itemData.description}</div>
                </div>
                <button
                  onClick={() => handleBuy(item.id, item.price)}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-pixel text-[10px] px-3 py-1.5 rounded-lg border border-amber-300"
                >
                  {item.price} 🪙
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </GameCabinetModal>
  );
};

import React, { useState } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { sound } from '../game/audio/SoundEffects';
import { BookOpen, Users, Briefcase, Heart, Volume2, VolumeX, Sparkles, MapPin } from 'lucide-react';
import { SoulDollSprite } from './ui/SoulDollSprite';
import { BrandButton } from './ui/BrandKit';
import { MAP_NAMES } from '../game/data/maps';

export const TopHUD: React.FC = () => {
  const state = useGameStore();
  const [audioMuted, setAudioMuted] = useState(false);

  // In battle or evolution, overworld HUD is hidden
  if (state.view === 'BATTLE' || state.view === 'EVOLUTION') return null;

  const toggleAudio = () => {
    sound.enabled = !sound.enabled;
    setAudioMuted(!sound.enabled);
  };

  const getZoneName = () => {
    const mapId = state.activeMapId;
    const px = state.playerPosition.x;
    const pz = state.playerPosition.z;
    if (mapId === 'villa_marionette' && Math.hypot(px, pz) < 7) return 'Plaza de Marionette';
    return MAP_NAMES[mapId];
  };

  return (
    <div className="absolute top-0 inset-x-0 p-2 sm:p-4 pointer-events-none flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 z-30 select-none">
      <div className="pointer-events-auto sd-panel rounded-xl backdrop-blur-sm border-2 border-sd-bronze flex items-center justify-between gap-3 px-3 py-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-sd-ki shrink-0 shadow-[0_0_10px_var(--sd-ki)]" />
          <div className="min-w-0">
            <div className="font-pixel text-[10px] sm:text-[11px] sd-gold-text font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-sd-rift shrink-0" />
              <span className="truncate">{getZoneName()}</span>
            </div>
            <div className="font-pixel text-[7px] text-slate-400 mt-1">
              SOULDOLLS • LUMINATI 2.5D
            </div>
          </div>
        </div>

        <div className="px-2 py-1.5 bg-sd-ink rounded-lg flex items-center gap-1.5 font-pixel text-[9px] sm:text-[10px] text-sd-gold border border-sd-gold/30 shrink-0">
          <Sparkles className="w-3 h-3 shrink-0" />
          <span>{state.soulShards}</span>
        </div>
      </div>

      <nav aria-label="Menú de exploración" className="pointer-events-auto self-end sm:self-auto flex items-center gap-1 sd-panel p-1 rounded-xl backdrop-blur-sm border-2 border-sd-bronze">
        <BrandButton
          onClick={() => gameStore.healParty()}
          variant="ki"
          title="Sanar equipo en el Santuario"
          aria-label="Sanar equipo"
          className="min-w-[42px] min-h-[42px] text-[10px] flex items-center justify-center gap-1 px-2"
        >
          <Heart className="w-4 h-4 text-rose-300 fill-rose-300" />
          <span className="hidden lg:inline">SANAR</span>
        </BrandButton>

        <BrandButton
          onClick={() => gameStore.setView('PARTY')}
          variant="soul"
          title="Ver equipo de SoulDolls"
          aria-label="Equipo"
          className="min-w-[42px] min-h-[42px] text-[10px] flex items-center justify-center gap-1.5 px-2"
        >
          {state.playerParty[0] ? (
            <div className="w-5 h-5 rounded bg-black/40 border border-indigo-300/40 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
              <SoulDollSprite speciesId={state.playerParty[0].speciesId} className="h-full w-auto max-w-full drop-shadow" />
            </div>
          ) : (
            <Users className="w-4 h-4 text-indigo-200" />
          )}
          <span className="hidden lg:inline">EQUIPO ({state.playerParty.length})</span>
          <span className="lg:hidden text-[9px]">({state.playerParty.length})</span>
        </BrandButton>

        <BrandButton
          onClick={() => gameStore.setView('BAG')}
          variant="primary"
          title="Mochila e inventario"
          aria-label="Mochila"
          className="min-w-[42px] min-h-[42px] text-[10px] flex items-center justify-center gap-1 px-2"
        >
          <Briefcase className="w-4 h-4" />
          <span className="hidden lg:inline">MOCHILA</span>
        </BrandButton>

        <BrandButton
          onClick={() => gameStore.setView('SOULDEX')}
          variant="soul"
          title="Registro SoulDex"
          aria-label="SoulDex"
          className="min-w-[42px] min-h-[42px] text-[10px] flex items-center justify-center gap-1 px-2"
        >
          <BookOpen className="w-4 h-4 text-purple-200" />
          <span className="hidden lg:inline">SOULDEX</span>
        </BrandButton>

        <BrandButton
          onClick={toggleAudio}
          variant="quiet"
          className="min-w-[42px] min-h-[42px] p-2 text-slate-300 flex items-center justify-center"
          title={audioMuted ? 'Activar sonido' : 'Silenciar'}
          aria-label={audioMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </BrandButton>
      </nav>
    </div>
  );
};

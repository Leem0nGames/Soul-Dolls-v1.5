import React, { useState, useEffect, useRef } from 'react';
import { useGameStore, gameStore } from '../game/state/useGameStore';
import { SOULDOLL_SPECIES } from '../game/data/souldolls';
import { MOVES_DATABASE } from '../game/data/moves';
import { sound } from '../game/audio/SoundEffects';
import { pixelGenerator } from '../game/graphics/PixelArtGenerator';
import { TYPE_COLORS, getTypeEffectiveness } from '../game/data/typesChart';
import { ElementalType, SoulDollSpecies, SoulDollInstance } from '../types/game';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Shield,
  Sword,
  RotateCw,
  Flame,
  Droplets,
  Leaf,
  Zap,
  Mountain,
  Snowflake,
  Wind,
  Moon,
  Sun,
  Skull,
  CheckCircle2,
  Eye,
  Grid3X3,
  BookOpen,
  ArrowRight,
  Heart,
  HelpCircle
} from 'lucide-react';

// Elemental Orb Icons & Colors
function getElementOrb(type: ElementalType) {
  switch (type) {
    case 'Fire':
      return {
        icon: Flame,
        bgGradient: 'from-amber-400 via-rose-500 to-red-700',
        borderColor: '#f97316',
        shadowColor: 'rgba(239, 68, 68, 0.6)',
        name: 'Fuego',
      };
    case 'Water':
      return {
        icon: Droplets,
        bgGradient: 'from-cyan-300 via-sky-500 to-blue-700',
        borderColor: '#38bdf8',
        shadowColor: 'rgba(56, 189, 248, 0.6)',
        name: 'Agua',
      };
    case 'Nature':
      return {
        icon: Leaf,
        bgGradient: 'from-lime-300 via-emerald-500 to-green-800',
        borderColor: '#4ade80',
        shadowColor: 'rgba(74, 222, 128, 0.6)',
        name: 'Naturaleza',
      };
    case 'Electric':
      return {
        icon: Zap,
        bgGradient: 'from-yellow-200 via-amber-400 to-yellow-600',
        borderColor: '#facc15',
        shadowColor: 'rgba(250, 204, 21, 0.6)',
        name: 'Rayo',
      };
    case 'Earth':
      return {
        icon: Mountain,
        bgGradient: 'from-amber-300 via-amber-600 to-stone-800',
        borderColor: '#d97706',
        shadowColor: 'rgba(217, 119, 6, 0.6)',
        name: 'Tierra',
      };
    case 'Frost':
      return {
        icon: Snowflake,
        bgGradient: 'from-teal-200 via-cyan-400 to-sky-700',
        borderColor: '#67e8f9',
        shadowColor: 'rgba(103, 232, 249, 0.6)',
        name: 'Hielo',
      };
    case 'Wind':
      return {
        icon: Wind,
        bgGradient: 'from-fuchsia-200 via-purple-500 to-indigo-800',
        borderColor: '#c084fc',
        shadowColor: 'rgba(192, 132, 252, 0.6)',
        name: 'Viento',
      };
    case 'Shadow':
      return {
        icon: Moon,
        bgGradient: 'from-purple-400 via-indigo-700 to-slate-950',
        borderColor: '#818cf8',
        shadowColor: 'rgba(129, 140, 248, 0.6)',
        name: 'Sombra',
      };
    case 'Light':
      return {
        icon: Sun,
        bgGradient: 'from-amber-100 via-yellow-300 to-amber-500',
        borderColor: '#fef08a',
        shadowColor: 'rgba(254, 240, 138, 0.8)',
        name: 'Luz',
      };
    case 'Poison':
      return {
        icon: Skull,
        bgGradient: 'from-pink-300 via-fuchsia-600 to-purple-950',
        borderColor: '#e879f9',
        shadowColor: 'rgba(232, 121, 249, 0.6)',
        name: 'Veneno',
      };
  }
}

// Compute strengths and weaknesses based on typesChart
function getElementalAffinities(types: [ElementalType, ElementalType?]) {
  const allTypes: ElementalType[] = [
    'Fire',
    'Water',
    'Nature',
    'Electric',
    'Earth',
    'Frost',
    'Wind',
    'Shadow',
    'Light',
    'Poison',
  ];

  const strongAgainst: ElementalType[] = [];
  const weakAgainst: ElementalType[] = [];
  const activeTypes = types.filter((t): t is ElementalType => Boolean(t));

  for (const t of allTypes) {
    // Check if our moves deal 2.0x against type t
    const ourDamage = Math.max(...activeTypes.map((ourType) => getTypeEffectiveness(ourType, [t])));
    if (ourDamage >= 2.0 && !strongAgainst.includes(t)) {
      strongAgainst.push(t);
    }

    // Check if incoming attack of type t deals 2.0x against us
    const incomingDamage = getTypeEffectiveness(t, types);
    if (incomingDamage >= 2.0 && !weakAgainst.includes(t)) {
      weakAgainst.push(t);
    }
  }

  return { strongAgainst, weakAgainst };
}

export const SoulDexModal: React.FC = () => {
  const state = useGameStore();
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('ignisaur');
  const [isBackView, setIsBackView] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render character on canvas - Unconditionally declared at top level
  useEffect(() => {
    if (state.view !== 'SOULDEX') return;

    const renderSprite = () => {
      const srcCanvas = pixelGenerator.getSpeciesCanvas(selectedSpeciesId, isBackView);
      if (srcCanvas && canvasRef.current) {
        const dest = canvasRef.current;
        dest.width = srcCanvas.width;
        dest.height = srcCanvas.height;
        const ctx = dest.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, dest.width, dest.height);
          ctx.drawImage(srcCanvas, 0, 0);
        }
      }
    };

    renderSprite();
    const unsub = pixelGenerator.onSoulDollSpritesheetLoaded(() => {
      renderSprite();
    });

    return () => {
      unsub();
    };
  }, [state.view, selectedSpeciesId, isBackView]);

  if (state.view !== 'SOULDEX') return null;

  const speciesList = Object.values(SOULDOLL_SPECIES);
  const filteredList =
    typeFilter === 'ALL'
      ? speciesList
      : speciesList.filter((s) => s.types.includes(typeFilter as ElementalType));

  const selectedSpecies = SOULDOLL_SPECIES[selectedSpeciesId] || speciesList[0];
  const isCaught = state.caughtSoulDolls.has(selectedSpecies.id);
  const isSeen = state.seenSoulDolls.has(selectedSpecies.id) || isCaught;

  // Real player-owned instances of this species
  const partyInstance = state.playerParty.find((d) => d.speciesId === selectedSpecies.id);
  const boxInstance = state.soulBox.find((d) => d.speciesId === selectedSpecies.id);
  const ownedInstance: SoulDollInstance | undefined = partyInstance || boxInstance;
  const isPartyMember = Boolean(partyInstance);

  const currentIndex = speciesList.findIndex((s) => s.id === selectedSpecies.id);
  const primaryType = selectedSpecies.types[0];
  const orb = getElementOrb(primaryType);
  const affinities = getElementalAffinities(selectedSpecies.types);

  // Real stats
  const stats = ownedInstance
    ? ownedInstance.stats
    : selectedSpecies.baseStats;

  // Star rating: 3 stars for stage 1, 4 for stage 2, 5 for stage 3
  const starCount = selectedSpecies.stage === 1 ? 3 : selectedSpecies.stage === 2 ? 4 : 5;

  const handlePrev = () => {
    sound.playSelect();
    const nextIdx = (currentIndex - 1 + speciesList.length) % speciesList.length;
    setSelectedSpeciesId(speciesList[nextIdx].id);
  };

  const handleNext = () => {
    sound.playSelect();
    const nextIdx = (currentIndex + 1) % speciesList.length;
    setSelectedSpeciesId(speciesList[nextIdx].id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none touch-manipulation overflow-hidden">
      {/* Outer Ornate Bronze & Engraved Wood Frame (Brave Frontier Inspired Cabinet) */}
      <div
        className="relative w-full max-w-4xl h-full max-h-[96dvh] rounded-3xl flex flex-col overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.95)] border-4 border-[#8c5a2b]"
        style={{
          background: 'linear-gradient(135deg, #3d2212 0%, #24140a 50%, #3d2212 100%)',
          boxShadow:
            'inset 0 0 0 2px #d49b55, inset 0 0 30px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.9)',
        }}
      >
        {/* Ornate Acanthus Wood Engraving Texture Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, #d49b55 1px, transparent 1px), radial-gradient(circle at 0% 0%, #a26934 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* 1. TOP HEADER STATUS BAR (Real Game Progression & Inventory) */}
        <div className="relative z-10 px-3 sm:px-5 py-2.5 bg-[#2b170c] border-b-2 border-[#8c5a2b] shadow-md flex justify-between items-center gap-2">
          {/* Left: SoulDex Title & Real Discovery Stats */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span className="font-fantasy text-amber-200 text-xs sm:text-sm font-bold tracking-wider">
                SOULDEX
              </span>
              <span className="text-[#a87d50] text-[10px] sm:text-xs font-semibold">•</span>
              <span className="font-sans text-[11px] sm:text-xs text-[#d9c09e]">
                Registro de Almas
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#d4b48f] font-sans">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-sky-400" />
                Avistados: <strong className="text-amber-200 font-bold">{state.seenSoulDolls.size}</strong>/{speciesList.length}
              </span>
              <span className="text-[#7a4921]">|</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Capturados: <strong className="text-amber-200 font-bold">{state.caughtSoulDolls.size}</strong>/{speciesList.length}
              </span>
            </div>
          </div>

          {/* Right: Real Inventory Resources & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real Game Resources: Soul Shards, Vials, Prisms */}
            <div className="hidden sm:flex items-center gap-3 bg-[#190c06] px-3 py-1.5 rounded-xl border border-[#7a4921] shadow-inner text-[10px] font-pixel">
              <div className="flex items-center gap-1 text-amber-300" title="Fragmentos de Alma">
                <span>🪙</span>
                <span className="font-bold">{state.soulShards}</span>
              </div>
              <div className="flex items-center gap-1 text-sky-300" title="Viales de Ánima en inventario">
                <span>🧪</span>
                <span className="font-bold">{state.inventory.animus_vial?.count || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-purple-300" title="Prismas de Evolución">
                <span>💎</span>
                <span className="font-bold">{state.inventory.evolution_prism?.count || 0}</span>
              </div>
            </div>

            {/* Collection Grid Drawer Button */}
            <button
              onClick={() => {
                sound.playSelect();
                setShowDrawer(!showDrawer);
              }}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-[#4a2b16] hover:bg-[#5c371d] text-amber-200 border border-[#a26934] font-pixel text-[9px] flex items-center gap-1 shadow-sm transition-all"
              title="Abrir lista completa de SoulDolls"
            >
              <Grid3X3 className="w-4 h-4 text-amber-300" />
              <span className="hidden md:inline">ÍNDICE</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                sound.playSelect();
                gameStore.setView('OVERWORLD');
              }}
              className="p-1.5 rounded-lg bg-[#5c2419] hover:bg-[#782e20] text-amber-100 border border-[#b44835] shadow transition-all"
              title="Cerrar SoulDex"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. MAIN 2-COLUMN VIEWPORT (Parchment Profile on Left, 3D Sprite on Right) */}
        <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* ==================== LEFT COLUMN: REAL STATS & CARDS ==================== */}
          <div className="w-full md:w-[54%] p-3 sm:p-4 overflow-y-auto space-y-2.5 touch-pan-y scrollbar-thin">
            {/* CARD 1: CHARACTER HEADER (Name, Stars, Element Badge, Ownership & Level) */}
            <div
              className="relative p-3 sm:p-3.5 rounded-2xl border-2 border-[#967853] shadow-md overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              {/* Top Row: Name + 3D Element Orb */}
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h1 className="font-fantasy text-xl sm:text-2xl font-bold tracking-tight text-[#452713] drop-shadow-sm">
                    {isSeen ? selectedSpecies.name : '??? Desconocido'}
                  </h1>

                  {/* Star Rating by Stage */}
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: starCount }).map((_, i) => (
                      <span
                        key={i}
                        className="text-amber-500 text-sm sm:text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                      >
                        ★
                      </span>
                    ))}
                    <span className="text-[10px] font-sans font-bold text-[#7a532f] ml-1">
                      Fase {selectedSpecies.stage}
                    </span>
                  </div>

                  {/* Real Types */}
                  <div className="flex gap-1.5 mt-1.5">
                    {selectedSpecies.types.map((t) => {
                      if (!t) return null;
                      const col = TYPE_COLORS[t];
                      return (
                        <span
                          key={t}
                          className="text-[9px] font-pixel px-2 py-0.5 rounded-md font-bold shadow-sm"
                          style={{
                            backgroundColor: col.bg,
                            color: col.text,
                          }}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Glossy Elemental Orb */}
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2px] bg-gradient-to-br ${orb.bgGradient} shadow-lg flex items-center justify-center shrink-0 border-2`}
                  style={{
                    borderColor: orb.borderColor,
                    boxShadow: `0 4px 12px ${orb.shadowColor}, inset 0 2px 4px rgba(255,255,255,0.7)`,
                  }}
                  title={`Elemento Principal: ${orb.name}`}
                >
                  <div className="w-full h-full rounded-full bg-black/20 flex items-center justify-center">
                    <orb.icon className="w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                  </div>
                </div>
              </div>

              {/* Engraved Bronze Divider */}
              <div className="my-2 h-[2px] bg-gradient-to-r from-transparent via-[#967853] to-transparent opacity-60" />

              {/* Real Player Instance Info OR Wild Data */}
              {ownedInstance ? (
                <div className="space-y-1 text-[#3d2514]">
                  <div className="flex justify-between items-baseline font-sans text-xs">
                    <span className="font-bold text-[#452713] flex items-center gap-1.5">
                      <span className="text-emerald-700">●</span>
                      Nv. <strong className="text-base font-fantasy font-bold">{ownedInstance.level}</strong>
                      <span className="text-[10px] font-semibold text-[#6d4323]">
                        ({isPartyMember ? 'En Equipo' : 'En Santuario'})
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#6d4323]">
                      {ownedInstance.currentXp} / {ownedInstance.xpToNext} EXP
                    </span>
                  </div>

                  {/* Real EXP Progress Bar */}
                  <div className="w-full bg-[#3d2514]/30 h-2.5 rounded-full overflow-hidden p-[1px] shadow-inner border border-[#967853]/60">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, (ownedInstance.currentXp / Math.max(1, ownedInstance.xpToNext)) * 100)
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-sans text-[#5c371d] pt-0.5">
                    <span>Salud: {ownedInstance.currentHp}/{ownedInstance.maxHp} HP</span>
                    <span>Ratio Captura: {selectedSpecies.catchRate}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center text-xs font-sans text-[#5c371d]">
                  <div>
                    <span className="font-bold text-[#452713]">
                      {isSeen ? 'Estado: Avistado en el Ecosistema' : 'Estado: Sin descubrir'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6d4323]">
                    Ratio de Captura: <strong>{selectedSpecies.catchRate}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: REAL COMBAT STATS (6 Real Core Stats with values and gauges) */}
            <div
              className="p-3 rounded-2xl border-2 border-[#967853] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[#6d4323]">
                  {ownedInstance ? 'ESTADÍSTICAS DEL SOULDOLL' : 'ATRIBUTOS BASE DE LA ESPECIE'}
                </span>
                <span className="text-[9px] font-pixel text-[#8c5a2b]">
                  {ownedInstance ? `Nv.${ownedInstance.level}` : 'Base'}
                </span>
              </div>

              {/* 6 Real Stat Cards Grid */}
              <div className="grid grid-cols-3 gap-2">
                {/* HP */}
                <div
                  className="p-2 rounded-xl border border-[#14532d] flex flex-col items-center justify-center shadow-sm relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <span className="font-pixel text-[8px] text-emerald-100 font-bold">HP</span>
                  <span className="font-fantasy text-base sm:text-lg text-white font-extrabold drop-shadow">
                    {isSeen ? stats.hp : '???'}
                  </span>
                </div>

                {/* ATK */}
                <div
                  className="p-2 rounded-xl border border-[#7f1d1d] flex flex-col items-center justify-center shadow-sm relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <span className="font-pixel text-[8px] text-rose-100 font-bold">ATK</span>
                  <span className="font-fantasy text-base sm:text-lg text-white font-extrabold drop-shadow">
                    {isSeen ? stats.atk : '???'}
                  </span>
                </div>

                {/* DEF */}
                <div
                  className="p-2 rounded-xl border border-[#1e3a8a] flex flex-col items-center justify-center shadow-sm relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <span className="font-pixel text-[8px] text-sky-100 font-bold">DEF</span>
                  <span className="font-fantasy text-base sm:text-lg text-white font-extrabold drop-shadow">
                    {isSeen ? stats.def : '???'}
                  </span>
                </div>

                {/* SP. ATK */}
                <div
                  className="p-2 rounded-xl border border-[#581c87] flex flex-col items-center justify-center shadow-sm relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #9333ea 0%, #7e22ce 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <span className="font-pixel text-[8px] text-purple-100 font-bold">SP.ATK</span>
                  <span className="font-fantasy text-base sm:text-lg text-white font-extrabold drop-shadow">
                    {isSeen ? stats.spAtk : '???'}
                  </span>
                </div>

                {/* SP. DEF */}
                <div
                  className="p-2 rounded-xl border border-[#164e63] flex flex-col items-center justify-center shadow-sm relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #0891b2 0%, #0e7490 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <span className="font-pixel text-[8px] text-cyan-100 font-bold">SP.DEF</span>
                  <span className="font-fantasy text-base sm:text-lg text-white font-extrabold drop-shadow">
                    {isSeen ? stats.spDef : '???'}
                  </span>
                </div>

                {/* SPD */}
                <div
                  className="p-2 rounded-xl border border-[#78350f] flex flex-col items-center justify-center shadow-sm relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, #d97706 0%, #b45309 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <span className="font-pixel text-[8px] text-amber-100 font-bold">VEL</span>
                  <span className="font-fantasy text-base sm:text-lg text-white font-extrabold drop-shadow">
                    {isSeen ? stats.spd : '???'}
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 3: REAL LORE & ELEMENTAL AFFINITIES */}
            <div
              className="p-3 rounded-2xl border-2 border-[#967853] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-sans font-extrabold uppercase tracking-wider text-[#6d4323] mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>CRÓNICA DEL ALMA</span>
              </div>
              <p className="font-sans text-xs text-[#5c371d] leading-relaxed mb-2.5">
                {isSeen ? selectedSpecies.description : 'Información oculta. Avista o captura este SoulDoll para registrar su historia.'}
              </p>

              {/* Elemental Affinities */}
              {isSeen && (
                <div className="pt-2 border-t border-[#967853]/40 flex flex-col gap-1.5 text-[10px] font-sans">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-emerald-800 shrink-0">Eficaz contra (x2.0):</span>
                    {affinities.strongAgainst.length > 0 ? (
                      affinities.strongAgainst.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded text-[8px] font-pixel text-white font-bold"
                          style={{ backgroundColor: TYPE_COLORS[t].bg }}
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#7a5836]">Ninguno directo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-rose-800 shrink-0">Vulnerable a (x2.0):</span>
                    {affinities.weakAgainst.length > 0 ? (
                      affinities.weakAgainst.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded text-[8px] font-pixel text-white font-bold"
                          style={{ backgroundColor: TYPE_COLORS[t].bg }}
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#7a5836]">Equilibrado</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 4: REAL LEARNSET & MOVES DATABASE */}
            <div
              className="p-3 rounded-2xl border-2 border-[#967853] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                color: '#3d2514',
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-sans font-extrabold uppercase tracking-wider text-[#6d4323]">
                  <Sword className="w-3.5 h-3.5 text-amber-700" />
                  <span>REPERTORIO DE HABILIDADES</span>
                </div>
                <span className="text-[9px] font-pixel text-[#8c5a2b]">
                  {selectedSpecies.learnset.length} Movimientos
                </span>
              </div>

              {isSeen ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {selectedSpecies.learnset.map((item, idx) => {
                    const move = MOVES_DATABASE[item.moveId];
                    if (!move) return null;
                    const isEquipped = ownedInstance?.moves.some((m) => m.id === move.id);

                    return (
                      <div
                        key={move.id + idx}
                        className={`p-2 rounded-xl border flex justify-between items-center gap-2 transition-all ${
                          isEquipped
                            ? 'bg-[#e4d0b2] border-[#7a4921] shadow-inner'
                            : 'bg-[#ede0c4] border-[#a88a65]/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="font-pixel text-[8px] text-amber-800 bg-[#f7eedc] px-1.5 py-0.5 rounded border border-[#a88a65] shrink-0 font-bold">
                            Nv.{item.level}
                          </span>
                          <div className="truncate">
                            <div className="font-sans text-xs font-bold text-[#452713] flex items-center gap-1">
                              <span>{move.name}</span>
                              {isEquipped && (
                                <span className="text-[8px] font-pixel text-emerald-700 bg-emerald-200/80 px-1 rounded">
                                  ACTIVO
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#6d4323] truncate">
                              {move.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="text-[8px] font-pixel px-1.5 py-0.5 rounded font-bold"
                            style={{
                              backgroundColor: TYPE_COLORS[move.type].bg,
                              color: TYPE_COLORS[move.type].text,
                            }}
                          >
                            {move.type}
                          </span>
                          <span className="font-pixel text-[8px] text-[#452713] font-bold">
                            {move.power > 0 ? `${move.power}P` : 'EST'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 text-center text-xs font-sans text-[#7a5836]">
                  Habilidades desconocidas hasta el avistamiento.
                </div>
              )}
            </div>

            {/* CARD 5: REAL EVOLUTION TREE */}
            {selectedSpecies.evolution && (
              <div
                className="p-3 rounded-2xl border-2 border-[#967853] shadow-md flex items-center justify-between"
                style={{
                  background: 'linear-gradient(180deg, #f6eedb 0%, #ecd9b9 100%)',
                  color: '#3d2514',
                }}
              >
                <div>
                  <div className="text-[9px] font-pixel text-[#8c5a2b]">LÍNEA EVOLUTIVA</div>
                  <div className="font-fantasy text-sm font-bold text-[#452713] flex items-center gap-1.5 mt-0.5">
                    <span>{selectedSpecies.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                    <button
                      onClick={() => {
                        sound.playSelect();
                        if (selectedSpecies.evolution) {
                          setSelectedSpeciesId(selectedSpecies.evolution.evolvesInto);
                        }
                      }}
                      className="underline text-amber-800 hover:text-amber-950 font-bold"
                    >
                      {SOULDOLL_SPECIES[selectedSpecies.evolution.evolvesInto]?.name || 'Forma Ascendida'}
                    </button>
                  </div>
                </div>
                <span className="font-pixel text-[9px] bg-[#4a2b16] text-amber-200 px-2 py-1 rounded-lg border border-[#a26934] shadow-sm">
                  Nivel {selectedSpecies.evolution.level}
                </span>
              </div>
            )}
          </div>

          {/* ==================== RIGHT COLUMN: SPRITE ON STONE ALTAR ==================== */}
          <div className="w-full md:w-[46%] p-3 sm:p-5 flex flex-col justify-between items-center relative border-t-2 md:border-t-0 md:border-l-2 border-[#8c5a2b] bg-[#241309]/80 overflow-hidden">
            {/* Top Bar: Navigation & Real Index Number */}
            <div className="w-full flex justify-between items-center z-10 gap-2 mb-2">
              {/* Previous / Next buttons */}
              <div className="flex items-center gap-1 bg-[#190c06]/90 p-1.5 rounded-xl border border-[#7a4921]">
                <button
                  onClick={handlePrev}
                  className="p-1 rounded-lg hover:bg-[#3d2212] text-amber-300 transition-all"
                  title="Anterior SoulDoll"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-pixel text-[9px] text-amber-200 px-1 font-bold">
                  #{String(currentIndex + 1).padStart(2, '0')}/{speciesList.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1 rounded-lg hover:bg-[#3d2212] text-amber-300 transition-all"
                  title="Siguiente SoulDoll"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Status Ribbon (Capturado / Avistado / En Equipo) */}
              <div className="flex items-center gap-1.5 bg-black/80 px-2.5 py-1.5 rounded-xl border border-amber-600/40 text-[9px] font-pixel text-amber-300">
                {isPartyMember ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>EN EQUIPO</span>
                  </>
                ) : isCaught ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CAPTURADO</span>
                  </>
                ) : isSeen ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>AVISTADO</span>
                  </>
                ) : (
                  <>
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">DESCONOCIDO</span>
                  </>
                )}
              </div>
            </div>

            {/* Central Stage: Character Sprite Standing on Carved Celtic Stone Pedestal */}
            <div className="relative flex-1 w-full flex flex-col items-center justify-center min-h-[220px] sm:min-h-[300px]">
              {/* Front / Back View Toggle */}
              {isSeen && (
                <button
                  onClick={() => {
                    sound.playSelect();
                    setIsBackView(!isBackView);
                  }}
                  className="absolute top-2 right-2 z-20 px-2.5 py-1 rounded-lg bg-[#3d2212]/90 hover:bg-[#522e18] text-amber-200 border border-[#8c5a2b] font-pixel text-[8px] flex items-center gap-1 shadow-md transition-all"
                  title="Girar vista del SoulDoll"
                >
                  <RotateCw className="w-3 h-3 text-amber-400" />
                  <span>{isBackView ? 'ESPALDA' : 'FRENTE'}</span>
                </button>
              )}

              {/* Character Sprite Canvas */}
              {isSeen ? (
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="pixelated max-h-[190px] sm:max-h-[250px] w-auto drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] filter active:scale-105 transition-transform cursor-pointer"
                    onClick={() => {
                      sound.playSelect();
                      setIsBackView(!isBackView);
                    }}
                  />

                  {/* Elliptical Contact Shadow */}
                  <div className="w-28 sm:w-36 h-4 bg-black/60 rounded-full blur-[2px] -mt-2 mb-0.5" />
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center text-amber-700/60">
                  <span className="font-fantasy text-6xl font-bold mb-2">?</span>
                  <p className="font-pixel text-[9px] text-amber-600/80 max-w-[200px]">
                    Alma aún no avistada en las praderas ni santuarios.
                  </p>
                </div>
              )}

              {/* ================= CARVED CELTIC STONE PEDESTAL (DAIS) ================= */}
              <div className="relative w-48 sm:w-64 h-16 sm:h-20 shrink-0 -mt-3 z-0">
                <svg
                  viewBox="0 0 240 80"
                  className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.95)]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="topStoneGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8d949c" />
                      <stop offset="100%" stopColor="#535962" />
                    </linearGradient>
                    <linearGradient id="baseStoneGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#434851" />
                      <stop offset="100%" stopColor="#252930" />
                    </linearGradient>
                  </defs>

                  {/* Top Pedestal Surface */}
                  <polygon
                    points="30,8 210,8 234,30 210,50 30,50 6,30"
                    fill="url(#topStoneGrad)"
                    stroke="#a0a7b0"
                    strokeWidth="1.5"
                  />

                  {/* Carved Celtic Knot Pattern Band */}
                  <path
                    d="M 28 32 C 34 26, 40 38, 46 32 C 52 26, 58 38, 64 32 C 70 26, 76 38, 82 32 C 88 26, 94 38, 100 32 C 106 26, 112 38, 118 32 C 124 26, 130 38, 136 32 C 142 26, 148 38, 154 32 C 160 26, 166 38, 172 32 C 178 26, 184 38, 190 32 C 196 26, 202 38, 208 32"
                    stroke="#22252a"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 28 32 C 34 26, 40 38, 46 32 C 52 26, 58 38, 64 32 C 70 26, 76 38, 82 32 C 88 26, 94 38, 100 32 C 106 26, 112 38, 118 32 C 124 26, 130 38, 136 32 C 142 26, 148 38, 154 32 C 160 26, 166 38, 172 32 C 178 26, 184 38, 190 32 C 196 26, 202 38, 208 32"
                    stroke="#c5ccd6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Stone Plinth Thickness & Base */}
                  <polygon
                    points="6,30 234,30 234,44 210,64 30,64 6,44"
                    fill="url(#baseStoneGrad)"
                    stroke="#1f2328"
                    strokeWidth="2"
                  />
                  <line x1="30" y1="50" x2="30" y2="64" stroke="#181a1f" strokeWidth="2" />
                  <line x1="210" y1="50" x2="210" y2="64" stroke="#181a1f" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Bottom Real Encounter & Species Status Card */}
            <div className="w-full bg-[#1b0e07] p-2.5 rounded-xl border border-[#7a4921] shadow-inner text-center z-10">
              {ownedInstance ? (
                <div className="text-[11px] font-sans text-amber-200">
                  <span className="text-emerald-400 font-bold">✓ Sintonizado: </span>
                  {isPartyMember ? 'En tu equipo activo de combate' : 'En el santuario de almas'}
                </div>
              ) : isSeen ? (
                <div className="text-[11px] font-sans text-sky-200">
                  <span className="text-sky-400 font-bold">Avistado: </span>
                  Habita en las zonas de hierba del mapa
                </div>
              ) : (
                <div className="text-[11px] font-sans text-slate-400">
                  Explora el mapa para registrar esta alma
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. SLIDE-OUT SOULDOLL COLLECTION DRAWER */}
        {showDrawer && (
          <div className="absolute inset-x-0 bottom-0 top-[52px] z-30 bg-[#1c0e07]/95 backdrop-blur-md border-t-2 border-[#8c5a2b] p-4 flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h3 className="font-fantasy text-sm text-amber-200 font-bold tracking-wide">
                  ÍNDICE COMPLETO DE ALMAS PRIMORDIALES
                </h3>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1 rounded-lg bg-[#3d2212] hover:bg-[#522e18] text-amber-200 border border-[#8c5a2b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Element Filter Buttons */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-pixel text-[9px] transition-all ${
                  typeFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-[#2e180c] text-amber-200 border border-[#7a4921]'
                }`}
              >
                TODOS ({speciesList.length})
              </button>
              {(
                [
                  'Fire',
                  'Water',
                  'Nature',
                  'Electric',
                  'Earth',
                  'Frost',
                  'Wind',
                  'Shadow',
                  'Light',
                  'Poison',
                ] as ElementalType[]
              ).map((t) => {
                const elementOrb = getElementOrb(t);
                const count = speciesList.filter((s) => s.types.includes(t)).length;
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-lg font-pixel text-[9px] whitespace-nowrap transition-all flex items-center gap-1 ${
                      typeFilter === t
                        ? 'ring-2 ring-white text-white font-bold'
                        : 'opacity-80 hover:opacity-100 text-slate-200'
                    }`}
                    style={{ backgroundColor: elementOrb.borderColor }}
                  >
                    <span>{t}</span>
                    <span className="text-[8px] opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Grid of SoulDolls */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pr-1 scrollbar-thin">
              {filteredList.map((species, i) => {
                const caught = state.caughtSoulDolls.has(species.id);
                const seen = state.seenSoulDolls.has(species.id) || caught;
                const inParty = state.playerParty.some((d) => d.speciesId === species.id);
                const isSelected = selectedSpeciesId === species.id;

                return (
                  <button
                    key={species.id}
                    onClick={() => {
                      sound.playSelect();
                      setSelectedSpeciesId(species.id);
                      setShowDrawer(false);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-amber-900/60 border-amber-400 ring-2 ring-amber-300'
                        : 'bg-[#2b170c] hover:bg-[#3d2212] border-[#7a4921]'
                    }`}
                  >
                    {/* Species Initial / Element Color Badge */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center font-pixel text-xs font-bold text-white shadow shrink-0 border border-white/20"
                      style={{
                        backgroundColor: seen ? species.colorTheme.primary : '#334155',
                      }}
                    >
                      {seen ? species.name[0] : '?'}
                    </div>

                    <div className="overflow-hidden">
                      <div className="font-fantasy text-xs font-bold text-amber-200 truncate">
                        {seen ? species.name : '???'}
                      </div>
                      <div className="text-[9px] font-pixel text-[#a87d50] flex items-center gap-1 mt-0.5">
                        <span>#{String(i + 1).padStart(2, '0')}</span>
                        {inParty && (
                          <span className="text-amber-400 text-[8px] font-bold">[EQUIPO]</span>
                        )}
                        {!inParty && caught && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {seen && !caught && <Eye className="w-3 h-3 text-sky-400" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

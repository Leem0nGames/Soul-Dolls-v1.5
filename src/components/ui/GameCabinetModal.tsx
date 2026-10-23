import React from 'react';
import { X } from 'lucide-react';
import { sound } from '../../game/audio/SoundEffects';

interface GameCabinetModalProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export const GameCabinetModal: React.FC<GameCabinetModalProps> = ({
  title,
  subtitle,
  icon,
  headerRight,
  onClose,
  children,
  maxWidth = 'max-w-4xl',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none touch-manipulation overflow-hidden">
      {/* Outer Ornate Bronze & Engraved Wood Frame (Brave Frontier / SoulDolls Cabinet Aesthetic) */}
      <div
        className={`relative w-full ${maxWidth} h-full max-h-[96dvh] rounded-3xl flex flex-col overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.95)] border-4 border-[#8c5a2b]`}
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

        {/* TOP HEADER STATUS BAR */}
        <div className="relative z-10 px-3 sm:px-5 py-2.5 bg-[#2b170c] border-b-2 border-[#8c5a2b] shadow-md flex justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {icon}
            <div className="flex flex-col truncate">
              <span className="font-fantasy text-amber-200 text-xs sm:text-sm font-bold tracking-wider truncate">
                {title}
              </span>
              {subtitle && (
                <span className="font-sans text-[10px] sm:text-[11px] text-[#d9c09e] truncate">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              onClick={() => {
                sound.playSelect();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-[#5c2419] hover:bg-[#782e20] text-amber-100 border border-[#b44835] shadow transition-all cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MAIN BODY VIEWPORT */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

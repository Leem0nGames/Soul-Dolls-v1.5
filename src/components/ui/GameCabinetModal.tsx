import React from 'react';
import { X } from 'lucide-react';
import { sound } from '../../game/audio/SoundEffects';
import { BrandButton } from './BrandKit';

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
    <div className="sd-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 select-none touch-manipulation overflow-hidden">
      <div className={`sd-cabinet-frame sd-ornate-frame relative w-full ${maxWidth} h-full max-h-[96dvh] rounded-2xl flex flex-col overflow-hidden`}>
        {/* TOP HEADER STATUS BAR */}
        <div className="sd-cabinet-header relative z-10 px-3 sm:px-5 py-2.5 flex justify-between items-center gap-2 shrink-0">
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
            <BrandButton
              variant="danger"
              onClick={() => {
                sound.playSelect();
                onClose();
              }}
              className="min-w-9 min-h-9 p-1.5 rounded-lg text-amber-100 flex items-center justify-center"
              title="Cerrar"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </BrandButton>
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

import React, { useEffect, useRef, useState } from 'react';
import { pixelGenerator } from '../../game/graphics/PixelArtGenerator';

interface SoulDollSpriteProps {
  speciesId: string;
  isBackView?: boolean;
  className?: string;
  silhouette?: boolean;
  alt?: string;
  style?: React.CSSProperties;
  crop?: 'full' | 'bust'; // 'bust' crops upper torso/head for portraits
}

/**
 * SoulDollSprite
 * Renders authentic character sprite artwork extracted and key-cleaned
 * from the SoulDoll sprite sheets. Supports full body or cinematic bust/portrait framing.
 */
export const SoulDollSprite: React.FC<SoulDollSpriteProps> = ({
  speciesId,
  isBackView = false,
  className = '',
  silhouette = false,
  alt = 'SoulDoll',
  style,
  crop = 'full',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const render = () => {
      if (!isMounted) return;
      const srcCanvas = pixelGenerator.getSpeciesCanvas(speciesId, isBackView);
      const dest = canvasRef.current;
      if (!dest) return;

      if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
        const srcW = srcCanvas.width;
        const srcH = srcCanvas.height;

        // If bust crop is requested, take upper 45% (head, shoulders, and bust)
        const targetH = crop === 'bust' ? Math.floor(srcH * 0.45) : srcH;

        dest.width = srcW;
        dest.height = targetH;
        const ctx = dest.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, srcW, targetH);

          if (silhouette) {
            ctx.drawImage(srcCanvas, 0, 0, srcW, targetH, 0, 0, srcW, targetH);
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = '#14101c';
            ctx.fillRect(0, 0, srcW, targetH);
            ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.drawImage(srcCanvas, 0, 0, srcW, targetH, 0, 0, srcW, targetH);
          }
          setHasRendered(true);
        }
      }
    };

    render();
    const unsub = pixelGenerator.onSoulDollSpritesheetLoaded(() => {
      render();
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [speciesId, isBackView, silhouette, crop]);

  return (
    <canvas
      ref={canvasRef}
      className={`pixelated object-contain transition-opacity duration-150 ${
        hasRendered ? 'opacity-100' : 'opacity-0'
      } ${crop === 'bust' ? 'object-top scale-150 sm:scale-175 translate-y-1' : ''} ${className}`}
      style={style}
      aria-label={alt}
    />
  );
};

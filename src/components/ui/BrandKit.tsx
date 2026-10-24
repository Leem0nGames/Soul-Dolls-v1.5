import React from 'react';

export const BRAND_TOKENS = {
  ink: '#14101C',
  wood: '#2A1F2D',
  bronze: '#8A6A3B',
  gold: '#E8B84A',
  ki: '#5FE3D2',
  soul: '#9B6BFF',
  rift: '#C2234B',
} as const;

type BrandPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'surface' | 'raised' | 'inset';
};

export function BrandPanel({ variant = 'surface', className = '', ...props }: BrandPanelProps) {
  return <div className={`sd-brand-panel sd-brand-panel-${variant} sd-ornate-frame ${className}`} {...props} />;
}

type BrandButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'ki' | 'soul' | 'select';
};

export function BrandButton({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: BrandButtonProps) {
  return <button type={type} className={`sd-brand-button sd-brand-button-${variant} ${className}`} {...props} />;
}

export function BrandBadge({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`sd-brand-badge ${className}`} {...props} />;
}

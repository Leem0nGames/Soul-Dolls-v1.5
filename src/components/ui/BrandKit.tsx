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

type BrandWidgetProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: React.ReactNode;
  variant?: 'gold' | 'ki' | 'soul' | 'danger';
};

export function BrandWidget({
  label,
  value,
  variant = 'gold',
  className = '',
  ...props
}: BrandWidgetProps) {
  return (
    <div className={`sd-brand-widget sd-brand-widget-${variant} ${className}`} {...props}>
      <span className="sd-type-label sd-brand-widget-label">{label}</span>
      <span className="sd-type-value">{value}</span>
    </div>
  );
}

type BrandProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: number;
  max: number;
  variant?: 'gold' | 'ki' | 'soul' | 'danger';
};

export function BrandProgress({
  label,
  value,
  max,
  variant = 'soul',
  className = '',
  ...props
}: BrandProgressProps) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={`sd-brand-progress sd-brand-progress-${variant} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(0, value))}
      {...props}
    >
      <span className="sd-brand-progress-fill" style={{ width: `${percentage}%` }} />
    </div>
  );
}

type BrandSectionTitleProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
};

export function BrandSectionTitle({ icon, className = '', children, ...props }: BrandSectionTitleProps) {
  return (
    <div className={`sd-brand-section-title ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </div>
  );
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

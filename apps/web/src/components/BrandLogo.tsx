import styles from './BrandLogo.module.css';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
};

function resolveSizeClass(size: NonNullable<BrandLogoProps['size']>): string {
  if (size === 'sm') return styles.sm ?? '';
  if (size === 'lg') return styles.lg ?? '';
  if (size === 'xl') return styles.xl ?? '';
  return styles.md ?? '';
}

export function BrandLogo({ size = 'md', className = '', alt = 'MedLedger logo' }: BrandLogoProps) {
  const sizeClass = resolveSizeClass(size);
  return (
    <img
      className={`${styles.logo} ${sizeClass} ${className}`.trim()}
      src="/medledger-logo.png"
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}

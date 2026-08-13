import Image from 'next/image';
import { cn } from '@/lib/cn';

interface BrandMarkProps {
  className?: string;
  size?: number;
  priority?: boolean;
}

/**
 * The Seder mark: a samekh-inspired loop with completion built into its centre.
 * The wordmark stays live text so it remains sharp, localisable and accessible.
 */
export function BrandMark({ className, size = 32, priority = false }: BrandMarkProps) {
  return (
    <Image
      src="/seder/brand/seder-logo-v2.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 object-contain', className)}
    />
  );
}

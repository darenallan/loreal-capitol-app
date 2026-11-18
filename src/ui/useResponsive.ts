import { useWindowDimensions } from 'react-native';
import { breakpoints } from '../theme';

export type Breakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop';

/**
 * Hook responsive : téléphone (<640), tablette/iPad (640-1023),
 * portable (1024-1439), desktop (>=1440).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const bp: Breakpoint =
    width >= breakpoints.desktop ? 'desktop'
      : width >= breakpoints.laptop ? 'laptop'
        : width >= breakpoints.tablet ? 'tablet'
          : 'phone';

  const isPhone = bp === 'phone';
  const isMobile = isPhone;
  const isTablet = bp === 'tablet';
  const isWide = bp === 'laptop' || bp === 'desktop';

  /** Valeur selon le breakpoint, avec repli sur la plus petite définie */
  function pick<T>(v: { phone: T; tablet?: T; laptop?: T; desktop?: T }): T {
    if (bp === 'desktop') return v.desktop ?? v.laptop ?? v.tablet ?? v.phone;
    if (bp === 'laptop') return v.laptop ?? v.tablet ?? v.phone;
    if (bp === 'tablet') return v.tablet ?? v.phone;
    return v.phone;
  }

  const gutter = pick({ phone: 16, tablet: 24, laptop: 32, desktop: 40 });
  const maxContent = pick({ phone: 640, tablet: 900, laptop: 1180, desktop: 1360 });

  return { width, height, bp, isPhone, isMobile, isTablet, isWide, pick, gutter, maxContent, isLandscape: width > height };
}

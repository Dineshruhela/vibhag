/**
 * Splitmaro Motion System
 * Shared animation presets using react-native-reanimated
 */
import {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    FadeOutDown,
    FadeOutUp,
    LinearTransition,
    SlideInRight,
    SlideOutLeft,
    withSpring,
    withTiming,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';

// ─── Spring configs ──────────────────────────────────────────────
export const Spring = {
  /** Quick, snappy response — for button presses, toggles */
  snappy: { damping: 18, stiffness: 350, mass: 0.8 },
  /** Standard feel — for list items, cards */
  standard: { damping: 22, stiffness: 280, mass: 1 },
  /** Bouncy — for FAB, modals entering */
  bouncy: { damping: 14, stiffness: 220, mass: 1 },
  /** Gentle — for tab transitions, large layout shifts */
  gentle: { damping: 28, stiffness: 180, mass: 1 },
};

// ─── Timing configs ──────────────────────────────────────────────
export const Timing = {
  instant: 80,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
};

export const Eases = {
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  spring: Easing.elastic(0.6),
};

// ─── Enter animations ────────────────────────────────────────────
export const Enter = {
  fade: FadeIn.duration(Timing.normal),
  fadeUp: FadeInUp.duration(Timing.normal).springify().damping(22).stiffness(280),
  fadeDown: FadeInDown.duration(Timing.normal).springify().damping(22).stiffness(280),
  slideRight: SlideInRight.duration(Timing.normal).springify().damping(22),
  zoom: ZoomIn.duration(Timing.normal).springify().damping(20),
  /** Staggered list entry — use with index * delay */
  stagger: (index: number) =>
    FadeInDown.delay(index * 40)
      .duration(Timing.normal)
      .springify()
      .damping(22)
      .stiffness(280),
};

// ─── Exit animations ─────────────────────────────────────────────
export const Exit = {
  fade: FadeOut.duration(Timing.fast),
  fadeUp: FadeOutUp.duration(Timing.fast),
  fadeDown: FadeOutDown.duration(Timing.fast),
  slideLeft: SlideOutLeft.duration(Timing.fast),
  zoom: ZoomOut.duration(Timing.fast),
};

// ─── Layout transition ───────────────────────────────────────────
export const LayoutTransition = LinearTransition.springify()
  .damping(Spring.standard.damping)
  .stiffness(Spring.standard.stiffness);

// ─── Press scale helpers ─────────────────────────────────────────
export const pressIn = (scale = 0.97) => withSpring(scale, Spring.snappy);
export const pressOut = () => withSpring(1, Spring.snappy);

// ─── Fade timing helper ──────────────────────────────────────────
export const fadeToValue = (value: number, duration = Timing.normal) =>
  withTiming(value, { duration, easing: Eases.out });

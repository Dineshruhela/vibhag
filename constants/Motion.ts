/**
 * Splitmaro Motion System — Pro Level
 * High performance spring & timing configurations inspired by Apple iOS & Linear
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

// ─── Pro Spring Configs ──────────────────────────────────────────
export const Spring = {
  /** Ultra-responsive feedback — for buttons, chips, micro-interactions */
  snappy: { damping: 20, stiffness: 420, mass: 0.6 },
  /** Silky fluid feel — for cards, modals, sheets */
  modal: { damping: 24, stiffness: 360, mass: 0.65 },
  /** Standard natural feel — for lists and general UI elements */
  standard: { damping: 24, stiffness: 320, mass: 0.8 },
  /** Energetic pop — for badges, achievements, icons */
  bouncy: { damping: 16, stiffness: 320, mass: 0.75 },
  /** Gentle ease — for large container expansions */
  gentle: { damping: 30, stiffness: 220, mass: 1 },
};

// ─── Pro Timing Configs ──────────────────────────────────────────
export const Timing = {
  instant: 60,
  fast: 140,
  normal: 220,
  medium: 300,
  slow: 450,
};

export const Eases = {
  out: Easing.out(Easing.cubic),
  outQuart: Easing.out(Easing.poly(4)),
  inOut: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// ─── Pro Enter Animations ────────────────────────────────────────
export const Enter = {
  fade: FadeIn.duration(Timing.fast),
  fadeUp: FadeInUp.springify().damping(Spring.standard.damping).stiffness(Spring.standard.stiffness).mass(Spring.standard.mass),
  fadeDown: FadeInDown.springify().damping(Spring.standard.damping).stiffness(Spring.standard.stiffness).mass(Spring.standard.mass),
  slideRight: SlideInRight.springify().damping(Spring.modal.damping).stiffness(Spring.modal.stiffness),
  zoom: ZoomIn.springify().damping(Spring.modal.damping).stiffness(Spring.modal.stiffness).mass(Spring.modal.mass),
  /** Staggered list entry with optimized delay for rapid rendering */
  stagger: (index: number) =>
    FadeInDown.delay(Math.min(index * 25, 250))
      .springify()
      .damping(Spring.standard.damping)
      .stiffness(Spring.standard.stiffness)
      .mass(Spring.standard.mass),
};

// ─── Pro Exit Animations ─────────────────────────────────────────
export const Exit = {
  fade: FadeOut.duration(Timing.fast),
  fadeUp: FadeOutUp.duration(Timing.fast),
  fadeDown: FadeOutDown.duration(Timing.fast),
  slideLeft: SlideOutLeft.duration(Timing.fast),
  zoom: ZoomOut.duration(Timing.fast),
};

// ─── Layout Transitions ──────────────────────────────────────────
export const LayoutTransition = LinearTransition.springify()
  .damping(Spring.standard.damping)
  .stiffness(Spring.standard.stiffness)
  .mass(Spring.standard.mass);

// ─── Press Scale Helpers ─────────────────────────────────────────
export const pressIn = (scale = 0.96) => withSpring(scale, Spring.snappy);
export const pressOut = () => withSpring(1, Spring.snappy);

// ─── Fade Timing Helper ──────────────────────────────────────────
export const fadeToValue = (value: number, duration = Timing.normal) =>
  withTiming(value, { duration, easing: Eases.outQuart });

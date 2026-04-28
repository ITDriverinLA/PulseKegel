import { Easing } from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Easing curve constants
// ---------------------------------------------------------------------------

// Linear — used for repeating animations (pulse counter, colour cycle)
export const ANIM_EASING_LINEAR = Easing.linear;

// Enter — smooth deceleration used for UI ring / progress ring updates
export const ANIM_EASING_ENTER = Easing.out(Easing.ease);

// Breath — symmetric ease-in-out used for breathwork inhale / exhale
export const ANIM_EASING_BREATH = Easing.inOut(Easing.quad);

// Pulse — symmetric ease-in-out used for hold-top / hold-bottom oscillation
export const ANIM_EASING_PULSE = Easing.inOut(Easing.ease);

// Drain — fast deceleration used for draining / resetting progress and quick
//         contract movements (quickFlicks, elevator steps, contractRelax)
export const ANIM_EASING_DRAIN = Easing.out(Easing.cubic);

// Progress — gentle deceleration used for filling the ring/bar on slow holds
//            and reverse segments
export const ANIM_EASING_PROGRESS = Easing.out(Easing.quad);

// ---------------------------------------------------------------------------
// Animation duration constants
// ---------------------------------------------------------------------------

// Screen / Navigation transitions
export const ANIM_DURATION_ENTER = 300;
export const ANIM_DURATION_EXIT = 175;
export const ANIM_DURATION_EXIT_COMPLETE = 250;

// Content section enters (staggered FadeInDown)
export const ANIM_DURATION_CONTENT = 400;
export const ANIM_DURATION_CONTENT_SLOW = 500;
export const ANIM_DURATION_INTRO = 600;

// Zoom enters
export const ANIM_DURATION_ZOOM = 350;
export const ANIM_DURATION_ZOOM_ENTER = 400;

// Micro-interactions (tap feedback, shake, quick settle)
export const ANIM_DURATION_MICRO = 150;
export const ANIM_DURATION_MICRO_SETTLE = 200;

// Breathwork / Pulse animations
export const ANIM_DURATION_PULSE = 2400;
export const ANIM_DURATION_HOLD_PULSE = 1200;
export const ANIM_DURATION_HOLD_PULSE_BOTTOM = 1400;
export const ANIM_DURATION_COLOR_CYCLE = 18000;

// Progress / timer animations
export const ANIM_DURATION_PROGRESS_FAST = 1500;
export const ANIM_DURATION_PROGRESS_SLOW = 3000;
export const ANIM_DURATION_PROGRESS_DRAIN = 600;

// Badge / Toast
export const ANIM_DURATION_BADGE_APPEAR = 400;
export const ANIM_DURATION_BADGE_GLOW = 1500;
export const ANIM_DURATION_BADGE_SHIMMER = 2000;

// Loading / skeleton pulse
export const ANIM_DURATION_PULSE_LOADING = 800;

// ---------------------------------------------------------------------------
// Animation delay constants
// ---------------------------------------------------------------------------

// Stagger base multipliers – use as: index * ANIM_DELAY_STAGGER_*
export const ANIM_DELAY_STAGGER_XS = 50; // gentle stagger (ProgramOverview)
export const ANIM_DELAY_STAGGER_SM = 80; // compact stagger (WorkoutPicker, ReviewHistory)
export const ANIM_DELAY_STAGGER_BASE = 100; // standard stagger (BreathworkModeSelector)

// Sequential reveal steps – fixed delays for content entering in order
export const ANIM_DELAY_XS = 50; // first step when using a half-step cadence
export const ANIM_DELAY_SHORT = 100; // first standard step
export const ANIM_DELAY_MED = 200; // second standard step
export const ANIM_DELAY_LONG = 300; // third standard step
export const ANIM_DELAY_XL = 400; // fourth standard step
export const ANIM_DELAY_2XL = 500; // fifth standard step
export const ANIM_DELAY_3XL = 600; // sixth standard step
export const ANIM_DELAY_4XL = 700; // seventh standard step

// Mid-step delays used in fine-grained stagger sequences
export const ANIM_DELAY_150 = 150;
export const ANIM_DELAY_175 = 175;
export const ANIM_DELAY_225 = 225;
export const ANIM_DELAY_250 = 250;
export const ANIM_DELAY_320 = 320;
export const ANIM_DELAY_350 = 350;
export const ANIM_DELAY_450 = 450;

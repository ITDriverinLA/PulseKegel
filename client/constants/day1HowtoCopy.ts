/**
 * P7a Day-1 how-to card copy.
 * Claims-cleared 2026-11-04. Edit the strings here only.
 * Gender-neutral: the same lines are used for every anatomy type.
 */
export const DAY1_HOWTO_COPY = {
  headline: "Before your first rep",
  lines: [
    "Find it: it's the muscle you'd use to stop your pee. That's just to find it. Don't practice while peeing.",
    "Lift and hold. Keep breathing, and keep your glutes, thighs and abs relaxed.",
    "How you'll know you're doing it right: a gentle lift inside, and nothing else moves.",
  ],
  continueLabel: "Got it — start",
  skipLabel: "Skip",
  moreTipsLabel: "More form tips",
} as const;

export type Day1HowtoCopy = typeof DAY1_HOWTO_COPY;

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "streak" | "milestone" | "phase" | "mastery" | "special";
  color: string;
  glowColor: string;
  criteria: BadgeCriteria;
}

export interface BadgeCriteria {
  type:
    | "streak"
    | "sessions"
    | "minutes"
    | "phase"
    | "perfect_week"
    | "program_complete";
  value: number;
}

export interface EarnedBadge {
  badgeId: string;
  earnedDate: string;
}

const NEON_GREEN = "#00ff88";
const NEON_CYAN = "#00d4ff";
const NEON_PINK = "#ff6b9d";
const NEON_PURPLE = "#a855f7";
const NEON_GOLD = "#fbbf24";
const NEON_ORANGE = "#fb923c";

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_workout",
    name: "First Step",
    description: "Complete your very first workout",
    icon: "play",
    category: "milestone",
    color: NEON_CYAN,
    glowColor: "rgba(0, 212, 255, 0.3)",
    criteria: { type: "sessions", value: 1 },
  },
  {
    id: "sessions_10",
    name: "Getting Started",
    description: "Complete 10 workout sessions",
    icon: "trending-up",
    category: "milestone",
    color: NEON_CYAN,
    glowColor: "rgba(0, 212, 255, 0.3)",
    criteria: { type: "sessions", value: 10 },
  },
  {
    id: "sessions_25",
    name: "Committed",
    description: "Complete 25 workout sessions",
    icon: "award",
    category: "milestone",
    color: NEON_CYAN,
    glowColor: "rgba(0, 212, 255, 0.3)",
    criteria: { type: "sessions", value: 25 },
  },
  {
    id: "sessions_50",
    name: "Half Century",
    description: "Complete 50 workout sessions",
    icon: "star",
    category: "milestone",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.3)",
    criteria: { type: "sessions", value: 50 },
  },
  {
    id: "sessions_100",
    name: "Centurion",
    description: "Complete 100 workout sessions",
    icon: "shield",
    category: "milestone",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.3)",
    criteria: { type: "sessions", value: 100 },
  },

  {
    id: "streak_3",
    name: "Three-Peat",
    description: "Maintain a 3-day workout streak",
    icon: "zap",
    category: "streak",
    color: NEON_GREEN,
    glowColor: "rgba(0, 255, 136, 0.3)",
    criteria: { type: "streak", value: 3 },
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Maintain a 7-day workout streak",
    icon: "zap",
    category: "streak",
    color: NEON_GREEN,
    glowColor: "rgba(0, 255, 136, 0.3)",
    criteria: { type: "streak", value: 7 },
  },
  {
    id: "streak_14",
    name: "Fortnight Force",
    description: "Maintain a 14-day workout streak",
    icon: "zap",
    category: "streak",
    color: NEON_GREEN,
    glowColor: "rgba(0, 255, 136, 0.3)",
    criteria: { type: "streak", value: 14 },
  },
  {
    id: "streak_30",
    name: "Iron Will",
    description: "Maintain a 30-day workout streak",
    icon: "zap",
    category: "streak",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.3)",
    criteria: { type: "streak", value: 30 },
  },
  {
    id: "streak_60",
    name: "Unstoppable",
    description: "Maintain a 60-day workout streak",
    icon: "zap",
    category: "streak",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.3)",
    criteria: { type: "streak", value: 60 },
  },
  {
    id: "streak_90",
    name: "Iron Core",
    description: "Maintain a 90-day workout streak",
    icon: "award",
    category: "streak",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.4)",
    criteria: { type: "streak", value: 90 },
  },

  {
    id: "phase_control",
    name: "Control Mastered",
    description: "Complete the Control Phase (Weeks 1-2)",
    icon: "target",
    category: "phase",
    color: NEON_PURPLE,
    glowColor: "rgba(168, 85, 247, 0.3)",
    criteria: { type: "phase", value: 2 },
  },
  {
    id: "phase_strength",
    name: "Strength Unlocked",
    description: "Complete the Strength Phase (Weeks 3-6)",
    icon: "target",
    category: "phase",
    color: NEON_PURPLE,
    glowColor: "rgba(168, 85, 247, 0.3)",
    criteria: { type: "phase", value: 6 },
  },
  {
    id: "phase_power",
    name: "Power Surge",
    description: "Complete the Power Phase (Weeks 7-10)",
    icon: "target",
    category: "phase",
    color: NEON_PINK,
    glowColor: "rgba(255, 107, 157, 0.3)",
    criteria: { type: "phase", value: 10 },
  },
  {
    id: "phase_maintenance",
    name: "Program Graduate",
    description: "Complete the full 12-week program",
    icon: "award",
    category: "phase",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.4)",
    criteria: { type: "program_complete", value: 12 },
  },

  {
    id: "minutes_60",
    name: "Hour Power",
    description: "Accumulate 60 minutes of total exercise",
    icon: "clock",
    category: "mastery",
    color: NEON_ORANGE,
    glowColor: "rgba(251, 146, 60, 0.3)",
    criteria: { type: "minutes", value: 60 },
  },
  {
    id: "minutes_300",
    name: "Five Hours Strong",
    description: "Accumulate 300 minutes of total exercise",
    icon: "clock",
    category: "mastery",
    color: NEON_ORANGE,
    glowColor: "rgba(251, 146, 60, 0.3)",
    criteria: { type: "minutes", value: 300 },
  },
  {
    id: "minutes_600",
    name: "Ten Hour Titan",
    description: "Accumulate 600 minutes of total exercise",
    icon: "clock",
    category: "mastery",
    color: NEON_GOLD,
    glowColor: "rgba(251, 191, 36, 0.3)",
    criteria: { type: "minutes", value: 600 },
  },

  {
    id: "perfect_week",
    name: "Perfect Week",
    description: "Complete every scheduled workout in a week",
    icon: "check-circle",
    category: "special",
    color: NEON_PINK,
    glowColor: "rgba(255, 107, 157, 0.3)",
    criteria: { type: "perfect_week", value: 1 },
  },
];

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
}

export function getBadgesByCategory(
  category: BadgeDefinition["category"],
): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

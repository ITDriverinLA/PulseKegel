# PulseKegel - Pelvic Floor Workout App

## Overview
PulseKegel is a mobile app for daily pelvic floor (Kegel) workouts with real-time visual cues and haptic feedback. Built with Expo (React Native) and Express.js backend.

## Key Features
- 12-week progressive workout program with 7 exercise types (slow holds, quick flicks, elevator, reverse, breathing, block rest, contract-relax)
- **Quick Workout Selection** - Choose individual workouts outside the 12-week program (Quick Flicks, Slow Holds, Endurance, Elevator, Reverse Kegels, Contract-Relax, Full Daily, Coordination)
- Real-time workout player with SQUEEZE/REST/BREATHE visual cues and haptic feedback
- **Dual workout visualizations**: Vertical LED-style power bar in dark mode; circular progress ring in light mode — both with exercise-specific animations (fills to 100%, slower 600ms return)
- Progress tracking with streak counter, calendar view (with distinct workout/rest day/today indicators and legend), and statistics
- **Badge/Achievement System** - 18 badges across 5 categories (Streaks, Milestones, Program Phases, Mastery, Special) with locked/unlocked states, detail modals, and toast notifications on earn
- **AI Review History** - Save and reread all past weekly AI progress insights
- **Breathwork Sessions** - Three 5-minute guided rest-day breathing modes (Calm & Reset box breathing, Energize & Focus physiological sigh + coherence, Pelvic Floor Connect diaphragmatic + PF awareness) with voice-guided Mia MP3 clips, animated breathing circle, haptic feedback, and optional streak logging
- Recovery mode for reduced intensity workouts
- **Sound Effects & Ambient Audio** - Phase transition sounds (squeeze, rest, breathe), countdown beeps, workout completion celebration, badge earned fanfare, plus 8 optional ambient tracks during workouts with independent volume controls
- **Music Management Screen** - Dedicated screen for track selection, preview, shuffle mode (Off/All/Selected), per-track shuffle inclusion checkboxes, and volume control
- Customizable haptic intensity and rest cue styles
- One-time onboarding with safety disclaimers
- **Light/Dark Theme System** - Toggle between dark cyberpunk theme and light theme via Settings
- Futuristic cyberpunk UI with dark gradients and neon accents (dark mode) or soft grays with toned-down accents (light mode)

## Workout Program Structure

Each week is exactly 7 calendar days. If you start on a Wednesday, Week 1 ends the following Tuesday.

### Weeks 1-2: Control Phase (3 workouts + 4 rest days)
- Day 1: Strength Training
- Day 2: Rest
- Day 3: Strength Training
- Day 4: Rest
- Day 5: Speed Training
- Days 6-7: Rest

### Weeks 3-6: Strength Phase (5 workouts + 2 rest days)
- Day 1: Strength, Day 2: Speed, Day 3: Strength
- Day 4: Rest
- Day 5: Speed, Day 6: Coordination
- Day 7: Rest

### Weeks 7-10: Power Phase (7 workouts daily)
- Alternating "Daily Driver" and "Coordination Day" workouts
- 20-30 second breathing breaks between exercise blocks

**Daily Driver (~8 minutes):**
- Block 1: Slow Holds (8 reps × 8s squeeze / 12s rest)
- Block Rest: 25s breathing break
- Block 2: Quick Flicks (20 reps × 1s/1s)
- Block Rest: 25s breathing break
- Block 3: Contract-Relax (10 reps × 2s/4s)
- Block Rest: 25s breathing break
- Block 4: Reverse Kegels (10 reps × 5s/5s)

**Coordination Day (~7 minutes):**
- Block 1: Elevators (5 reps with step pattern)
- Block Rest: 25s breathing break
- Block 2: Quick Flicks (30 reps × 1s/1s)
- Block Rest: 25s breathing break
- Block 3: Reverse Kegels (12 reps × 5s/5s)

### Weeks 11-12: Maintenance Phase (5 workouts + 2 rest days)
- Day 1: Daily Driver, Day 2: Coordination, Day 3: Daily Driver
- Day 4: Rest
- Day 5-6: Daily Driver
- Day 7: Rest

## Project Architecture

### Frontend (client/)
- **React Native with Expo** - Cross-platform mobile app
- **React Navigation 7** - Tab and stack navigation
- **AsyncStorage** - Local data persistence
- **expo-haptics** - Haptic feedback during workouts
- **react-native-svg** - Progress ring animations
- **react-native-reanimated** - Smooth animations

### Backend (server/)
- **Express.js** - API server (minimal, for future extensions)
- Current implementation is offline-first with local storage

### Key Directories
```
client/
  ├── components/     # Reusable UI components
  ├── constants/      # Theme, colors, spacing
  ├── data/           # Workout program data
  ├── hooks/          # Custom React hooks
  ├── lib/            # Utilities (storage, workout engine, haptics)
  ├── navigation/     # React Navigation setup
  └── screens/        # App screens
```

## Navigation Structure
- **TodayTab** (Home) - Start workout, view streak, toggle recovery mode
- **ProgressTab** - Calendar view of completed days, stats
- **SettingsTab** - Haptics, accessibility, workout preferences
- **WorkoutPlayer** (Modal) - Full-screen workout guidance
- **WorkoutPicker** (Modal) - Choose individual quick workouts
- **BreathworkModeSelector** (Modal) - Choose breathwork mode for rest days
- **BreathworkSession** (Fullscreen Modal) - Guided 5-minute breathing session with animated circle, voice, haptics
- **BreathworkSummary** (Fullscreen Modal) - Post-session summary with optional streak logging

## Workout Engine
The workout engine (`client/lib/workoutEngine.ts`) is a deterministic state machine that:
- Tracks segment/set/rep/phase progression
- Uses timestamp-based timing for accuracy
- Survives app background/foreground transitions
- Triggers haptic feedback at phase transitions

## Data Persistence
All data stored locally via AsyncStorage:
- Completed workout dates
- Total sessions and minutes
- User settings (haptics, accessibility, recovery mode)
- Onboarding completion status
- Program start date for streak calculation

## Running the App
- Start Frontend: `npm run expo:dev`
- Start Backend: `npm run server:dev`
- The app runs on port 8081 (Expo dev server)
- Backend runs on port 5000

## User Preferences
- Haptics: on/off, intensity (light/medium/heavy), rest cue style
- Dynamic haptic intensity: Haptics match the power bar level (light at bottom, heavy at top)
- Distinct haptic patterns per exercise type:
  - Slow Holds: Steady pulses with progressive intensity build
  - Quick Flicks: Rapid staccato bursts in groups of 3 with micro-pauses
  - Elevator: Stepped double-pulses that speed up as you climb
  - Reverse Kegels: Gentle, widely-spaced pulses
  - Contract-Relax: Double-pulse pattern with intensity ramp
  - Breathing: Very slow, soft wave-like rhythm
- Haptic transition cues: Start cue when squeeze begins, peak cue at 90%, double-tap on phase change
- Accessibility (via AccessibilityContext):
  - High Contrast Mode: Pure white text (#FFFFFF) on dark backgrounds with stronger borders
  - Large Text Mode: 1.25x font scale applied to key UI elements (streak numbers, labels, buttons, stats)
- Recovery Mode: 50% reduced intensity with relaxation segment
- **Rest Duration**: Adjustable slider (2-10 seconds) for time between reps
- **Block Rest Duration**: Adjustable slider (10-45 seconds) for breathing breaks between exercise blocks
- **Cooldown Toggle**: Enable/disable the cooldown segment at the end of workouts
- Screen stays awake during workouts (expo-keep-awake)
- Smart rest skipping: After last rep of a set, transitions directly to block rest without extra rest countdown

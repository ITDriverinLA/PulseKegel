# PulseKegel - Pelvic Floor Workout App

## Overview
PulseKegel is a mobile app for daily pelvic floor (Kegel) workouts with real-time visual cues and haptic feedback. Built with Expo (React Native) and Express.js backend.

## Key Features
- 12-week progressive workout program with 7 exercise types (slow holds, quick flicks, elevator, reverse, breathing, block rest, contract-relax)
- **Quick Workout Selection** - Choose individual workouts outside the 12-week program (Quick Flicks, Slow Holds, Endurance, Elevator, Reverse Kegels, Contract-Relax, Full Daily, Coordination)
- Real-time workout player with SQUEEZE/REST/BREATHE visual cues and haptic feedback
- Vertical LED-style power bar with exercise-specific animations (fills to 100%, slower 600ms return animation)
- Progress tracking with streak counter, calendar view, and statistics
- Recovery mode for reduced intensity workouts
- Customizable haptic intensity and rest cue styles
- One-time onboarding with safety disclaimers
- Futuristic cyberpunk UI with dark gradients and neon accents

## Workout Program Structure

### Weeks 1-2: Control Phase
- 3 days/week with strength and speed training
- Building awareness and control

### Weeks 3-6: Strength Phase  
- 5 days/week with strength, speed, and coordination training
- Increasing hold duration and reps

### Weeks 7-10: Power Phase (Block-Based)
- 7 days/week with alternating "Daily Driver" and "Coordination Day" workouts
- 20-30 second breathing breaks between exercise blocks

**Daily Driver (5 days/week) - ~8 minutes:**
- Block 1: Slow Holds (8 reps × 8s squeeze / 12s rest)
- Block Rest: 25s breathing break
- Block 2: Quick Flicks (20 reps × 1s/1s)
- Block Rest: 25s breathing break
- Block 3: Contract-Relax (10 reps × 2s/4s)
- Block Rest: 25s breathing break
- Block 4: Reverse Kegels (10 reps × 5s/5s)

**Coordination Day (2 days/week) - ~7 minutes:**
- Block 1: Elevators (5 reps with step pattern)
- Block Rest: 25s breathing break
- Block 2: Quick Flicks (30 reps × 1s/1s)
- Block Rest: 25s breathing break
- Block 3: Reverse Kegels (12 reps × 5s/5s)

### Weeks 11-12: Maintenance Phase
- 5 days/week continuing block-based structure

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

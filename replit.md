# PulseKegel - Pelvic Floor Workout App

## Overview
PulseKegel is a mobile app for daily pelvic floor (Kegel) workouts with real-time visual cues and haptic feedback. Built with Expo (React Native) and Express.js backend.

## Key Features
- 12-week progressive workout program with 5 exercise types (slow holds, quick flicks, elevator, reverse, breathing)
- Real-time workout player with SQUEEZE/REST visual cues and haptic feedback
- Progress tracking with streak counter, calendar view, and statistics
- Recovery mode for reduced intensity workouts
- Customizable haptic intensity and rest cue styles
- One-time onboarding with safety disclaimers

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
- Accessibility: High contrast mode, large text mode
- Recovery Mode: 50% reduced intensity with relaxation segment

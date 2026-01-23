# PulseKegel Design Guidelines

## Brand Identity

**Purpose**: Empower users to maintain pelvic floor health through guided daily workouts with precise haptic and visual cues.

**Tone**: Clinical-Minimal – Trustworthy medical utility with zero embarrassment. Think fitness tracker meets meditation app: calm, focused, and private. Clean typography, ample whitespace, and purposeful motion. Functionality over decoration.

**Memorable Element**: The SQUEEZE/REST state transitions – massive, impossible-to-miss text paired with synchronized haptic pulses creates a multisensory workout experience unlike any fitness app.

## Navigation Architecture

**Root Navigation**: Tab Bar (3 tabs)
- **Today** (Home) - Start workout, view streak
- **Progress** - Calendar and stats
- **Settings** - Preferences and accessibility

**Modal Screens**:
- Onboarding (one-time, on first launch)
- Workout Player (full-screen modal from Home)
- Form Tips (sheet from Player)

## Screen-by-Screen Specifications

### Home Screen
**Purpose**: Launch today's workout and view progress at a glance

**Layout**:
- Header: Default navigation, transparent, title "Today"
- Main content (scrollable): 
  - Current streak badge (days)
  - Today's workout card: Phase/week name, estimated duration, "Start Workout" button
  - Recovery mode toggle
  - Last completed timestamp
- Top inset: headerHeight + Spacing.xl
- Bottom inset: tabBarHeight + Spacing.xl

**Components**: Card container, large primary button, stats display, toggle switch

### Workout Player Screen (Modal)
**Purpose**: Guide user through workout with real-time visual and haptic cues

**Layout**:
- Header: Custom, opaque background, left: Close button, right: Form Tips button
- Main content (non-scrollable, centered):
  - **Huge state label**: "SQUEEZE" or "REST" (60-80pt)
  - Circular progress ring (240x240pt) around countdown
  - **Large countdown number** (48pt) centered in ring
  - Segment name + "Set X of Y" + "Rep X of N" (small text below ring)
- Bottom controls (floating):
  - Pause/Resume button (center)
  - Skip button (right)
  - End Workout button (text link, bottom)
- Top inset: Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**: Large text labels, circular SVG progress ring, icon buttons, modal sheet

**Empty State**: Not applicable (always has active workout)

### Progress Screen
**Purpose**: Review workout history and track consistency

**Layout**:
- Header: Default navigation, transparent, title "Progress"
- Main content (scrollable):
  - Stats summary cards: Current streak, Total sessions, Total minutes
  - Monthly calendar grid showing completed days (marked dots)
  - Month navigation (prev/next arrows)
- Top inset: headerHeight + Spacing.xl
- Bottom inset: tabBarHeight + Spacing.xl

**Components**: Stat cards, calendar grid, month picker

**Empty State**: Calendar with no dots + "Start your first workout to begin tracking"

### Settings Screen
**Purpose**: Configure haptic preferences and accessibility

**Layout**:
- Header: Default navigation, transparent, title "Settings"
- Main content (scrollable form):
  - **Haptics section**: Toggle on/off, Intensity picker (Light/Medium/Heavy), Rest cue style picker (None/Light/Normal)
  - **Accessibility section**: High contrast toggle, Large text toggle
  - **Recovery Mode section**: Toggle (reduces intensity 50% + adds relaxation)
- Top inset: headerHeight + Spacing.xl
- Bottom inset: tabBarHeight + Spacing.xl

**Components**: Section headers, toggle switches, segmented controls/pickers

### Onboarding Modal (One-time)
**Purpose**: Safety disclaimer and program introduction

**Layout**:
- Full-screen modal, non-dismissible
- Paginated (3 screens):
  1. Welcome + app purpose
  2. Safety disclaimer (not medical advice, stop if pain/pressure)
  3. Program overview (12 weeks, progression)
- Bottom: "Get Started" button on final page
- Top inset: insets.top + Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**: Illustration, large heading, body text, page dots, primary button

### Form Tips Sheet
**Purpose**: Quick reference for proper technique during workout

**Layout**:
- Bottom sheet (dismissible)
- Scrollable list of tips:
  - Breathe normally
  - Don't squeeze glutes/abs
  - Full relaxation matters
  - Don't practice by stopping urine midstream
- Top inset: Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**: Sheet handle, bulleted list

## Color Palette

**Primary**: #4A90E2 (Calm, trustworthy blue – medical but not sterile)
**Background**: #FFFFFF (Pure white for clarity)
**Surface**: #F7F9FC (Soft gray for cards)
**Text Primary**: #1A1A1A (Near-black for readability)
**Text Secondary**: #6B7280 (Medium gray)
**Success**: #10B981 (Completed workouts, streak)
**Warning**: #F59E0B (Recovery mode indicator)
**SQUEEZE State**: #E94A4A (Attention-grabbing red)
**REST State**: #10B981 (Calming green)

## Typography

**Font**: System (SF Pro on iOS, Roboto on Android) for maximum readability
**Type Scale**:
- State Label (SQUEEZE/REST): 72pt, Bold
- Countdown Number: 48pt, Semibold
- Heading 1: 28pt, Bold
- Heading 2: 20pt, Semibold
- Body: 16pt, Regular
- Caption: 14pt, Regular
- Small: 12pt, Regular

**Dynamic Type**: Support all standard sizes with proper scaling

## Visual Design

- **Icons**: Feather icons from @expo/vector-icons (no emojis)
- **Touchable Feedback**: Scale down to 0.95 on press
- **Progress Ring**: Animated SVG with smooth transitions (300ms ease-out)
- **Floating Buttons**: Shadow – offset: {width: 0, height: 2}, opacity: 0.10, radius: 2
- **State Transitions**: Fade + scale animation (400ms) when switching SQUEEZE ↔ REST

## Assets to Generate

**Required**:
1. **icon.png** – App icon with pelvic floor muscle abstract shape or pulse wave symbol
   - WHERE USED: Device home screen
2. **splash-icon.png** – Simple icon on splash screen
   - WHERE USED: App launch
3. **onboarding-welcome.png** – Friendly illustration showing workout concept
   - WHERE USED: Onboarding screen 1
4. **onboarding-safety.png** – Subtle medical/safety visual
   - WHERE USED: Onboarding screen 2
5. **empty-progress.png** – Calendar with encouraging message
   - WHERE USED: Progress screen when no workouts completed

**Style Notes**: Illustrations should be simple line art or soft gradients in brand colors. Avoid overly detailed anatomy. Focus on abstraction and positivity.
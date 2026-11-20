# My Workout Routine

A minimal, offline-first Android workout companion built with **React 19**, **TypeScript**, **Vite**, and **Capacitor 8** for a structured **6-Day Strength & Hypertrophy Split** (Saturday–Thursday, Friday rest).

## Features

- **Minimal 3-Tab Shell**:
  - **ওয়ার্কআউট (Workout)**: Clean Day 1 (Push + Core) and Day 2 (Pull + Legs) alternating split with full-bleed swipeable exercise cards and clear typography.
  - **প্রগ্রেস (Progress)**: Offline session history, preloaded baseline logs (14 past gym days & latest bodyweight `66.6 kg`), and warmup/cardio recovery timers.
  - **সেটিংস (Settings)**: Google Sheets login & two-way Apps Script sync configuration.
- **Interactive Exercise Cards**:
  - Single-word inner card tabs: **লগ ও ছবি** (Log & start/peak exercise photos), **নিয়ম** (Form guide & Tempo pacer), and **কাস্টম** (Edit/customise card fields).
  - Wall-clock anchored **Rest Timer** & **5-min Cycling** timer plus Double Progression alerts.
- **Android APK Ready**: Packaged via Capacitor 8 (`com.hypertrophy.workout.bd`). Download the latest compiled `.apk` directly from the [GitHub Releases](../../releases) page.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Lucide React
- **Mobile Runtime**: Capacitor 8 (Android)

## Development & Build

```bash
# Install dependencies
npm install

# Run web dev server
npm run dev

# Build web assets & sync to Android project
npm run build
npx cap sync android
```

To build the debug APK using Gradle (from `android/`):

```bash
./gradlew assembleDebug
```

# BetterYou 🥗🏋️‍♂️🔬

BetterYou is an intelligent fitness, nutrition computer vision, and toxicological barcode/ingredient inspection application built with Expo SDK 58, React Native 0.88, and React 19.

## Key Features

- **Plate AI Vision**: Instant macro estimation (calories, protein, carbs, fats) from meal photos using Google Gemini Vision.
- **Ingredient Lab**: Forensic toxicological screening for packaged foods, personal care, and Indian market formulations.
- **Strength & Workout Tracking**: Active session volume tracking, auto-rest timer, and exercise logging.
- **Obsidian Dark Theme**: High-contrast, accessibility-tuned design system.

## Getting Started

1. Install dependencies using Bun:

   ```bash
   bun install
   ```

2. Start the development server:

   ```bash
   bunx expo start
   ```

3. Quality assurance:

   ```bash
   bunx tsc --noEmit        # Typecheck
   bunx expo lint           # ESLint
   bunx expo-doctor         # Configuration & dependency check
   ```

## Environment Configuration

Configure your Google Gemini API key in `.env`:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

Users can also provide their own custom Gemini API keys directly inside the in-app **AI Settings** screen.

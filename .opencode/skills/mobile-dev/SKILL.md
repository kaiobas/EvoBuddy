# Mobile Development Skill

Specialized in React Native development with `@evobuddy/mobile`.

## Stack

- React Native CLI
- NativeWind (TailwindCSS for RN)
- TypeScript strict
- ESM modules

## Structure

```
apps/mobile/
├── src/
│   └── App.tsx          # Entry point
├── app.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
└── package.json
```

## Conventions

- Components use NativeWind classes for styling
- Navigation via React Navigation (when implemented)
- State management via Zustand (from `@evobuddy/shared`)
- Database via `react-native-quick-sqlite` (when implemented)
- No business logic in the app — delegate to packages

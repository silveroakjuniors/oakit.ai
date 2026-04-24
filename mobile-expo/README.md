# SOJ Mobile (Expo) — Quick Start

1. Install Expo CLI and EAS (optional for builds):

```powershell
npm i -g expo-cli eas-cli
cd mobile-expo
npm install
```

2. Run in development:

```powershell
npm run start
```

3. Run on Android device/emulator:

```powershell
npm run android
```

4. Build APK (recommended via EAS):

```powershell
eas build -p android --profile preview
```

Notes:
- This is a minimal scaffold. Next steps: implement auth, API client, and parent screens.
- Set `NEXT_PUBLIC_API_URL` in environment when using API endpoints.

# TimeMapTodo Frontend

## Firebase sync

The app can store task data in Firebase Firestore so the Windows Electron app and a future iPhone app can share the same task board.

1. Create a Firebase project and enable Cloud Firestore.
2. Enable Firebase Authentication with the Google provider. Email/Password can stay enabled as a backup sign-in method.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Fill in the Firebase web app config values.
5. Create a Google Cloud OAuth client with application type `Desktop app`.
6. Put that client ID in `VITE_GOOGLE_DESKTOP_CLIENT_ID`.
7. In Firebase Authentication, open the Google provider and add the desktop OAuth client ID to `Safelist client IDs from external projects`.
8. Set the same `VITE_FIREBASE_WORKSPACE_ID` in every client that should share the same tasks.

When Firebase env vars are missing, the app keeps using the existing local Electron JSON storage. When Firebase is configured, Firestore is the primary store and the local file remains as a backup cache.

Firestore document path:

```text
users/{firebaseAuthUid}/timemaptodoWorkspaces/{VITE_FIREBASE_WORKSPACE_ID}
```

Use these Firestore rules after Authentication is enabled:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/timemaptodoWorkspaces/{workspaceId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

The old `timemaptodoWorkspaces/default` document is only used as a one-time migration source while the temporary open rules are still active.

Packaged Electron builds use the system browser for Google sign-in. The app starts a temporary loopback callback URL like `http://127.0.0.1:{port}/oauth2callback`, exchanges the OAuth code with PKCE, and signs in to Firebase with the returned Google ID token.

Development command:

```bash
npm run dev:electron
```

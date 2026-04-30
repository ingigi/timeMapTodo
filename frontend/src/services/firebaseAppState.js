import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

const FIREBASE_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
];

const APP_STATE_COLLECTION = "timemaptodoWorkspaces";
const USERS_COLLECTION = "users";
const DEFAULT_WORKSPACE_ID = "default";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

let googleCalendarAccessToken = null;

const getEnv = () => import.meta.env || {};

export const isFirebaseConfigured = () => {
  const env = getEnv();
  return FIREBASE_ENV_KEYS.every((key) => Boolean(env[key]));
};

export const getFirebaseWorkspaceId = () => {
  const env = getEnv();
  return env.VITE_FIREBASE_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
};

export const getGoogleDesktopClientId = () => {
  const env = getEnv();
  return env.VITE_GOOGLE_DESKTOP_CLIENT_ID || "";
};

export const getGoogleDesktopClientSecret = () => {
  const env = getEnv();
  return env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || "";
};

export const getFirebaseLegacyOwnerEmail = () => {
  const env = getEnv();
  return (env.VITE_FIREBASE_LEGACY_OWNER_EMAIL || "").toLowerCase();
};

const getFirebaseConfig = () => {
  const env = getEnv();

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };
};

const getClientId = () => {
  if (typeof window === "undefined") return "server";

  const storageKey = "timemaptodo-client-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const nextClientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, nextClientId);
  return nextClientId;
};

const getFirebaseApp = () => {
  return getApps().length ? getApps()[0] : initializeApp(getFirebaseConfig());
};

const getAuthClient = () => {
  return getAuth(getFirebaseApp());
};

const getDb = () => {
  return getFirestore(getFirebaseApp());
};

const getAppStateDocRef = (user) => {
  if (!user?.uid) {
    throw new Error("A signed-in Firebase user is required.");
  }

  const db = getDb();
  return doc(db, USERS_COLLECTION, user.uid, APP_STATE_COLLECTION, getFirebaseWorkspaceId());
};

const getLegacyAppStateDocRef = () => {
  const db = getDb();
  return doc(db, APP_STATE_COLLECTION, getFirebaseWorkspaceId());
};

export const onFirebaseAuthChange = (callback) => {
  if (!isFirebaseConfigured()) return () => {};

  return onAuthStateChanged(getAuthClient(), callback);
};

export const signInWithEmail = (email, password) => {
  return signInWithEmailAndPassword(getAuthClient(), email, password);
};

export const createAccountWithEmail = (email, password) => {
  return createUserWithEmailAndPassword(getAuthClient(), email, password);
};

const storeGoogleCalendarAccessToken = (accessToken) => {
  googleCalendarAccessToken = accessToken || null;
};

export const getGoogleCalendarAccessToken = () => googleCalendarAccessToken;

export const signInWithGoogle = () => {
  const desktopClientId = getGoogleDesktopClientId();
  const desktopClientSecret = getGoogleDesktopClientSecret();

  if (desktopClientId && typeof window !== "undefined" && window.api?.signInWithGoogleExternal) {
    return window.api.signInWithGoogleExternal(desktopClientId, desktopClientSecret).then(({ idToken, accessToken }) => {
      storeGoogleCalendarAccessToken(accessToken);
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      return signInWithCredential(getAuthClient(), credential);
    });
  }

  const provider = new GoogleAuthProvider();
  provider.addScope(GOOGLE_CALENDAR_SCOPE);
  provider.setCustomParameters({
    prompt: "consent select_account",
    include_granted_scopes: "true"
  });
  return signInWithPopup(getAuthClient(), provider).then((result) => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    storeGoogleCalendarAccessToken(credential?.accessToken || null);
    return result;
  });
};

export const signOutFirebase = () => {
  storeGoogleCalendarAccessToken(null);
  return signOut(getAuthClient());
};

export const loadLegacyFirebaseAppState = async () => {
  if (!isFirebaseConfigured()) return null;

  const snapshot = await getDoc(getLegacyAppStateDocRef());
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return data?.appState || null;
};

export const loadFirebaseAppState = async (user) => {
  if (!isFirebaseConfigured()) return null;

  const snapshot = await getDoc(getAppStateDocRef(user));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return data?.appState || null;
};

export const saveFirebaseAppState = async (user, appState) => {
  if (!isFirebaseConfigured()) {
    return { success: false, skipped: true };
  }

  if (!user?.uid) {
    return { success: false, skipped: true, error: "No signed-in user." };
  }

  await setDoc(
    getAppStateDocRef(user),
    {
      appState,
      ownerUid: user.uid,
      ownerEmail: user.email || null,
      updatedAt: serverTimestamp(),
      updatedBy: getClientId(),
      schemaVersion: 2
    },
    { merge: true }
  );

  return { success: true };
};

export const subscribeFirebaseAppState = ({ user, onData, onError }) => {
  if (!isFirebaseConfigured() || !user?.uid) return () => {};

  return onSnapshot(
    getAppStateDocRef(user),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      onData(snapshot.data()?.appState || null);
    },
    onError
  );
};





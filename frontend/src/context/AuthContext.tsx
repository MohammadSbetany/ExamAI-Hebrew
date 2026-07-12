import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { fetchSettings, applyTheme, applyFont, applyDirection } from '@/lib/settingsApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'teacher';

interface AuthUser {
  uid:   string;
  email: string;
  name:  string;
  role:  UserRole;
  token: string;
}

interface AuthContextValue {
  user:     AuthUser | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<void>;
  signup:   (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  /** Sign in with Google. Resolves with { isNewUser } — true when the account
   *  has no stored profile yet and a role still needs to be chosen. */
  loginWithGoogle: () => Promise<{ isNewUser: boolean }>;
  /** Persist the chosen role for a first-time Google user. */
  completeGoogleSignup: (role: UserRole) => Promise<void>;
  logout:   () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const token    = await firebaseUser.getIdToken();
          const snap     = await getDoc(doc(db, 'users', firebaseUser.uid));
          const data     = snap.data();

          const authUser: AuthUser = {
            uid:   firebaseUser.uid,
            email: firebaseUser.email ?? '',
            name:  data?.name  ?? firebaseUser.displayName ?? firebaseUser.email ?? '',
            role:  data?.role  ?? 'student',
            token,
          };

          localStorage.setItem('auth_token', token);
          setUser(authUser);
          try {
            const settings = await fetchSettings(token);
            applyTheme(settings.theme);
            applyFont(settings.dyslexicFont);
            applyDirection(settings.language);
          } catch {
            // ignore settings bootstrap failures
          }
        } catch {
          setUser(null);
        }
      } else {
        localStorage.removeItem('auth_token');
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    setLoading(true);
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged above will update state automatically
  };

  // ── Signup ─────────────────────────────────────────────────────────────────

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    setLoading(true);
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Store name + role in Firestore before onAuthStateChanged fires
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      role,
      email,
      createdAt: new Date().toISOString(),
    });
    // onAuthStateChanged above will update state automatically
  };

  // ── Google sign-in ───────────────────────────────────────────────────────────

  const loginWithGoogle = async (): Promise<{ isNewUser: boolean }> => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      // First-time Google users have no profile document yet → the caller shows
      // a role picker and then calls completeGoogleSignup().
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      return { isNewUser: !snap.exists() };
    } catch (err) {
      // onAuthStateChanged won't fire on failure; stop the loading state.
      setLoading(false);
      throw err;
    }
  };

  const completeGoogleSignup = async (role: UserRole) => {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('No authenticated user to complete signup for');
    await setDoc(doc(db, 'users', fbUser.uid), {
      name: fbUser.displayName ?? fbUser.email ?? '',
      role,
      email: fbUser.email ?? '',
      createdAt: new Date().toISOString(),
    });
    // Reflect the chosen role immediately (auth state itself didn't change, so
    // onAuthStateChanged won't re-run).
    setUser(prev => prev ? { ...prev, role, name: fbUser.displayName ?? prev.name } : prev);
  };

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, completeGoogleSignup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

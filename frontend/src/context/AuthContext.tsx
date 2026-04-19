import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
            name:  data?.name  ?? firebaseUser.email ?? '',
            role:  data?.role  ?? 'student',
            token,
          };

          localStorage.setItem('auth_token', token);
          setUser(authUser);
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
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged above will update state automatically
  };

  // ── Signup ─────────────────────────────────────────────────────────────────

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Store name + role in Firestore (Firebase Auth doesn't have a role field)
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      role,
      email,
      createdAt: new Date().toISOString(),
    });
    // onAuthStateChanged above will update state automatically
  };

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Flashcards from "./pages/Flashcards";
import Dashboard from "./pages/Dashboard";
import MyExams from "./pages/MyExams";
import Students from "./pages/Students";
import JoinClass from "./pages/JoinClass";
import ClassStats from "./pages/ClassStats";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ─── Layout wrapper (sidebar + main content) ──────────────────────────────────

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <div className="md:hidden h-14 flex-shrink-0" />
    <div className="flex min-h-screen" style={{ direction: 'rtl' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  </>
);

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>

            {/* Public routes — no sidebar */}
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected routes — wrapped in sidebar layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout>
                  <Index />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/my-exams" element={
              <ProtectedRoute>
                <AppLayout>
                  <MyExams />
                </AppLayout>
              </ProtectedRoute>
            } />

            {/* Add future protected routes the same way:
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            } /> */}

            {/* Teacher-only example:
            <Route path="/students" element={
              <ProtectedRoute requireTeacher>
                <AppLayout><Students /></AppLayout>
              </ProtectedRoute>
            } /> */}

            <Route path="/my-exams" element={
              <ProtectedRoute>
                <AppLayout>
                  <MyExams />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/flashcards" element={
              <ProtectedRoute>
                <AppLayout>
                  <Flashcards />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/class-stats" element={
              <ProtectedRoute requireTeacher>
                <AppLayout>
                  <ClassStats />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/students" element={
              <ProtectedRoute requireTeacher>
                <AppLayout>
                  <Students />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/join-class" element={
              <ProtectedRoute>
                <AppLayout>
                  <JoinClass />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

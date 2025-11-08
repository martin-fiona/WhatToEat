import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthPage } from "@/pages/AuthPage";
import { HomePage } from "@/pages/HomePage";
import { ShoppingCartPage } from "@/pages/ShoppingCartPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { NutritionPage } from "@/pages/NutritionPage";
import { Toaster } from "sonner";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = localStorage.getItem('sb-auth-token') !== null;
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/cart" element={
            <ProtectedRoute>
              <ShoppingCartPage />
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          } />
          <Route path="/nutrition" element={
            <ProtectedRoute>
              <NutritionPage />
            </ProtectedRoute>
          } />
          {/** 设置页面已移除 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

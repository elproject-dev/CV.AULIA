import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { initializeBluetooth } from "@/lib/bluetooth-printer";
import { initializeAndroidNotifications } from "@/lib/android-notifications";
import { getDefaultRoute, isAdminMode } from "@/lib/auth";

import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import UpdatePasswordPage from "@/pages/update-password";
import POSPage from "@/pages/pos";
import DashboardPage from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import CustomersPage from "@/pages/customers";
import TransactionsPage from "@/pages/transactions";
import SettingsPage from "@/pages/settings";
import ReceivablesPage from "@/pages/receivables";

import ExpensesPage from "@/pages/expenses";
import StaffPage from "@/pages/staff";
import PromoPage from "@/pages/promo";
import CustomerReturnsPage from "@/pages/customer-returns";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    
    // Check if current route is a public route
    const isPublicRoute = location === "/login" || location === "/register" || location === "/forgot-password" || location === "/update-password";

    if (!user && !isPublicRoute) {
      setLocation("/login");
    }
    
    if (user && isPublicRoute && location !== "/update-password") {
      setLocation(getDefaultRoute(user));
    }
  }, [user, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Memuat...</p>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/update-password" component={UpdatePasswordPage} />
      <Route path="/">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/pos">
        <ProtectedRoute>
          <POSPage />
        </ProtectedRoute>
      </Route>
      <Route path="/products">
        <ProtectedRoute>
          <ProductsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute>
          <CustomersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/transactions">
        <ProtectedRoute>
          <TransactionsPage />
        </ProtectedRoute>
      </Route>


      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/receivables">
        <ProtectedRoute>
          <ReceivablesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/expenses">
        <ProtectedRoute>
          <ExpensesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/staff">
        <ProtectedRoute>
          <StaffPage />
        </ProtectedRoute>
      </Route>
      <Route path="/promo">
        <ProtectedRoute>
          <PromoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/customer-returns">
        <ProtectedRoute>
          <CustomerReturnsPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initializeAndroidNotifications().catch(error => {
        console.warn('Error initializing notifications:', error);
      });

      initializeBluetooth().then(result => {
        if (result.success) {
          console.log('✓ Bluetooth initialized successfully');
        } else {
          console.warn('Bluetooth initialization:', result.message);
        }
      }).catch(error => {
        console.warn('Error initializing Bluetooth:', error);
      });
    }

    const savedFontSize = localStorage.getItem('fontSize') || 'medium';
    const fontSizes: Record<string, string> = {
      small: '11px',
      medium: '14px',
      large: '17px'
    };
    document.documentElement.style.fontSize = fontSizes[savedFontSize] || '14px';

    const applyTheme = () => {
      const darkMode = localStorage.getItem('darkMode') === 'true';
      document.documentElement.classList.toggle('dark', darkMode);
    };

    applyTheme();

    window.addEventListener('storage', applyTheme);

    return () => {
      window.removeEventListener('storage', applyTheme);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

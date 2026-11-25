import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import HomePage from '@/App';
import { AuthProvider } from '@/features/auth/auth-provider';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { GuestOnly, RequireAdmin, RequireAuth } from '@/features/auth/route-guards';
import { AnggotaPage } from '@/features/org/anggota-page';
import { StrukturPage } from '@/features/org/struktur-page';
import { AppShell } from '@/components/app-shell';
import './index.css';

const queryClient = new QueryClient();
const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          {
            path: '/admin',
            element: <RequireAdmin />,
            children: [
              { path: 'struktur', element: <StrukturPage /> },
              { path: 'anggota', element: <AnggotaPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

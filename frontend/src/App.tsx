import type { ReactNode } from 'react'
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ConfirmProvider } from './components/Modal'
import { FullPageSpinner } from './components/Spinner'
import { ToastProvider } from './components/Toast'
import { AccountsProvider } from './lib/accounts'
import { AuthProvider, useAuth } from './lib/auth'
import AccountsPage from './pages/Accounts'
import ActivityPage from './pages/Activity'
import AutomationEditorPage from './pages/AutomationEditor'
import AutomationsPage from './pages/Automations'
import ContactDetailPage from './pages/ContactDetail'
import ContactsPage from './pages/Contacts'
import DashboardPage from './pages/Dashboard'
import LoginPage from './pages/Login'
import NotFoundPage from './pages/NotFound'

/** App-level auth guard: waits for /api/auth/me, sends anonymous visitors to /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <FullPageSpinner />
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

function AuthedShell() {
  return (
    <RequireAuth>
      <AccountsProvider>
        <Layout />
      </AccountsProvider>
    </RequireAuth>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AuthedShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'automations', element: <AutomationsPage /> },
      { path: 'automations/new', element: <AutomationEditorPage key="new" /> },
      { path: 'automations/:id', element: <AutomationEditorPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'contacts/:id', element: <ContactDetailPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

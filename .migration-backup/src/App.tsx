import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { FullPageLoader } from './components/ui'
import { supabaseConfigError } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Tasks from './pages/Tasks'
import Chat from './pages/Chat'
import Schedule from './pages/Schedule'
import Admin from './pages/Admin'
import Settings from './pages/Settings'

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullPageLoader label="Authenticating…" />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <FullPageLoader label="Checking access…" />
  if (profile.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { session, profile, loading } = useAuth()

  if (supabaseConfigError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Configuration Error</h1>
          <p style={{ color: '#666', maxWidth: '32rem' }}>{supabaseConfigError}</p>
        </div>
      </div>
    )
  }

  if (loading) return <FullPageLoader label="Loading TaruGuardians…" />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/onboarding-check" replace /> : <Login />} />
      <Route
        path="/onboarding-check"
        element={
          session ? (
            profile && !profile.onboarded ? <Navigate to="/onboarding" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/onboarding" element={session ? (profile && !profile.onboarded ? <Onboarding /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<Protected>{profile && !profile.onboarded ? <Navigate to="/onboarding" replace /> : <Dashboard />}</Protected>} />
      <Route path="/members" element={<Protected>{profile && !profile.onboarded ? <Navigate to="/onboarding" replace /> : <Members />}</Protected>} />
      <Route path="/tasks" element={<Protected>{profile && !profile.onboarded ? <Navigate to="/onboarding" replace /> : <Tasks />}</Protected>} />
      <Route path="/chat" element={<Protected>{profile && !profile.onboarded ? <Navigate to="/onboarding" replace /> : <Chat />}</Protected>} />
      <Route path="/schedule" element={<Protected>{profile && !profile.onboarded ? <Navigate to="/onboarding" replace /> : <Schedule />}</Protected>} />
      <Route path="/admin" element={<Protected><AdminOnly><Admin /></AdminOnly></Protected>} />
      <Route path="/settings" element={<Protected><AdminOnly><Settings /></AdminOnly></Protected>} />
      <Route path="/" element={<Navigate to={session ? (profile && !profile.onboarded ? '/onboarding' : '/dashboard') : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

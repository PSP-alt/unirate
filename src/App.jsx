/* ═══════════════════════════════════════════════════
   App.jsx — Главный компонент приложения

   React Router + AuthProvider + React Hot Toast.
   Защищённые маршруты используют PrivateRoute.
   ═══════════════════════════════════════════════════ */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import Layout from './components/layout/Layout'
import PrivateRoute from './components/shared/PrivateRoute'

/* Импорт страниц */
import Home from './pages/Home'
import Materials from './pages/Materials'
import Teachers from './pages/Teachers'
import TeacherProfile from './pages/TeacherProfile'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentProfile from './pages/StudentProfile'
import TeacherDashboard from './pages/TeacherDashboard'
import Admin from './pages/Admin'
import MaterialUpload from './pages/MaterialUpload'
/* DevSeed — импортируется и регистрируется ТОЛЬКО в dev-сборке.
   В production это создавало публичную точку для создания admin@test.com / 123456. */
import DevSeed from './pages/DevSeed'
const IS_DEV = import.meta.env.DEV
import About from './pages/About'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Support from './pages/Support'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
      <AuthProvider>
        {/* Уведомления (toast) */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              borderRadius: '8px',
              padding: '12px 16px',
            },
            success: {
              iconTheme: { primary: '#2E7D52', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#B00020', secondary: '#fff' },
            },
          }}
        />

        <Routes>
          <Route element={<Layout />}>
            {/* Публичные страницы */}
            <Route path="/" element={<Home />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:id" element={<TeacherProfile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {IS_DEV && <Route path="/dev/seed" element={<DevSeed />} />}
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/support" element={<Support />} />

            {/* Защищённые: загрузка материалов (преподаватели) */}
            <Route
              path="/materials/upload"
              element={
                <PrivateRoute roles={['teacher']}>
                  <MaterialUpload />
                </PrivateRoute>
              }
            />

            {/* Защищённые: только для студентов */}
            <Route
              path="/profile"
              element={
                <PrivateRoute roles={['student']}>
                  <StudentProfile />
                </PrivateRoute>
              }
            />

            {/* Защищённые: только для преподавателей */}
            <Route
              path="/teacher-dashboard"
              element={
                <PrivateRoute roles={['teacher']}>
                  <TeacherDashboard />
                </PrivateRoute>
              }
            />

            {/* Защищённые: только для админов */}
            <Route
              path="/admin"
              element={
                <PrivateRoute roles={['admin']}>
                  <Admin />
                </PrivateRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'

import AdminLayout from './layouts/AdminLayout.jsx'
import ClientLayout from './layouts/ClientLayout.jsx'

import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminClients from './pages/admin/Clients.jsx'
import AdminProducts from './pages/admin/Products.jsx'
import AdminCategories from './pages/admin/Categories.jsx'
import AdminCombos from './pages/admin/Combos.jsx'
import AdminAgent from './pages/admin/Agent.jsx'
import AdminOrders from './pages/admin/Orders.jsx'

// Client pages
import ClientDashboard from './pages/client/Dashboard.jsx'
import ClientInstances from './pages/client/Instances.jsx'
import ClientChatbot from './pages/client/Chatbot.jsx'
import ClientOrders from './pages/client/Orders.jsx'

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>
  if (!user) return <Navigate to="/login" />
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/client" />

  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-lg">Carregando...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<PrivateRoute adminOnly><AdminLayout /></PrivateRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="combos" element={<AdminCombos />} />
        <Route path="agent" element={<AdminAgent />} />
        <Route path="orders" element={<AdminOrders />} />
      </Route>

      {/* Client Routes */}
      <Route path="/client" element={<PrivateRoute><ClientLayout /></PrivateRoute>}>
        <Route index element={<ClientDashboard />} />
        <Route path="instances" element={<ClientInstances />} />
        <Route path="chatbot" element={<ClientChatbot />} />
        <Route path="orders" element={<ClientOrders />} />
      </Route>

      {/* Redirect */}
      <Route path="*" element={
        user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/client'} /> : <Navigate to="/login" />
      } />
    </Routes>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'

import AdminLayout from './layouts/AdminLayout.jsx'
import ClientLayout from './layouts/ClientLayout.jsx'
import SuperadminLayout from './layouts/SuperadminLayout.jsx'

import LoginPage from './pages/LoginPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'

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
import ClientCompany from './pages/client/Company.jsx'

// Shared pages (used by both admin and client)
import Categories from './pages/admin/Categories.jsx'
import Products from './pages/admin/Products.jsx'
import Combos from './pages/admin/Combos.jsx'
import Agent from './pages/admin/Agent.jsx'
import Customers from './pages/client/Customers.jsx'
import Materials from './pages/client/Materials.jsx'
import ShoppingLists from './pages/client/ShoppingLists.jsx'
import Recipes from './pages/client/Recipes.jsx'

// Store pages (public)
import StoreLayout from './layouts/StoreLayout.jsx'
import StoreFront from './pages/store/StoreFront.jsx'
import StoreCart from './pages/store/StoreCart.jsx'
import StoreLogin from './pages/store/StoreLogin.jsx'
import StoreOrderConfirmation from './pages/store/StoreOrderConfirmation.jsx'
import StoreMyOrders from './pages/store/StoreMyOrders.jsx'
import StoreAccount from './pages/store/StoreAccount.jsx'
import StoreChangePassword from './pages/store/StoreChangePassword.jsx'
import StoreTermos from './pages/store/StoreTermos.jsx'
import StorePrivacidade from './pages/store/StorePrivacidade.jsx'

// Client store settings
import StoreSite from './pages/client/StoreSite.jsx'

// Superadmin pages
import SuperadminDashboard from './pages/superadmin/Dashboard.jsx'
import SuperadminAccounts from './pages/superadmin/Accounts.jsx'
import SuperadminPlans from './pages/superadmin/Plans.jsx'
import SuperadminFinancial from './pages/superadmin/Financial.jsx'
import SuperadminConfig from './pages/superadmin/Config.jsx'
import SuperadminAI from './pages/superadmin/AI.jsx'
import SuperadminSimulator from './pages/superadmin/Simulator.jsx'
import SuperadminOrders from './pages/superadmin/Orders.jsx'

function getHomeRoute(role) {
  if (role === 'SUPERADMIN') return '/admin-cwxp15'
  if (role === 'ADMIN') return '/admin'
  return '/client'
}

function PrivateRoute({ children, adminOnly = false, superadminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>
  if (!user) return <Navigate to="/login" />
  if (superadminOnly && user.role !== 'SUPERADMIN') return <Navigate to={getHomeRoute(user.role)} />
  if (adminOnly && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') return <Navigate to="/client" />

  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-lg">Carregando...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getHomeRoute(user.role)} /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register" element={<Navigate to="/login" />} />

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
        <Route path="company" element={<ClientCompany />} />
        <Route path="customers" element={<Customers />} />
        <Route path="categories" element={<Categories />} />
        <Route path="products" element={<Products />} />
        <Route path="combos" element={<Combos />} />
        <Route path="agent" element={<Agent />} />
        <Route path="orders" element={<ClientOrders />} />
        <Route path="orders/:orderCode" element={<ClientOrders />} />
        <Route path="materials" element={<Materials />} />
        <Route path="shopping-lists" element={<ShoppingLists />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="store-site" element={<StoreSite />} />
      </Route>

      {/* Superadmin Routes */}
      <Route path="/admin-cwxp15" element={<PrivateRoute superadminOnly><SuperadminLayout /></PrivateRoute>}>
        <Route index element={<SuperadminDashboard />} />
        <Route path="accounts" element={<SuperadminAccounts />} />
        <Route path="plans" element={<SuperadminPlans />} />
        <Route path="financial" element={<SuperadminFinancial />} />
        <Route path="ai" element={<SuperadminAI />} />
        <Route path="simulator" element={<SuperadminSimulator />} />
        <Route path="orders" element={<SuperadminOrders />} />
        <Route path="config" element={<SuperadminConfig />} />
      </Route>

      {/* Public Store Routes */}
      <Route path="/loja/:slug" element={<StoreLayout />}>
        <Route index element={<StoreFront />} />
        <Route path="carrinho" element={<StoreCart />} />
        <Route path="login" element={<StoreLogin />} />
        <Route path="pedido/:orderId" element={<StoreOrderConfirmation />} />
        <Route path="meus-pedidos" element={<StoreMyOrders />} />
        <Route path="minha-conta" element={<StoreAccount />} />
        <Route path="alterar-senha" element={<StoreChangePassword />} />
        <Route path="termos-de-uso" element={<StoreTermos />} />
        <Route path="privacidade" element={<StorePrivacidade />} />
      </Route>

      {/* Redirect */}
      <Route path="*" element={
        user ? <Navigate to={getHomeRoute(user.role)} /> : <Navigate to="/login" />
      } />
    </Routes>
  )
}

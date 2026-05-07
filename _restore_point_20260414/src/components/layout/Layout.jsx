import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  const location = useLocation()
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main key={location.pathname} className="flex-1 animate-page-in">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useReveal } from './hooks/useReveal'
import Header from './components/Header'
import Hero from './components/Hero'
import SocialProof from './components/SocialProof'
import HowItWorks from './components/HowItWorks'
import Benefits from './components/Benefits'
import Features from './components/Features'
import Testimonials from './components/Testimonials'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import TermosDeUso from './pages/TermosDeUso'
import Privacidade from './pages/Privacidade'

function HomePage() {
  const revealRef = useReveal()

  return (
    <div ref={revealRef}>
      <Header />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <Benefits />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/termos-de-uso" element={<TermosDeUso />} />
        <Route path="/privacidade" element={<Privacidade />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

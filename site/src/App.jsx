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

function App() {
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

export default App

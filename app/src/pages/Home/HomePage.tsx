import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Translation } from '../../data/i18n'

// Each tag gets its own tone so the hero is not a single color; tones map to tokens in pages/home.css.
const techTags = [
  { label: 'Git & GitHub', tone: 'blue' },
  { label: 'Spring Boot', tone: 'green' },
  { label: 'Docker', tone: 'violet' },
  { label: 'Artificial Intelligence', tone: 'amber' },
  { label: 'Backend Development', tone: 'rose' },
]

export function HomePage({ t }: { t: Translation }) {
  return <main className="page-content">
    <section className="hero-section">
      <div className="hero-copy">
        <motion.span className="welcome-badge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>✦ {t.welcome}</motion.span>
        <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { delay: .08 } }}>{t.heroTitle} <span>TechVerse</span></motion.h1>
        <motion.p className="hero-lede" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: .18 } }}>{t.heroDescription}</motion.p>
        <motion.div className="tag-list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: .06 } } }}>
          {techTags.map(({ label, tone }) => <motion.span key={label} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="tech-tag" data-tone={tone}><i />{label}</motion.span>)}
        </motion.div>
        <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: .42 } }}>
          <Link className="button button-primary" to="/courses">{t.explore} <ArrowRight size={17} /></Link>
          <Link className="button button-ghost" to="/interview">{t.interview} <ArrowRight size={17} /></Link>
        </motion.div>
      </div>
    </section>
  </main>
}

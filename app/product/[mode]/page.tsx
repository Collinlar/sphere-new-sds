import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'

interface ModeContent {
  label: string
  color: string
  bg: string
  eyebrow: string
  headline: string
  sub: string
  features: { title: string; body: string }[]
  steps: { title: string; body: string }[]
  audience: string
}

const MODES: Record<string, ModeContent> = {
  engage: {
    label: 'Engage', color: '#D97010', bg: '#FEF0DC',
    eyebrow: 'Live quizzes and games',
    headline: 'Make any lesson impossible to ignore.',
    sub: 'Run live, game-based quizzes your students actually want to play. Points, streaks, and leaderboards turn revision into a room full of raised hands.',
    features: [
      { title: 'Live game sessions', body: 'Students join with a code on any phone. Questions appear in real time, scored on speed and accuracy.' },
      { title: 'Team and solo modes', body: 'Run head-to-head competition or team play with consensus bonuses for group discussion.' },
      { title: 'Built for weak WiFi', body: 'Sessions keep running when the connection dips. No frozen screens mid-question.' },
      { title: 'AI question builder', body: 'Generate a full quiz from a topic in seconds, then edit before you go live.' },
    ],
    steps: [
      { title: 'Build your quiz', body: 'Add questions by hand or let the AI draft them from a topic.' },
      { title: 'Share the code', body: 'Students enter the join code, no accounts or downloads needed.' },
      { title: 'Play and review', body: 'Watch the leaderboard live, then review results by question.' },
    ],
    audience: 'Teachers, tutors, and trainers who want energy in the room.',
  },
  assess: {
    label: 'Assess', color: '#C23B2A', bg: '#FDECEA',
    eyebrow: 'Formal exams and grading',
    headline: 'Real exams, graded the moment they finish.',
    sub: 'Set formal examinations with proper invigilation controls, then let auto-grading return results and certificates without a red pen in sight.',
    features: [
      { title: 'Auto-grading', body: 'Multiple choice and structured questions grade instantly. Essay questions route to you for review.' },
      { title: 'Integrity controls', body: 'Set warnings or auto-disqualify on tab-switching, with a full record for every session.' },
      { title: 'Certificates on pass', body: 'Award a verifiable certificate automatically when a student clears the pass mark.' },
      { title: 'Open or roster exams', body: 'Run an open exam by code, or lock it to a class roster with per-student tickets.' },
    ],
    steps: [
      { title: 'Create the exam', body: 'Add questions, set the duration, pass mark, and integrity rules.' },
      { title: 'Schedule a session', body: 'Generate a join code and set who can take it.' },
      { title: 'Grade and release', body: 'Auto-graded results publish instantly; you grade essays, then release.' },
    ],
    audience: 'Schools and colleges running real assessments at scale.',
  },
  learn: {
    label: 'Learn', color: '#1A8966', bg: '#DDFAF0',
    eyebrow: 'Full learning management',
    headline: 'Host every course, guide, and note in one place.',
    sub: 'A complete LMS for structured learning: video, reading, quizzes, and assignments, plus rich guides, notes, and downloadable documents your learners keep.',
    features: [
      { title: 'Structured courses', body: 'Build modules of video, reading, and quizzes with progress tracked per student.' },
      { title: 'Guides and notes', body: 'Create step-by-step guides and rich notes with images, links, and embedded video.' },
      { title: 'Offline downloads', body: 'Learners download notes to study without data. Built for how Ghana actually learns.' },
      { title: 'Sell on the marketplace', body: 'Publish any course, guide, or note for other educators to buy or import.' },
    ],
    steps: [
      { title: 'Build your content', body: 'Assemble a course, or write a guide, note, or document.' },
      { title: 'Publish to learners', body: 'Share within your institution or list it on the marketplace.' },
      { title: 'Track progress', body: 'See who has started, finished, and where they dropped off.' },
    ],
    audience: 'Individual educators and institutions delivering courses.',
  },
  train: {
    label: 'Train', color: '#1052A3', bg: '#E3EDFB',
    eyebrow: 'Compliance and onboarding',
    headline: 'Onboard and certify your whole team.',
    sub: 'Build training paths for new hires and compliance policies, track who has completed what, and collect digital sign-off across every department.',
    features: [
      { title: 'Training paths', body: 'Sequence reading, video, quizzes, and sign-off steps into a path staff work through.' },
      { title: 'Completion tracking', body: 'See exactly who has finished, who has started, and who has not begun, by department.' },
      { title: 'Digital sign-off', body: 'Capture a verifiable record that each employee read and accepted a policy.' },
      { title: 'Certificates', body: 'Issue completion certificates automatically when a path is finished.' },
    ],
    steps: [
      { title: 'Build the path', body: 'Add steps by hand or generate a draft path from a brief with AI.' },
      { title: 'Assign your team', body: 'Add employees by email or claim code and assign the path.' },
      { title: 'Track and certify', body: 'Monitor completion and issue certificates on finish.' },
    ],
    audience: 'HR and L&D teams onboarding and certifying staff.',
  },
}

export function generateStaticParams() {
  return Object.keys(MODES).map(mode => ({ mode }))
}

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }): Promise<Metadata> {
  const { mode } = await params
  const m = MODES[mode]
  if (!m) return { title: 'SphereSDS' }
  return {
    title: `${m.label} · SphereSDS`,
    description: m.sub,
  }
}

export default async function ModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params
  const m = MODES[mode]
  if (!m) notFound()

  const otherModes = Object.entries(MODES).filter(([k]) => k !== mode)

  return (
    <div className="mkt-root" style={{ background: '#F5F4F1', minHeight: '100vh' }}>
      <MarketingNav />

      {/* Hero */}
      <section className="hero-sec sec" style={{ padding: '64px 48px 56px', maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/#modes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B6870', textDecoration: 'none', marginBottom: 22 }}>← All modes</Link>
        <p style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: m.color, background: m.bg, padding: '5px 14px', borderRadius: 20, marginBottom: 22 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
          {m.label} · {m.eyebrow}
        </p>
        <h1 className="page-h1" style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08, color: '#18171A', marginBottom: 20, maxWidth: 640 }}>{m.headline}</h1>
        <p style={{ fontSize: 17, color: '#6B6870', lineHeight: 1.72, marginBottom: 32, maxWidth: 560 }}>{m.sub}</p>
        <div className="cta-row" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/onboarding" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '14px 28px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            Get started free
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link href="/pricing" className="cta-ghost" style={{ display: 'inline-flex', padding: '14px 24px', borderRadius: 10, border: '1px solid #D0CBBC', color: '#18171A', fontSize: 15, fontWeight: 500, textDecoration: 'none', background: 'transparent' }}>See pricing</Link>
        </div>
      </section>

      {/* Features */}
      <section className="sec" style={{ padding: '72px 48px', borderTop: '0.5px solid #DDD9D2', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>What you get</p>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: '#18171A', marginBottom: 44, lineHeight: 1.12, maxWidth: 440 }}>Everything {m.label} does for you.</h2>
          <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
            {m.features.map(f => (
              <div key={f.title} className="persona-card" style={{ background: '#fff', border: '0.5px solid #EDECE9', borderRadius: 16, padding: 26, borderLeft: `3px solid ${m.color}`, boxShadow: '0 2px 14px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#18171A', marginBottom: 8, letterSpacing: '-0.015em' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="sec" style={{ padding: '72px 48px', borderTop: '0.5px solid #DDD9D2', background: '#F5F4F1' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#A09DA8', marginBottom: 10 }}>How it works</p>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: '#18171A', marginBottom: 44, lineHeight: 1.12, maxWidth: 420 }}>Three steps to your first session.</h2>
          <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {m.steps.map((s, i) => (
              <div key={s.title}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, color: m.color, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{i + 1}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#18171A', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#6B6870', lineHeight: 1.7 }}>{s.body}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: '#A09DA8', marginTop: 40 }}>Built for: {m.audience}</p>
        </div>
      </section>

      {/* Other modes */}
      <section className="sec" style={{ padding: '64px 48px', borderTop: '0.5px solid #DDD9D2', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#18171A', marginBottom: 24 }}>Explore the other modes</h2>
          <div className="modes-grid why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {otherModes.map(([key, other]) => (
              <Link key={key} href={`/product/${key}`} className="persona-card" style={{ display: 'block', background: '#fff', border: '0.5px solid #EDECE9', borderRadius: 14, padding: 22, textDecoration: 'none', borderTop: `3px solid ${other.color}`, boxShadow: '0 2px 14px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#18171A', marginBottom: 6 }}>{other.label}</h3>
                <p style={{ fontSize: 13, color: '#6B6870', lineHeight: 1.55, marginBottom: 10 }}>{other.eyebrow}</p>
                <span style={{ fontSize: 13, fontWeight: 600, color: other.color }}>Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="sec" style={{ padding: '72px 48px', borderTop: '0.5px solid #DDD9D2', background: '#18171A', textAlign: 'center' }}>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: 12, lineHeight: 1.1 }}>Ready to try {m.label}?</h2>
        <p style={{ fontSize: 15, color: '#A09DA8', marginBottom: 26 }}>Start free. No credit card, no IT team.</p>
        <Link href="/onboarding" className="cta-primary" style={{ display: 'inline-block', padding: '15px 32px', borderRadius: 10, background: '#D97010', color: '#fff', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>Get started free</Link>
      </section>

      <MarketingFooter />
    </div>
  )
}

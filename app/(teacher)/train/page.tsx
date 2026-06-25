'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LearningPath } from '@/lib/types'
import TopBar from '@/components/brand/TopBar'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'


const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Onboarding: { bg: '#E1F5EE', text: '#0A4A38' },
  Compliance: { bg: '#FDECEA', text: '#7A1A10' },
  Skills: { bg: '#E6F1FB', text: '#0B2E52' },
  Leadership: { bg: '#EEEDF8', text: '#1C196B' },
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '0.5px solid var(--border)',
      borderRadius: 10,
      padding: '20px 24px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--near-black)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--mid-grey)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function TrainPage() {
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('learning_paths')
        .select('*')
        .eq('institution_id', getCurrentUser().institution_id)
      if (!error && data) {
        setPaths(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  const totalEnrolled = 0
  const avgCompletion = 0
  const totalCerts = 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <TopBar
        mode="train"
        title="Training"
        right={
          <Link href="/train/builder">
            <Button accent="#185FA5" size="sm">+ Create path</Button>
          </Link>
        }
      />

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {loading ? (
          <div style={{ color: 'var(--mid-grey)', fontSize: 14 }}>Fetching team progress...</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap' }}>
              <StatCard label="Paths created" value={paths.length} />
              <StatCard label="Employees enrolled" value={totalEnrolled} />
              <StatCard label="Avg completion" value={`${avgCompletion}%`} />
              <StatCard label="Certificates issued" value={totalCerts} />
            </div>

            {paths.length === 0 ? (
              <div style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--near-black)', marginBottom: 8 }}>No training paths yet</div>
                <div style={{ color: 'var(--mid-grey)', fontSize: 14, marginBottom: 20 }}>
                  Create your first training path and assign it to your team.
                </div>
                <Link href="/train/builder">
                  <Button accent="#185FA5">Build your first path</Button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {paths.map(path => {
                  const cat = CATEGORY_COLORS[path.category ?? ''] ?? { bg: '#F3F4F6', text: '#5A5A5A' }
                  return (
                    <div key={path.id} style={{
                      background: 'var(--white)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 10,
                      padding: '18px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: cat.text, background: cat.bg, padding: '2px 8px', borderRadius: 4 }}>
                            {path.category}
                          </span>
                          {path.is_mandatory && (
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#7A1A10', background: '#FDECEA', padding: '2px 8px', borderRadius: 4 }}>
                              Mandatory
                            </span>
                          )}
                          {!path.is_mandatory && (
                            <span style={{ fontSize: 11, color: 'var(--mid-grey)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 4 }}>
                              Optional
                            </span>
                          )}
                        </div>
                        {path.due_date && (
                          <span style={{ fontSize: 12, color: 'var(--mid-grey)' }}>
                            Due {new Date(path.due_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--near-black)', marginBottom: 4 }}>{path.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--mid-grey)', marginBottom: 14 }}>{path.description}</div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>{path.steps.length} steps</span>
                        <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>0 assigned</span>
                        <span style={{ fontSize: 13, color: 'var(--mid-grey)' }}>0 certificates</span>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mid-grey)', marginBottom: 4 }}>
                          <span>Team completion</span>
                          <span>0%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                          <div style={{ width: '0%', height: '100%', background: '#185FA5', borderRadius: 2 }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/train/builder?id=${path.id}`}>
                          <Button variant="secondary" size="sm">Edit path</Button>
                        </Link>
                        <Link href={`/train/team/${path.id}`}>
                          <Button accent="#185FA5" size="sm">View team progress</Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

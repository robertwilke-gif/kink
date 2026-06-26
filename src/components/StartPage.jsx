import { useState } from 'react'
import { supabase } from '../supabase.js'

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default function StartPage({ onReady }) {
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // when session is already complete: show name picker
  const [completedSession, setCompletedSession] = useState(null)

  async function handleCreateSession() {
    if (!name.trim()) { setError('Bitte gib deinen Namen ein.'); return }
    setLoading(true)
    setError('')

    const newCode = generateCode()
    const { data: sessionData, error: err } = await supabase
      .from('sessions')
      .insert({ code: newCode })
      .select()
      .single()

    if (err) {
      setError('Fehler beim Erstellen der Session. Bitte versuche es erneut.')
      setLoading(false)
      return
    }

    setLoading(false)
    onReady(sessionData, 1, name.trim())
  }

  async function handleJoinSession() {
    if (!name.trim()) { setError('Bitte gib deinen Namen ein.'); return }
    const trimmedCode = code.trim().toUpperCase()
    if (trimmedCode.length !== 6) { setError('Der Code muss 6 Zeichen lang sein.'); return }

    setLoading(true)
    setError('')

    const { data: sessionData, error: err } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', trimmedCode)
      .single()

    if (err || !sessionData) {
      setError('Session nicht gefunden. Bitte prüfe den Code.')
      setLoading(false)
      return
    }

    if (new Date(sessionData.expires_at) < new Date()) {
      setError('Diese Session ist abgelaufen.')
      setLoading(false)
      return
    }

    const { data: responses } = await supabase
      .from('responses')
      .select('*')
      .eq('session_id', sessionData.id)

    const usedSlots = (responses || []).map(r => r.slot)

    // Session complete — show name picker to identify the returning user
    if (usedSlots.includes(1) && usedSlots.includes(2)) {
      setCompletedSession({ sessionData, responses })
      setLoading(false)
      return
    }

    const slot = usedSlots.includes(1) ? 2 : 1
    setLoading(false)
    onReady(sessionData, slot, name.trim())
  }

  function handlePickName(sessionData, responses, slot, pickedName) {
    onReady(sessionData, slot, pickedName, responses)
  }

  function reset() {
    setMode(null)
    setError('')
    setName('')
    setCode('')
    setCompletedSession(null)
  }

  // ── Name picker for completed sessions ───────────────────────────────────────
  if (completedSession) {
    const { sessionData, responses } = completedSession
    return (
      <div className="page">
        <div className="container">
          <header className="app-header">
            <div className="app-eyebrow">Kink List</div>
            <h1 className="app-title">Sherin & Robert</h1>
          </header>

          <div className="panel">
            <div className="panel-title">Ergebnisse aufrufen</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Diese Session ist bereits vollständig ausgefüllt. Wer bist du?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {responses.map(r => (
                <button
                  key={r.slot}
                  className="btn btn-primary btn-full"
                  onClick={() => handlePickName(sessionData, responses, r.slot, r.name)}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={reset}>← Zurück</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal start page ─────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="container">
        <header className="app-header">
          <div className="app-eyebrow">Kink List</div>
          <h1 className="app-title">Sherin & Robert</h1>
          <div className="app-subtitle">Privat · Ehrlich · Sicher</div>
        </header>

        {!mode && (
          <div>
            <div className="notice">
              Eine private Kompatibilitätsliste. Jede Person füllt sie unabhängig aus.
              Danach seht ihr gemeinsam, was übereinstimmt.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary btn-full" onClick={() => setMode('create')}>
                Neue Session starten
              </button>
              <button className="btn btn-full" onClick={() => setMode('join')}>
                Session beitreten / Ergebnisse aufrufen
              </button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div>
            <button className="btn btn-ghost btn-sm" onClick={reset} style={{ marginBottom: '1.5rem' }}>
              ← Zurück
            </button>
            <div className="panel">
              <div className="panel-title">Neue Session</div>
              <div className="input-group">
                <label className="input-label">Dein Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="z.B. Sherin"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateSession()}
                  autoFocus
                />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={handleCreateSession} disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Erstelle Session…' : 'Session erstellen & starten'}
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div>
            <button className="btn btn-ghost btn-sm" onClick={reset} style={{ marginBottom: '1.5rem' }}>
              ← Zurück
            </button>
            <div className="panel">
              <div className="panel-title">Session beitreten / Ergebnisse aufrufen</div>
              <div className="input-group">
                <label className="input-label">Dein Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="z.B. Robert"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label className="input-label">Session-Code</label>
                <input
                  className="input input-code"
                  type="text"
                  placeholder="A1B2C3"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleJoinSession()}
                  maxLength={6}
                />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-full" onClick={handleJoinSession} disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Suche Session…' : 'Weiter'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

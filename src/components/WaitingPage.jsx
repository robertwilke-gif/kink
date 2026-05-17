import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

export default function WaitingPage({ session, slot, myName, onDone, onBack }) {
  const [partnerName, setPartnerName] = useState(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    let pollInterval

    async function checkResponses() {
      const { data } = await supabase
        .from('responses')
        .select('*')
        .eq('session_id', session.id)

      if (!data) return

      if (data.length >= 2) {
        onDone(data)
        return
      }

      const partner = data.find(r => r.slot !== slot)
      if (partner) setPartnerName(partner.name)
    }

    checkResponses()

    const channel = supabase
      .channel(`waiting-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'responses',
        filter: `session_id=eq.${session.id}`,
      }, async () => {
        const { data } = await supabase
          .from('responses')
          .select('*')
          .eq('session_id', session.id)

        if (data && data.length >= 2) {
          onDone(data)
        }
      })
      .subscribe()

    pollInterval = setInterval(checkResponses, 10000)

    const ticker = setInterval(() => setSecondsAgo(s => s + 1), 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
      clearInterval(ticker)
    }
  }, [session.id, slot, onDone])

  function shareViaWhatsApp() {
    const text = `Hier ist unser Code für die Kink List: *${session.code}* — öffne die App und gib den Code ein.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function copyCode() {
    navigator.clipboard.writeText(session.code)
  }

  return (
    <div className="page">
      <div className="container">
        <header className="app-header">
          <div className="app-eyebrow">Kink List</div>
          <h1 className="app-title">Sherin & Robert</h1>
        </header>

        <div className="waiting-indicator">
          <div className="waiting-dot" />
          <div className="waiting-text">
            {partnerName
              ? `Warte auf ${partnerName}…`
              : 'Warte auf deinen Partner…'}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Deine Antworten wurden gespeichert</div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', lineHeight: 1.7 }}>
            Sobald dein Partner fertig ist, seht ihr gemeinsam die Auswertung.
            Diese Seite aktualisiert sich automatisch.
          </p>
        </div>

        <div className="panel">
          <div className="panel-title">Session-Code</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '2rem', letterSpacing: '0.35em', color: 'var(--gold)', fontWeight: 300 }}>
              {session.code}
            </div>
            <button className="copy-btn" onClick={copyCode}>Kopieren</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-share" onClick={shareViaWhatsApp}>
              Via WhatsApp teilen ↗
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.75rem' }}>
            Dein Partner braucht diesen Code um beizutreten.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Zurück zur Startseite
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
          Automatische Prüfung alle 10 Sekunden
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { ANSWER_OPTIONS } from '../data/items.js'

function AnswerButtons({ itemId, value, onChange }) {
  return (
    <div className="answer-grid">
      {ANSWER_OPTIONS.map(opt => (
        <button
          key={opt.value}
          className={`answer-btn ${value === opt.value ? `selected-${opt.value}` : ''}`}
          onClick={() => onChange(itemId, opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function WaitingPage({ session, slot, myName, onDone, onBack }) {
  const [partnerName, setPartnerName] = useState(null)
  const [customItems, setCustomItems] = useState([])
  const [pendingAnswers, setPendingAnswers] = useState({})
  const [saving, setSaving] = useState(false)

  const partnerItems = customItems.filter(i => i.created_by_slot !== slot)
  const unanswered = partnerItems.filter(i => !(i.id in pendingAnswers))

  const finalize = useCallback(async (allResponses) => {
    // Before navigating to results, persist any pending answers for partner's custom items
    if (Object.keys(pendingAnswers).length > 0) {
      const { data: myResp } = await supabase
        .from('responses')
        .select('answers')
        .eq('session_id', session.id)
        .eq('slot', slot)
        .single()

      if (myResp) {
        const merged = { ...myResp.answers, ...pendingAnswers }
        await supabase
          .from('responses')
          .update({ answers: merged })
          .eq('session_id', session.id)
          .eq('slot', slot)

        // Reflect updated answers in the response list passed to results
        const updated = allResponses.map(r =>
          r.slot === slot ? { ...r, answers: merged } : r
        )
        onDone(updated)
        return
      }
    }
    onDone(allResponses)
  }, [pendingAnswers, session.id, slot, onDone])

  useEffect(() => {
    let pollInterval

    async function init() {
      // Load user's existing answers to track which partner items are already answered
      const { data: myResp } = await supabase
        .from('responses')
        .select('answers')
        .eq('session_id', session.id)
        .eq('slot', slot)
        .single()

      if (myResp?.answers) {
        setPendingAnswers(myResp.answers)
      }

      // Load custom items
      const { data: items } = await supabase
        .from('custom_items')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at')
      setCustomItems(items || [])
    }

    async function checkResponses() {
      const { data } = await supabase
        .from('responses')
        .select('*')
        .eq('session_id', session.id)

      if (!data) return

      if (data.length >= 2) {
        finalize(data)
        return
      }

      const partner = data.find(r => r.slot !== slot)
      if (partner) setPartnerName(partner.name)
    }

    init()
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
          finalize(data)
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'custom_items',
        filter: `session_id=eq.${session.id}`,
      }, payload => {
        setCustomItems(prev => {
          if (prev.find(i => i.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()

    pollInterval = setInterval(checkResponses, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [session.id, slot, finalize])

  function handleAnswer(itemId, value) {
    setPendingAnswers(prev => ({ ...prev, [itemId]: value }))
  }

  async function saveAndWait() {
    if (Object.keys(pendingAnswers).length === 0) return
    setSaving(true)

    const { data: myResp } = await supabase
      .from('responses')
      .select('answers')
      .eq('session_id', session.id)
      .eq('slot', slot)
      .single()

    if (myResp) {
      const merged = { ...myResp.answers, ...pendingAnswers }
      await supabase
        .from('responses')
        .update({ answers: merged })
        .eq('session_id', session.id)
        .eq('slot', slot)
    }

    setSaving(false)
  }

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

        {/* Partner's custom items — voteable while waiting */}
        {partnerItems.length > 0 && (
          <div className="panel" style={{ borderColor: 'var(--border-gold)' }}>
            <div className="panel-title">Vorschläge deines Partners</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Dein Partner hat Items vorgeschlagen. Bewerte sie, damit sie in die Auswertung einfließen.
            </p>

            {partnerItems.map(item => (
              <div key={item.id} className="item-card">
                <div className="item-top">
                  <span className="item-label">{item.label}</span>
                </div>
                {item.info && (
                  <div className="item-info-text">{item.info}</div>
                )}
                <AnswerButtons
                  itemId={item.id}
                  value={pendingAnswers[item.id]}
                  onChange={handleAnswer}
                />
              </div>
            ))}

            {unanswered.length === 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={saveAndWait}
                disabled={saving}
                style={{ marginTop: '0.75rem' }}
              >
                {saving ? 'Wird gespeichert…' : 'Bewertungen speichern'}
              </button>
            )}
          </div>
        )}

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

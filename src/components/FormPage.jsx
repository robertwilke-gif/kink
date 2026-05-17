import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase.js'
import { CATEGORIES, ANSWER_OPTIONS, getAllItems } from '../data/items.js'

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

function ItemCard({ item, answer, onAnswer }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="item-card">
      <div className="item-top">
        <span className="item-label">
          {item.isCustom && <span className="custom-badge">Vorschlag</span>}
          {item.label}
        </span>
        {item.info && (
          <button
            className="item-info-btn"
            onClick={() => setShowInfo(v => !v)}
            aria-label="Info anzeigen"
          >
            {showInfo ? '▲' : 'ℹ'}
          </button>
        )}
      </div>
      {showInfo && item.info && (
        <div className="item-info-text">{item.info}</div>
      )}
      <AnswerButtons itemId={item.id} value={answer} onChange={onAnswer} />
    </div>
  )
}

function CustomItemsSection({ sessionId, slot, customItems, setCustomItems, answers, onAnswer }) {
  const [newLabel, setNewLabel] = useState('')
  const [newInfo, setNewInfo] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)

  const myCustomItems = customItems.filter(i => i.created_by_slot === slot)
  const partnerCustomItems = customItems.filter(i => i.created_by_slot !== slot)

  async function addItem() {
    if (!newLabel.trim()) return
    setLoading(true)

    const id = `custom-${sessionId}-${slot}-${Date.now()}`
    const item = {
      id,
      session_id: sessionId,
      created_by_slot: slot,
      label: newLabel.trim(),
      info: newInfo.trim(),
    }

    const { error } = await supabase.from('custom_items').insert(item)
    if (!error) {
      setCustomItems(prev => [...prev, item])
      setNewLabel('')
      setNewInfo('')
      setAdding(false)
    }
    setLoading(false)
  }

  async function removeItem(id) {
    await supabase.from('custom_items').delete().eq('id', id)
    setCustomItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="category-section">
      <div className="category-header">
        <span className="category-icon">✎</span>
        <span className="category-name">Deine Vorschläge</span>
      </div>

      <div className="notice" style={{ marginBottom: '1rem' }}>
        Schlage Items vor, die in der Liste fehlen. Der Partner sieht sie und bewertet sie genauso.
      </div>

      {myCustomItems.map(item => (
        <div key={item.id} className="item-card">
          <div className="item-top">
            <span className="item-label">{item.label}</span>
            <button
              className="item-info-btn"
              onClick={() => removeItem(item.id)}
              title="Entfernen"
            >
              ✕
            </button>
          </div>
          {item.info && <div className="item-info-text">{item.info}</div>}
          <AnswerButtons itemId={item.id} value={answers[item.id]} onChange={onAnswer} />
        </div>
      ))}

      {partnerCustomItems.length > 0 && (
        <>
          <div style={{ marginTop: '1.5rem', marginBottom: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
              Vorschläge vom Partner
            </div>
            {partnerCustomItems.map(item => (
              <div key={item.id} className="item-card">
                <div className="item-top">
                  <span className="item-label">{item.label}</span>
                </div>
                {item.info && <div className="item-info-text">{item.info}</div>}
                <AnswerButtons itemId={item.id} value={answers[item.id]} onChange={onAnswer} />
              </div>
            ))}
          </div>
        </>
      )}

      {adding ? (
        <div className="custom-item-input">
          <div className="custom-item-fields" style={{ marginBottom: '0.75rem' }}>
            <input
              className="input-sm"
              placeholder="Was fehlt in der Liste?"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              autoFocus
            />
            <input
              className="input-sm"
              placeholder="Kurze Erklärung (optional)"
              value={newInfo}
              onChange={e => setNewInfo(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-sm" onClick={addItem} disabled={loading || !newLabel.trim()}>
              {loading ? '…' : 'Hinzufügen'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setNewLabel(''); setNewInfo('') }}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => setAdding(true)} style={{ marginTop: '0.75rem' }}>
          + Item vorschlagen
        </button>
      )}
    </div>
  )
}

export default function FormPage({ session, slot, myName, onSubmit, onBack }) {
  const [answers, setAnswers] = useState({})
  const [customItems, setCustomItems] = useState([])
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id)
  const [submitting, setSubmitting] = useState(false)
  const [shareCode, setShareCode] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    async function loadCustomItems() {
      const { data } = await supabase
        .from('custom_items')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at')
      setCustomItems(data || [])
    }
    loadCustomItems()

    const channel = supabase
      .channel(`custom-items-${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'custom_items',
        filter: `session_id=eq.${session.id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setCustomItems(prev => {
            if (prev.find(i => i.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        } else if (payload.eventType === 'DELETE') {
          setCustomItems(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session.id])

  function handleAnswer(itemId, value) {
    setAnswers(prev => ({ ...prev, [itemId]: value }))
  }

  const allItems = getAllItems(customItems)
  const totalAnswerable = allItems.length
  const answered = allItems.filter(i => answers[i.id]).length
  const progress = totalAnswerable > 0 ? (answered / totalAnswerable) * 100 : 0

  function scrollToCategory(catId) {
    setActiveCat(catId)
    const el = document.getElementById(`cat-${catId}`)
    if (el) {
      const offset = el.getBoundingClientRect().top + window.scrollY - 120
      window.scrollTo({ top: offset, behavior: 'smooth' })
    }
  }

  async function handleSubmit() {
    setSubmitting(true)

    const { error } = await supabase.from('responses').upsert({
      session_id: session.id,
      slot,
      name: myName,
      answers,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'session_id,slot' })

    if (error) {
      console.error(error)
      setSubmitting(false)
      return
    }

    onSubmit()
  }

  function copyCode() {
    navigator.clipboard.writeText(session.code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  function shareViaWhatsApp() {
    const text = `Hier ist unser Code für die Kink List: *${session.code}* — öffne die App und gib den Code ein.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const catCompleteness = {}
  CATEGORIES.forEach(cat => {
    const catItems = cat.items
    const catAnswered = catItems.filter(i => answers[i.id]).length
    catCompleteness[cat.id] = catAnswered === catItems.length
  })

  return (
    <div ref={formRef}>
      <div className="progress-bar-wrap">
        <div className="progress-bar-inner">
          <div className="progress-meta">
            <span className="progress-label">{myName} — {session.code}</span>
            <span className="progress-count">{answered} / {totalAnswerable}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '1.5rem' }}>

        {/* Code share panel */}
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-title">Session-Code teilen</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.8rem', letterSpacing: '0.3em', color: 'var(--gold)', fontWeight: 300 }}>
              {session.code}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="copy-btn" onClick={copyCode}>
                {codeCopied ? '✓ Kopiert' : 'Kopieren'}
              </button>
              <button className="btn btn-sm btn-share" onClick={shareViaWhatsApp}>
                WhatsApp ↗
              </button>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            Schick diesen Code an deinen Partner. Er öffnet die App und gibt ihn ein.
          </div>
        </div>

        {/* Category tabs */}
        <div className="category-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`cat-tab ${activeCat === cat.id ? 'active' : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              <span className="tab-icon">{cat.icon}</span>
              {cat.label}
              {catCompleteness[cat.id] && <em className="tab-check">✓</em>}
            </button>
          ))}
          <button
            className={`cat-tab ${activeCat === 'custom' ? 'active' : ''}`}
            onClick={() => scrollToCategory('custom')}
          >
            <span className="tab-icon">✎</span>
            Vorschläge
          </button>
        </div>

        {/* Standard categories */}
        {CATEGORIES.map(cat => (
          <div key={cat.id} id={`cat-${cat.id}`} className="category-section">
            <div className="category-header">
              <span className="category-icon">{cat.icon}</span>
              <span className="category-name">{cat.label}</span>
            </div>
            {cat.items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                answer={answers[item.id]}
                onAnswer={handleAnswer}
              />
            ))}
          </div>
        ))}

        {/* Custom items */}
        <div id="cat-custom">
          <CustomItemsSection
            sessionId={session.id}
            slot={slot}
            customItems={customItems}
            setCustomItems={setCustomItems}
            answers={answers}
            onAnswer={handleAnswer}
          />
        </div>

        {/* Bottom padding for submit bar */}
        <div style={{ height: '80px' }} />
      </div>

      {/* Sticky submit bar */}
      <div className="submit-bar">
        <div className="submit-bar-text">
          <strong>{answered}</strong> von {totalAnswerable} bewertet
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            Abbrechen
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={submitting || answered === 0}
          >
            {submitting ? 'Wird gespeichert…' : 'Fertig & absenden'}
          </button>
        </div>
      </div>
    </div>
  )
}

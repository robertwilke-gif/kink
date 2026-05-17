import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase.js'
import { CATEGORIES, isPositive, getAllItems } from '../data/items.js'

const ANSWER_LABELS = { yes: 'Ja', curious: 'Neugierig', maybe: 'Vielleicht', no: 'Nein' }

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ answer }) {
  if (!answer) return null
  return <span className={`result-badge badge-${answer}`}>{ANSWER_LABELS[answer]}</span>
}

// ─── Comment Section ──────────────────────────────────────────────────────────
function CommentSection({ itemId, sessionId, slot, myName, partnerName, comments, onCommentsChange }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  const myComment = comments.find(c => c.item_id === itemId && c.author_slot === slot)
  const partnerComment = comments.find(c => c.item_id === itemId && c.author_slot !== slot)
  const hasAny = myComment || partnerComment

  function openEditor() {
    setText(myComment?.text || '')
    setEditing(true)
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    const record = {
      session_id: sessionId,
      item_id: itemId,
      author_slot: slot,
      text: text.trim().slice(0, 200),
    }
    await supabase.from('comments').upsert(record, { onConflict: 'session_id,item_id,author_slot' })
    const updated = comments.filter(c => !(c.item_id === itemId && c.author_slot === slot))
    onCommentsChange([...updated, { ...record, author_name: myName }])
    setEditing(false)
    setSaving(false)
  }

  async function remove() {
    await supabase.from('comments').delete()
      .eq('session_id', sessionId).eq('item_id', itemId).eq('author_slot', slot)
    onCommentsChange(comments.filter(c => !(c.item_id === itemId && c.author_slot === slot)))
    setText('')
    setEditing(false)
    if (!partnerComment) setOpen(false)
  }

  return (
    <div className="comment-section">
      <button
        className={`comment-toggle ${hasAny ? 'has-comment' : ''}`}
        onClick={() => {
          if (!open) { setOpen(true); if (!myComment && !editing) setEditing(true); setTimeout(() => textareaRef.current?.focus(), 50) }
          else if (!editing) setOpen(false)
        }}
        title="Notiz"
      >
        {hasAny ? '✎·' : '✎'}
      </button>

      {open && (
        <div className="comment-body">
          {/* Partner comment (read-only) */}
          {partnerComment && (
            <div className="comment-entry partner-comment">
              <span className="comment-author">{partnerName}</span>
              <span className="comment-text">{partnerComment.text}</span>
            </div>
          )}

          {/* My comment (display or edit) */}
          {myComment && !editing && (
            <div className="comment-entry my-comment">
              <span className="comment-author">{myName}</span>
              <span className="comment-text">{myComment.text}</span>
              <div className="comment-actions">
                <button className="comment-action-btn" onClick={openEditor}>bearbeiten</button>
                <button className="comment-action-btn" onClick={remove}>löschen</button>
              </div>
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <div className="comment-form">
              <textarea
                ref={textareaRef}
                className="comment-textarea"
                placeholder="Deine Notiz… (max. 200 Zeichen)"
                value={text}
                onChange={e => setText(e.target.value.slice(0, 200))}
                rows={2}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } }}
              />
              <div className="comment-form-actions">
                <span className="comment-char">{text.length}/200</span>
                <button className="comment-action-btn" onClick={() => { setEditing(false); if (!myComment && !partnerComment) setOpen(false) }}>
                  abbrechen
                </button>
                <button className="comment-save-btn" onClick={save} disabled={saving || !text.trim()}>
                  {saving ? '…' : 'Speichern'}
                </button>
              </div>
            </div>
          )}

          {!editing && !myComment && (
            <button className="comment-add-btn" onClick={openEditor}>+ Eigene Notiz</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Wishlist Button ──────────────────────────────────────────────────────────
function WishlistButton({ itemId, itemLabel, sessionId, slot, wishlist, onWishlistChange }) {
  const entry = wishlist.find(w => w.item_id === itemId)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    if (entry) {
      await supabase.from('wishlist').delete().eq('session_id', sessionId).eq('item_id', itemId)
      onWishlistChange(wishlist.filter(w => w.item_id !== itemId))
    } else {
      const record = { session_id: sessionId, item_id: itemId, item_label: itemLabel, added_by_slot: slot, done: false }
      await supabase.from('wishlist').insert(record)
      onWishlistChange([...wishlist, record])
    }
    setLoading(false)
  }

  return (
    <button
      className={`wishlist-btn ${entry ? 'active' : ''}`}
      onClick={toggle}
      disabled={loading}
      title={entry ? 'Aus Wunschliste entfernen' : 'Zur Wunschliste hinzufügen'}
    >
      {entry ? '◆' : '◇'}
    </button>
  )
}

// ─── Download Matches ─────────────────────────────────────────────────────────
function DownloadMatches({ matchItems, myName, partnerName, myAnswers, partnerAnswers }) {
  if (matchItems.length === 0) return null

  function download() {
    const catOrder = {}
    CATEGORIES.forEach((cat, idx) => { catOrder[cat.id] = idx })

    const grouped = {}
    matchItems.forEach(item => {
      const key = item.categoryLabel
      if (!grouped[key]) grouped[key] = { items: [], order: catOrder[item.categoryId] ?? 999 }
      grouped[key].items.push(item)
    })

    const sortedGroups = Object.entries(grouped).sort((a, b) => a[1].order - b[1].order)

    const LABELS = { yes: 'Ja', curious: 'Neugierig', maybe: 'Vielleicht', no: 'Nein' }

    const lines = [
      'SHERIN & ROBERT — KINK LIST',
      '════════════════════════════════',
      '',
      `${myName} & ${partnerName}`,
      `${matchItems.length} gemeinsame Matches`,
      `Stand: ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      '',
      '════════════════════════════════',
      '',
    ]

    sortedGroups.forEach(([catLabel, { items }]) => {
      lines.push(catLabel.toUpperCase())
      lines.push('─'.repeat(catLabel.length))
      items.forEach(item => {
        const my = LABELS[myAnswers[item.id]] || '–'
        const their = LABELS[partnerAnswers[item.id]] || '–'
        lines.push(`  ${item.label}`)
        lines.push(`    ${myName}: ${my}  ·  ${partnerName}: ${their}`)
      })
      lines.push('')
    })

    lines.push('════════════════════════════════')
    lines.push('Erstellt mit der persönlichen Kink List')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kink-list-matches-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button className="btn btn-sm" onClick={download} style={{ marginBottom: '1.5rem' }}>
      ↓ Liste herunterladen
    </button>
  )
}

// ─── Conversation Starter ─────────────────────────────────────────────────────
function ConversationStarter({ matchItems }) {
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey || matchItems.length < 3) return null

  async function generate(item) {
    setLoading(true)
    setError('')
    const picked = item || matchItems[Math.floor(Math.random() * matchItems.length)]

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: `Du bist ein diskreter Begleiter für Paare die offen miteinander reden möchten. Das Paar hat das Thema "${picked.label}" als gemeinsames Interesse markiert.

Formuliere genau eine offene Gesprächsfrage (keine Ja/Nein-Frage) die das Paar einlädt, ehrlicher und tiefer über dieses Thema zu sprechen — konkret, neugierig, ohne zu werten. Keine Einleitung, keine Erklärung, nur die Frage. Auf Deutsch. Maximal 2 Sätze.`,
          }],
        }),
      })

      if (!res.ok) throw new Error(`API Fehler ${res.status}`)
      const data = await res.json()
      setCard({ item: picked, question: data.content[0].text.trim() })
    } catch (e) {
      setError('Konnte keine Frage generieren. Bitte versuche es erneut.')
    }
    setLoading(false)
  }

  return (
    <div className="conv-starter">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: card ? '1rem' : 0 }}>
        <button className="btn btn-sm" onClick={() => generate(null)} disabled={loading}>
          {loading
            ? <span className="conv-spinner">◈</span>
            : '◈ Gesprächsstarter'}
        </button>
        {card && !loading && (
          <button className="btn btn-ghost btn-sm" onClick={() => generate(null)}>
            Andere Frage
          </button>
        )}
      </div>

      {error && <div className="error-text" style={{ marginTop: '0.5rem' }}>{error}</div>}

      {card && !loading && (
        <div className="conv-card">
          <div className="conv-card-item">{card.item.label}</div>
          <div className="conv-card-question">{card.question}</div>
        </div>
      )}
    </div>
  )
}

// ─── Result Item ──────────────────────────────────────────────────────────────
function ResultItem({ item, myAnswer, partnerAnswer, isMatch, sessionId, slot, myName, partnerName, comments, onCommentsChange, wishlist, onWishlistChange }) {
  const [showInfo, setShowInfo] = useState(false)
  const cat = CATEGORIES.find(c => c.id === item.categoryId)

  return (
    <div className="result-item">
      <div className="result-badges">
        <Badge answer={myAnswer} />
        <Badge answer={partnerAnswer} />
      </div>
      <div className="result-content">
        <div className="result-cat">
          {cat ? `${cat.icon} ${item.categoryLabel}` : item.categoryLabel}
        </div>
        <div className="result-label-row">
          <span className="result-label">
            {item.isCustom && <span className="custom-badge">Vorschlag</span>}
            {item.label}
          </span>
          <div className="result-item-actions">
            {isMatch && (
              <WishlistButton
                itemId={item.id}
                itemLabel={item.label}
                sessionId={sessionId}
                slot={slot}
                wishlist={wishlist}
                onWishlistChange={onWishlistChange}
              />
            )}
            <CommentSection
              itemId={item.id}
              sessionId={sessionId}
              slot={slot}
              myName={myName}
              partnerName={partnerName}
              comments={comments}
              onCommentsChange={onCommentsChange}
            />
          </div>
        </div>
        {item.info && (
          <button className="item-info-btn" onClick={() => setShowInfo(v => !v)} style={{ marginTop: '0.2rem' }}>
            {showInfo ? '▲ weniger' : 'ℹ Info'}
          </button>
        )}
        {showInfo && <div className="item-info-text" style={{ marginTop: '0.35rem' }}>{item.info}</div>}
      </div>
    </div>
  )
}

// ─── Result Group ─────────────────────────────────────────────────────────────
function ResultGroup({ items, myAnswers, partnerAnswers, isMatchTab, sessionId, slot, myName, partnerName, comments, onCommentsChange, wishlist, onWishlistChange }) {
  const grouped = {}
  const catOrder = {}
  CATEGORIES.forEach((cat, idx) => { catOrder[cat.id] = idx })
  catOrder['custom'] = 999

  items.forEach(item => {
    const key = item.categoryId
    if (!grouped[key]) grouped[key] = { items: [], label: item.categoryLabel, icon: '' }
    grouped[key].items.push(item)
    const cat = CATEGORIES.find(c => c.id === item.categoryId)
    grouped[key].icon = cat ? cat.icon : '✎'
  })

  const sortedKeys = Object.keys(grouped).sort((a, b) => (catOrder[a] ?? 999) - (catOrder[b] ?? 999))

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">◇</span>
        <div className="empty-text">Keine Items in dieser Kategorie</div>
      </div>
    )
  }

  return (
    <div>
      {sortedKeys.map(catId => {
        const group = grouped[catId]
        return (
          <div key={catId} className="result-cat-group">
            <div className="result-cat-header">
              <span className="result-cat-icon">{group.icon}</span>
              <span className="result-cat-name">{group.label}</span>
              <span className="result-cat-count">{group.items.length}</span>
            </div>
            {group.items.map(item => (
              <ResultItem
                key={item.id}
                item={item}
                myAnswer={myAnswers[item.id]}
                partnerAnswer={partnerAnswers[item.id]}
                isMatch={isMatchTab}
                sessionId={sessionId}
                slot={slot}
                myName={myName}
                partnerName={partnerName}
                comments={comments}
                onCommentsChange={onCommentsChange}
                wishlist={wishlist}
                onWishlistChange={onWishlistChange}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Wishlist Tab ─────────────────────────────────────────────────────────────
function WishlistTab({ sessionId, wishlist, onWishlistChange }) {
  async function toggleDone(entry) {
    await supabase.from('wishlist').update({ done: !entry.done }).eq('session_id', sessionId).eq('item_id', entry.item_id)
    onWishlistChange(wishlist.map(w => w.item_id === entry.item_id ? { ...w, done: !w.done } : w))
  }

  async function removeEntry(entry) {
    await supabase.from('wishlist').delete().eq('session_id', sessionId).eq('item_id', entry.item_id)
    onWishlistChange(wishlist.filter(w => w.item_id !== entry.item_id))
  }

  const active = wishlist.filter(w => !w.done)
  const done = wishlist.filter(w => w.done)

  if (wishlist.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">◇</span>
        <div className="empty-text">Noch nichts auf der Wunschliste.<br />Markiere Matches mit ◇.</div>
      </div>
    )
  }

  return (
    <div>
      {active.map(entry => (
        <div key={entry.item_id} className="wishlist-entry">
          <button className="wishlist-done-btn" onClick={() => toggleDone(entry)} title="Als erledigt markieren">◇</button>
          <span className="wishlist-label">{entry.item_label}</span>
          <button className="wishlist-remove-btn" onClick={() => removeEntry(entry)} title="Entfernen">✕</button>
        </div>
      ))}

      {done.length > 0 && (
        <>
          {active.length > 0 && <div className="wishlist-divider">Erledigt</div>}
          {done.map(entry => (
            <div key={entry.item_id} className="wishlist-entry done">
              <button className="wishlist-done-btn" onClick={() => toggleDone(entry)} title="Zurücksetzen">◆</button>
              <span className="wishlist-label">{entry.item_label}</span>
              <button className="wishlist-remove-btn" onClick={() => removeEntry(entry)} title="Entfernen">✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Main ResultsPage ─────────────────────────────────────────────────────────
export default function ResultsPage({ session, slot, myName, responses, onBack }) {
  const [activeTab, setActiveTab] = useState('match')
  const [customItems, setCustomItems] = useState([])
  const [comments, setComments] = useState([])
  const [wishlist, setWishlist] = useState([])

  useEffect(() => {
    async function load() {
      const [ciRes, cmRes, wlRes] = await Promise.all([
        supabase.from('custom_items').select('*').eq('session_id', session.id).order('created_at'),
        supabase.from('comments').select('*').eq('session_id', session.id),
        supabase.from('wishlist').select('*').eq('session_id', session.id).order('created_at'),
      ])
      setCustomItems(ciRes.data || [])
      setComments(cmRes.data || [])
      setWishlist(wlRes.data || [])
    }
    load()
  }, [session.id])

  const myResponse = responses.find(r => r.slot === slot)
  const partnerResponse = responses.find(r => r.slot !== slot)

  if (!myResponse || !partnerResponse) {
    return (
      <div className="page">
        <div className="container">
          <div className="notice">Warte noch auf den zweiten Teilnehmer…</div>
          <button className="btn btn-ghost" onClick={onBack}>Zurück</button>
        </div>
      </div>
    )
  }

  const partnerName = partnerResponse.name
  const myAnswers = myResponse.answers || {}
  const partnerAnswers = partnerResponse.answers || {}
  const allItems = getAllItems(customItems)

  const matchItems = [], oneForItItems = [], noMatchItems = []

  allItems.forEach(item => {
    const my = myAnswers[item.id], their = partnerAnswers[item.id]
    if (!my && !their) return
    const myPos = isPositive(my), theirPos = isPositive(their)
    if (myPos && theirPos) matchItems.push(item)
    else if (myPos || theirPos) oneForItItems.push(item)
    else if (my && their) noMatchItems.push(item)
  })

  const tabs = [
    { id: 'match', label: 'Matches', count: matchItems.length },
    { id: 'one', label: 'Einer dafür', count: oneForItItems.length },
    { id: 'none', label: 'Kein Match', count: noMatchItems.length },
    { id: 'wish', label: 'Wunschliste', count: wishlist.length },
  ]

  const activeItems = activeTab === 'match' ? matchItems
    : activeTab === 'one' ? oneForItItems
    : noMatchItems

  const commonProps = { sessionId: session.id, slot, myName, partnerName, comments, onCommentsChange: setComments, wishlist, onWishlistChange: setWishlist }

  function shareViaWhatsApp() {
    const text = `Kink List-Code (zum erneuten Aufrufen): *${session.code}*`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="page">
      <div className="container">
        <header className="app-header">
          <div className="app-eyebrow">Kink List · Auswertung</div>
          <h1 className="app-title">Sherin & Robert</h1>
          <div className="app-subtitle">{myName} & {partnerName}</div>
        </header>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span className="result-badge badge-yes" style={{ fontSize: '0.6rem' }}>Ja</span>
            <span>= {myName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span className="result-badge badge-curious" style={{ fontSize: '0.6rem' }}>Neugierig</span>
            <span>/ {partnerName} · obere Badge = {myName}, untere = {partnerName}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="result-tabs">
          {tabs.map(tab => (
            <button key={tab.id} className={`result-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <span className="tab-count">{tab.count}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Matches toolbar */}
        {activeTab === 'match' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <DownloadMatches
              matchItems={matchItems}
              myName={myName}
              partnerName={partnerName}
              myAnswers={myAnswers}
              partnerAnswers={partnerAnswers}
            />
            {matchItems.length >= 3 && <ConversationStarter matchItems={matchItems} />}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'wish' ? (
          <WishlistTab sessionId={session.id} wishlist={wishlist} onWishlistChange={setWishlist} />
        ) : (
          <ResultGroup
            items={activeItems}
            myAnswers={myAnswers}
            partnerAnswers={partnerAnswers}
            isMatchTab={activeTab === 'match'}
            {...commonProps}
          />
        )}

        <hr className="divider" style={{ marginTop: '3rem' }} />

        {/* Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
          <div className="panel">
            <div className="panel-title">Session-Code</div>
            <div style={{ fontSize: '1.6rem', letterSpacing: '0.3em', color: 'var(--gold)', fontWeight: 300, marginBottom: '0.5rem' }}>
              {session.code}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
              Speichere diesen Code, um die Ergebnisse später wieder aufzurufen.
            </div>
            <button className="btn btn-sm btn-share" onClick={shareViaWhatsApp}>
              Code via WhatsApp merken ↗
            </button>
          </div>
          <button className="btn btn-ghost btn-full" onClick={onBack}>Neue Session starten</button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { CATEGORIES, isPositive, getAllItems } from '../data/items.js'

const ANSWER_LABELS = {
  yes: 'Ja',
  curious: 'Neugierig',
  maybe: 'Vielleicht',
  no: 'Nein',
}

function Badge({ answer }) {
  if (!answer) return null
  return (
    <span className={`result-badge badge-${answer}`}>
      {ANSWER_LABELS[answer]}
    </span>
  )
}

function ResultItem({ item, myAnswer, partnerAnswer }) {
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
        <div className="result-label">
          {item.isCustom && <span className="custom-badge">Vorschlag</span>}
          {item.label}
        </div>
        {item.info && (
          <button
            className="item-info-btn"
            onClick={() => setShowInfo(v => !v)}
            style={{ marginTop: '0.25rem' }}
          >
            {showInfo ? '▲ weniger' : 'ℹ Info'}
          </button>
        )}
        {showInfo && <div className="item-info-text" style={{ marginTop: '0.35rem' }}>{item.info}</div>}
      </div>
    </div>
  )
}

function ResultGroup({ items, myAnswers, partnerAnswers, myName, partnerName }) {
  const grouped = {}
  const catOrder = {}

  CATEGORIES.forEach((cat, idx) => {
    catOrder[cat.id] = idx
  })
  catOrder['custom'] = 999

  items.forEach(item => {
    const key = item.categoryId
    if (!grouped[key]) grouped[key] = { items: [], label: item.categoryLabel, icon: '' }
    grouped[key].items.push(item)
    const cat = CATEGORIES.find(c => c.id === item.categoryId)
    if (cat) grouped[key].icon = cat.icon
    else grouped[key].icon = '✎'
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
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function ResultsPage({ session, slot, myName, responses, onBack }) {
  const [activeTab, setActiveTab] = useState('match')
  const [customItems, setCustomItems] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('custom_items')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at')
      setCustomItems(data || [])
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

  const matchItems = []
  const oneForItItems = []
  const noMatchItems = []

  allItems.forEach(item => {
    const my = myAnswers[item.id]
    const their = partnerAnswers[item.id]

    if (!my && !their) return

    const myPos = isPositive(my)
    const theirPos = isPositive(their)

    if (myPos && theirPos) {
      matchItems.push(item)
    } else if (myPos || theirPos) {
      oneForItItems.push(item)
    } else if (my && their) {
      noMatchItems.push(item)
    }
  })

  const tabs = [
    { id: 'match', label: 'Matches', count: matchItems.length, desc: 'Beide positiv' },
    { id: 'one', label: 'Einer dafür', count: oneForItItems.length, desc: 'Einer positiv' },
    { id: 'none', label: 'Kein Match', count: noMatchItems.length, desc: 'Beide negativ' },
  ]

  const activeItems = activeTab === 'match' ? matchItems
    : activeTab === 'one' ? oneForItItems
    : noMatchItems

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
          <div style={{ display: 'flex', align: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span className={`result-badge badge-yes`} style={{ fontSize: '0.6rem' }}>Ja</span>
            <span>= {myName}</span>
          </div>
          <div style={{ display: 'flex', align: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span className={`result-badge badge-curious`} style={{ fontSize: '0.6rem' }}>Neugierig</span>
            <span>/ {partnerName} · obere Badge = {myName}, untere = {partnerName}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="result-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`result-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-count">{tab.count}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <ResultGroup
          items={activeItems}
          myAnswers={myAnswers}
          partnerAnswers={partnerAnswers}
          myName={myName}
          partnerName={partnerName}
        />

        <hr className="divider" style={{ marginTop: '3rem' }} />

        {/* Footer actions */}
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

          <button className="btn btn-ghost btn-full" onClick={onBack}>
            Neue Session starten
          </button>
        </div>
      </div>
    </div>
  )
}

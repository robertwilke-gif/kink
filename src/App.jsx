import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import StartPage from './components/StartPage.jsx'
import FormPage from './components/FormPage.jsx'
import WaitingPage from './components/WaitingPage.jsx'
import ResultsPage from './components/ResultsPage.jsx'

const STORAGE_KEY = 'kink_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export default function App() {
  const [view, setView] = useState('loading')
  const [session, setSession] = useState(null)
  const [slot, setSlot] = useState(null)
  const [myName, setMyName] = useState('')
  const [responses, setResponses] = useState([])

  useEffect(() => {
    async function restore() {
      const saved = loadSession()
      if (!saved) {
        setView('start')
        return
      }

      const { data: sessionData, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('code', saved.code)
        .single()

      if (error || !sessionData) {
        clearSession()
        setView('start')
        return
      }

      if (new Date(sessionData.expires_at) < new Date()) {
        clearSession()
        setView('start')
        return
      }

      const { data: resp } = await supabase
        .from('responses')
        .select('*')
        .eq('session_id', sessionData.id)

      setSession(sessionData)
      setSlot(saved.slot)
      setMyName(saved.name)
      setResponses(resp || [])

      const myResponse = (resp || []).find(r => r.slot === saved.slot)
      if (!myResponse) {
        setView('form')
        return
      }

      if ((resp || []).length < 2) {
        setView('waiting')
        return
      }

      setView('results')
    }

    restore()
  }, [])

  async function handleSessionReady(sessionData, slotNum, name, existingResponses) {
    setSession(sessionData)
    setSlot(slotNum)
    setMyName(name)
    saveSession({ code: sessionData.code, slot: slotNum, name })

    // Returning to a completed session — go straight to results
    if (existingResponses && existingResponses.length >= 2) {
      setResponses(existingResponses)
      setView('results')
      return
    }

    setView('form')
  }

  async function handleFormSubmit() {
    const { data: resp } = await supabase
      .from('responses')
      .select('*')
      .eq('session_id', session.id)

    setResponses(resp || [])

    if ((resp || []).length >= 2) {
      setView('results')
    } else {
      setView('waiting')
    }
  }

  async function handleWaitingDone(resp) {
    setResponses(resp)
    setView('results')
  }

  function handleReset() {
    clearSession()
    setSession(null)
    setSlot(null)
    setMyName('')
    setResponses([])
    setView('start')
  }

  if (view === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Laden…
        </div>
      </div>
    )
  }

  if (view === 'start') {
    return <StartPage onReady={handleSessionReady} />
  }

  if (view === 'form') {
    return (
      <FormPage
        session={session}
        slot={slot}
        myName={myName}
        onSubmit={handleFormSubmit}
        onBack={handleReset}
      />
    )
  }

  if (view === 'waiting') {
    return (
      <WaitingPage
        session={session}
        slot={slot}
        myName={myName}
        onDone={handleWaitingDone}
        onBack={handleReset}
      />
    )
  }

  if (view === 'results') {
    return (
      <ResultsPage
        session={session}
        slot={slot}
        myName={myName}
        responses={responses}
        onBack={handleReset}
      />
    )
  }

  return null
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) }
  }

  let label
  try {
    label = JSON.parse(event.body).label
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Du bist ein diskreter Begleiter für Paare die offen miteinander reden möchten. Das Paar hat das Thema "${label}" als gemeinsames Interesse markiert.

Formuliere genau eine offene Gesprächsfrage (keine Ja/Nein-Frage) die das Paar einlädt, ehrlicher und tiefer über dieses Thema zu sprechen — konkret, neugierig, ohne zu werten. Keine Einleitung, keine Erklärung, nur die Frage. Auf Deutsch. Maximal 2 Sätze.`,
      }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { statusCode: 500, body: JSON.stringify({ error: `Anthropic error ${res.status}: ${text}` }) }
  }

  const data = await res.json()
  const question = data.content[0].text.trim()

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  }
}

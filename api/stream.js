export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  // 1. Попытка через Cobalt API Gateway
  const COBALT_SERVERS = [
    'https://cobalt.synap.tech',
    'https://api.cobalt.tools',
    'https://dl.khub.win',
    'https://cobalt.canine.tools'
  ];

  for (const server of COBALT_SERVERS) {
    try {
      const resp = await fetch(server, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${id}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const url = data.url || data.audio;
        if (url) {
          return res.status(200).json({ url });
        }
      }
    } catch {
      continue;
    }
  }

  // 2. Попытка через Invidious API
  const INVIDIOUS_SERVERS = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://vid.puffyan.us',
    'https://invidious.private.coffee'
  ];

  for (const inv of INVIDIOUS_SERVERS) {
    try {
      const resp = await fetch(`${inv}/api/v1/videos/${id}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });

      if (resp.ok) {
        const json = await resp.json();
        const formats = [
          ...(json.adaptiveFormats || []),
          ...(json.formatStreams || []),
        ];

        const audio = formats
          .filter((f) => f.url && (f.type?.includes('audio') || f.container === 'm4a'))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (audio && audio.url) {
          return res.status(200).json({ url: audio.url });
        }
      }
    } catch {
      continue;
    }
  }

  return res.status(500).json({ error: 'All audio gateways failed' });
}

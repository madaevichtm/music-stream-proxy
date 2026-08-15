export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  // 1. Проверенные рабочие Piped API шлюзы (сами проксируют аудио без блокировок)
  const PIPED_SERVERS = [
    'https://pipedapi.adminforge.de',
    'https://api.piped.privacydev.net',
    'https://pipedapi.kavin.rocks',
    'https://piped-api.lunar.icu',
    'https://api.piped.projectsegfau.lt'
  ];

  for (const server of PIPED_SERVERS) {
    try {
      const resp = await fetch(`${server}/streams/${id}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(4000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const streams = (data.audioStreams || [])
          .filter((s) => s.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        if (streams.length > 0 && streams[0].url) {
          return res.status(200).json({ url: streams[0].url });
        }
      }
    } catch {
      continue;
    }
  }

  // 2. Фоллбек через прямой Yewtube / Invidious stream URL
  const INVIDIOUS_SERVERS = [
    'https://yewtu.be',
    'https://inv.tux.pizza',
    'https://invidious.jing.rocks'
  ];

  for (const inv of INVIDIOUS_SERVERS) {
    try {
      const resp = await fetch(`${inv}/api/v1/videos/${id}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });

      if (resp.ok) {
        const json = await resp.json();
        const audio = (json.adaptiveFormats || [])
          .filter((f) => f.url && f.type?.includes('audio'))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (audio && audio.url) {
          return res.status(200).json({ url: audio.url });
        }
      }
    } catch {
      continue;
    }
  }

  return res.status(500).json({ error: 'Stream extraction failed' });
}

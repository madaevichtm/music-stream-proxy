export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  // 1. Быстрый экстрактор через Piped инстансы
  const fetchPiped = async (host) => {
    const r = await fetch(`${host}/streams/${id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) throw new Error('Piped error');
    const data = await r.json();
    const streams = (data.audioStreams || [])
      .filter((s) => s.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    if (!streams.length || !streams[0].url) throw new Error('No audio');
    return streams[0].url;
  };

  // 2. Быстрый экстрактор через Invidious инстансы
  const fetchInvidious = async (host) => {
    const r = await fetch(`${host}/api/v1/videos/${id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) throw new Error('Invidious error');
    const data = await r.json();
    const audio = (data.adaptiveFormats || [])
      .filter((f) => f.url && f.type?.includes('audio'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    if (!audio || !audio.url) throw new Error('No audio');
    return audio.url;
  };

  // Параллельный запуск всех живых нод
  const sources = [
    fetchPiped('https://pipedapi.adminforge.de'),
    fetchPiped('https://api.piped.privacydev.net'),
    fetchPiped('https://pipedapi.kavin.rocks'),
    fetchInvidious('https://inv.tux.pizza'),
    fetchInvidious('https://yewtu.be'),
    fetchInvidious('https://invidious.jing.rocks'),
  ];

  try {
    const streamUrl = await Promise.any(sources);
    return res.status(200).json({ url: streamUrl });
  } catch (err) {
    return res.status(500).json({ error: 'All audio gateways failed' });
  }
}

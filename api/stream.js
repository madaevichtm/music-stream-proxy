import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const info = await ytdl.getInfo(videoUrl);

    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    const bestAudio = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

    if (!bestAudio || !bestAudio.url) {
      return res.status(404).json({ error: 'Audio stream not found' });
    }

    return res.status(200).json({ url: bestAudio.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

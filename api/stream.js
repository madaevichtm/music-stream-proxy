import { Innertube, UniversalCache } from 'youtubei.js';

let yt;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  try {
    if (!yt) {
      yt = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
    }

    // Запрос через мобильный клиент Android (не блокируется датацентрами)
    const info = await yt.getInfo(id, { client: 'ANDROID' });
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    const streamUrl = format ? format.decipher(yt.session.player) : null;

    if (streamUrl) {
      return res.status(200).json({ url: streamUrl });
    }

    // Резервный вызов через getBasicInfo
    const basic = await yt.getBasicInfo(id);
    const basicFormat = basic.chooseFormat({ type: 'audio', quality: 'best' });
    const basicUrl = basicFormat ? basicFormat.decipher(yt.session.player) : null;

    if (basicUrl) {
      return res.status(200).json({ url: basicUrl });
    }

    return res.status(404).json({ error: 'Audio stream not found' });
  } catch (err) {
    try {
      const basic = await yt.getBasicInfo(id);
      const basicFormat = basic.chooseFormat({ type: 'audio', quality: 'best' });
      const basicUrl = basicFormat ? basicFormat.decipher(yt.session.player) : null;
      if (basicUrl) return res.status(200).json({ url: basicUrl });
    } catch (fallbackErr) {
      // Игнорируем и возвращаем исходную ошибку
    }
    return res.status(500).json({ error: err.message });
  }
}

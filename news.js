const Parser = require('rss-parser');
const parser = new Parser({ timeout: 8000 });

// RSS Berita Indonesia
const FEEDS = [
  { source: 'Kompas', url: 'https://www.kompas.com/rss' },
  { source: 'Detik', url: 'https://rss.detik.com/index.php/detikcom' },
  { source: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/rss' },
  { source: 'Antara', url: 'https://www.antaranews.com/rss/terkini' },
  { source: 'Tempo', url: 'https://rss.tempo.co/nasional' },
  { source: 'Republika', url: 'https://www.republika.co.id/rss' },
  { source: 'Kumparan', url: 'https://lapi.kumparan.com/v2.0/rss' },
];

let cache = { data: [], ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).slice(0, 8).map(item => ({
      source: feed.source,
      title: item.title || '-',
      link: item.link || '#',
      desc: (item.contentSnippet || item.content || '').slice(0, 200),
      date: item.pubDate || item.isoDate || new Date().toISOString(),
      image: extractImage(item)
    }));
  } catch (e) {
    return [];
  }
}

function extractImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item['media:content']?.$.url) return item['media:content'].$.url;
  if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;
  const html = item['content:encoded'] || item.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function getNews(limit = 12) {
  if (Date.now() - cache.ts < CACHE_TTL && cache.data.length > 0) {
    return cache.data.slice(0, limit);
  }
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = results.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
  cache = { data: all, ts: Date.now() };
  return all.slice(0, limit);
}

module.exports = { getNews };

/**
 * WW3 Probability Index Updater
 * 
 * Fetches geopolitical news headlines from RSS feeds,
 * sends them to Claude AI for "analysis," and writes
 * a probability score to docs/data/index.json.
 * 
 * FOR ENTERTAINMENT ONLY.
 */

import Anthropic from '@anthropic-ai/sdk';
import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// --- RSS Feeds (geopolitical / world news) ---
const FEEDS = [
  { name: 'Reuters World',       url: 'https://feeds.reuters.com/Reuters/worldNews' },
  { name: 'BBC World',           url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Al Jazeera',          url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'AP Top News',         url: 'https://rsshub.app/apnews/topics/apf-topnews' },
  { name: 'NPR World',           url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'Guardian World',      url: 'https://www.theguardian.com/world/rss' },
  { name: 'France24',            url: 'https://www.france24.com/en/rss' },
];

async function fetchHeadlines() {
  const parser = new Parser({ timeout: 10000 });
  const headlines = [];

  for (const feed of FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      const items = (result.items || []).slice(0, 10); // top 10 per feed
      for (const item of items) {
        headlines.push({
          source: feed.name,
          title: item.title || '',
          snippet: (item.contentSnippet || '').slice(0, 200),
          date: item.isoDate || item.pubDate || '',
        });
      }
      console.log(`  ✓ ${feed.name}: ${items.length} headlines`);
    } catch (err) {
      console.warn(`  ✗ ${feed.name}: ${err.message}`);
    }
  }

  return headlines;
}

function buildPrompt(headlines) {
  const headlineBlock = headlines
    .map(h => `[${h.source}] ${h.title}${h.snippet ? ' — ' + h.snippet : ''}`)
    .join('\n');

  return `You are the PRED-7X, an satirical AI "geopolitical threat assessment" robot.

Your job: read today's news headlines and produce a WW3 PROBABILITY INDEX score from 0.00 to 100.00.

This is ENTERTAINMENT / SATIRE — not real intelligence analysis. But you should still:
- Scan for keywords about military conflicts, nuclear threats, alliances breaking, troop movements, sanctions, etc.
- Weight them by severity (nuclear > conventional, direct superpower conflict > proxy wars)
- Consider de-escalation signals as negative weight
- Add a small random factor (±2%) so the number isn't perfectly deterministic
- Produce a score that feels dramatic but loosely grounded in today's headlines

Respond with ONLY a JSON object, no markdown fences:
{
  "score": <number 0.00-100.00>,
  "trend": "<up|down|stable>",
  "summary": "<1-2 sentence dramatic summary of why the score is what it is>",
  "top_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "mood": "<one word: CALM | TENSE | ELEVATED | CRITICAL | DEFCON>"
}

TODAY'S HEADLINES:
${headlineBlock}`;
}

async function getAIScore(headlines) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: buildPrompt(headlines) }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Strip any accidental markdown fences
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function main() {
  console.log('🎛️  PRED-7X — WW3 Probability Index Updater');
  console.log('━'.repeat(50));

  // 1. Fetch headlines
  console.log('\n📡 Fetching geopolitical headlines...');
  const headlines = await fetchHeadlines();
  console.log(`\n  Total headlines: ${headlines.length}`);

  if (headlines.length === 0) {
    console.error('❌ No headlines fetched — aborting.');
    process.exit(1);
  }

  // 2. AI scoring
  console.log('\n🤖 Analyzing with Claude AI...');
  const result = await getAIScore(headlines);
  console.log(`\n  Score: ${result.score}%`);
  console.log(`  Trend: ${result.trend}`);
  console.log(`  Mood:  ${result.mood}`);
  console.log(`  Summary: ${result.summary}`);

  // 3. Build output
  const now = new Date().toISOString();
  const output = {
    score: result.score,
    trend: result.trend,
    summary: result.summary,
    top_factors: result.top_factors,
    mood: result.mood,
    updated_at: now,
    headlines_scanned: headlines.length,
    disclaimer: 'FOR ENTERTAINMENT ONLY. Not a real threat assessment.',
  };

  // 4. Write current index
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(output, null, 2));
  console.log(`\n💾 Wrote ${INDEX_FILE}`);

  // 5. Append to history (keep last 500 entries)
  const history = loadHistory();
  history.push({ score: result.score, trend: result.trend, mood: result.mood, updated_at: now });
  const trimmed = history.slice(-500);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
  console.log(`📊 History: ${trimmed.length} entries`);

  console.log('\n✅ Index updated successfully.');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

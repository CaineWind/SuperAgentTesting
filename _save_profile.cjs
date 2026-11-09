const { DatabaseSync } = require('node:sqlite');
const path = 'C:/Users/user/.dsh/state/dsh-superagent-plus/orchestrator.sqlite';

const d = new DatabaseSync(path);
d.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');

// Replicate Agents.create() exactly for the first profile.
const KEY = 'agents-profiles';
const readList = () => {
  const row = d.prepare('SELECT value FROM kv WHERE key=?').get(KEY);
  return row ? JSON.parse(String(row.value)) : [];
};

function slugOf(name) {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28);
  return /^[a-z]/.test(slug) ? slug : `p-${slug || 'profile'}`;
}
const modelOf = (value) => value.model ? {
  provider: value.model.includes('/') ? value.model.slice(0, value.model.indexOf('/')) : 'custom',
  ...(value.model.includes('/') ? { model: value.model.slice(value.model.indexOf('/') + 1) } : { model: value.model })
} : null;

const AVATAR_COLORS = ['#3B82F6', '#0E9F6E', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

const name = 'Executor';
const instructions = '开发者 执行器';
const modelInput = 'workbuddy/deepseek-v4-flash';
const workDir = 'D:\\opensource\\SuperAgentTesting';

const list = readList();
if (list.some(p => p.name.toLowerCase() === name.toLowerCase())) {
  throw new Error(`A profile named ${name} already exists`);
}
const base = slugOf(name);
const id = list.some(p => p.id === base) ? `${base}-${list.length + 1}` : base;

const profile = {
  id,
  name,
  role: '',
  instructions,
  model: modelOf({ model: modelInput }),
  workDir,
  skills: [],
  mcp: [],
  avatar: { color: AVATAR_COLORS[list.length % AVATAR_COLORS.length] }
};

// Validate field constraints from ProfileSchema manually.
if (!/^[a-z][a-z0-9-]{0,31}$/.test(profile.id)) throw new Error('bad id');
if (name.length < 1 || name.length > 40) throw new Error('bad name');
if (instructions.length > 4000) throw new Error('bad instructions');

d.exec('BEGIN IMMEDIATE');
try {
  d.prepare('INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(KEY, JSON.stringify([...list, profile]));
  d.exec('COMMIT');
} catch (e) {
  d.exec('ROLLBACK');
  throw e;
}

console.log('Saved profile:');
console.log(JSON.stringify(profile, null, 2));
console.log('\nCurrent stored list:');
console.log(JSON.stringify(readList(), null, 2));

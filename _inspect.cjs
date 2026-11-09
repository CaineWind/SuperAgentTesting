const { DatabaseSync } = require('node:sqlite');
const path = 'C:/Users/user/.dsh/state/dsh-superagent-plus/orchestrator.sqlite';
const d = new DatabaseSync(path, { readOnly: true });
const rows = d.prepare("SELECT key, value FROM kv WHERE key LIKE 'agents%'").all();
for (const r of rows) console.log(r.key, '=>', r.value);
if (!rows.length) console.log('(no agents keys yet)');

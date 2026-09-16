// Execute the real Node suites against a recording proxy. Qt replays every
// deterministic call (including invalid actions) and compares complete results.
import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(process.argv[2]);
const root = path.resolve(import.meta.dirname, '../..');
const names = ['deck','createGame','act','placements','royalSlots','armourSlots','damage','kills','label','royal','special','color','top'];
fs.writeFileSync(path.join(out, 'proxy.mjs'), `
import fs from 'node:fs';
import * as E from ${JSON.stringify(root + '/engine.mjs')};
export * from ${JSON.stringify(root + '/engine.mjs')};
const calls = [];
const clone = v => JSON.parse(JSON.stringify(v));
function record(name, args) {
  if (name === 'createGame' && args.length < 2) args = [args[0] || 'revised', E.shuffle(E.deck())];
  const row = {name, args:clone(args)};
  try { const result = E[name](...args); row.result = result === undefined ? null : clone(result); calls.push(row); return result; }
  catch(e) { row.error = e.message; calls.push(row); throw e; }
}
${names.map(n => `export const ${n} = (...args) => record('${n}', args);`).join('\n')}
process.on('beforeExit', () => fs.writeFileSync(${JSON.stringify(out + '/traces.json')}, JSON.stringify(calls)));
`);
for (const f of ['engine.test.mjs','simulation.test.mjs']) {
  fs.writeFileSync(path.join(out, f), fs.readFileSync(path.join(root,'test',f),'utf8').replace('"../engine.mjs"', '"./proxy.mjs"'));
}
// One process shares the trace recorder across both suites.
fs.writeFileSync(path.join(out,'run.mjs'), "import './engine.test.mjs';\nimport './simulation.test.mjs';\n");

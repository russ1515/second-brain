// Pass 2 of the theme migration: inject the token hooks into the components that
// need them, after scripts/migrate-theme.mjs has done the mechanical rewrite.
//
// For each TOP-LEVEL function declaration (column 0 — screens and their render
// helpers; never nested callbacks) whose body references `styles.` or a bare
// `c.`, it inserts, right after the opening brace:
//     const { colors: c } = useTokens();
//     const styles = useMemo(() => makeStyles(c), [c]);
// and ensures `useMemo` is imported from react. The `makeStyles` factory itself
// (its param is `c`) is skipped. Anything this misses (arrow components, unusual
// shapes) surfaces in the typecheck and is fixed by hand.
//
// Usage: node scripts/inject-tokens-hook.mjs <file>...
import fs from 'node:fs';
import path from 'node:path';

const HOOK =
  '\n  const { colors: c } = useTokens();' +
  '\n  const styles = useMemo(() => makeStyles(c), [c]);';

/** Index just past the `{` that opens the function BODY, given `parenOpen` = the
 *  index of the `(` starting the parameter list. Matches parens (so destructured
 *  params like `({ e, t }: T)` don't fool us), then takes the first `{` after
 *  the params close (skipping any `: ReturnType`). Returns -1 if not found. */
function bodyBraceAfterParams(src, parenOpen) {
  let depth = 0;
  let i = parenOpen;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  const brace = src.indexOf('{', i);
  return brace === -1 ? -1 : brace + 1;
}

/** Match the body span from an opening-brace index; returns the close index. */
function matchBrace(src, openIdx) {
  let depth = 1;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function inject(file) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('makeStyles = (c: ColorScale)')) {
    console.log(`— ${path.basename(file)} (no makeStyles; skipped)`);
    return;
  }

  // Collect top-level `function` headers (column 0). Screens use function
  // declarations; arrow components are handled by the typecheck fallback.
  const headerRe = /^(?:export\s+(?:default\s+)?)?function\s+([A-Za-z0-9_]+)\s*\(/gm;
  const inserts = [];
  let m;
  while ((m = headerRe.exec(src))) {
    const name = m[1];
    const parenOpen = m.index + m[0].length - 1; // the `(` at the end of the header
    const bodyOpen = bodyBraceAfterParams(src, parenOpen);
    if (bodyOpen === -1) continue;
    const bodyClose = matchBrace(src, bodyOpen);
    if (bodyClose === -1) continue;
    const body = src.slice(bodyOpen, bodyClose);
    // Skip the makeStyles factory (defined as arrow, not `function`, so it won't
    // match here anyway) and anything already wired.
    if (body.includes('makeStyles(c)')) continue;
    if (!/\bstyles\./.test(body) && !/\bc\.[a-zA-Z]/.test(body)) continue;
    inserts.push({ at: bodyOpen, name });
  }

  if (inserts.length === 0) {
    console.log(`— ${path.basename(file)} (no component used styles/c)`);
    return;
  }

  // Apply inserts back-to-front so indices stay valid.
  inserts.sort((a, b) => b.at - a.at);
  for (const ins of inserts) src = src.slice(0, ins.at) + HOOK + src.slice(ins.at);

  // Ensure useMemo is imported from react.
  if (!/\buseMemo\b/.test(src.split('\n').slice(0, 3).join('\n')) || !/from 'react'/.test(src)) {
    src = src.replace(/import \{([^}]*)\} from 'react';/, (full, names) => {
      if (/\buseMemo\b/.test(names)) return full;
      const trimmed = names.trim().replace(/,\s*$/, '');
      return `import { ${trimmed}, useMemo } from 'react';`;
    });
  }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`✓ ${path.basename(file)} (${inserts.length} hook${inserts.length > 1 ? 's' : ''}: ${inserts.map((i) => i.name).join(', ')})`);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/inject-tokens-hook.mjs <file>...');
  process.exit(1);
}
for (const f of files) inject(path.resolve(f));

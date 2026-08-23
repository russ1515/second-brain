// Semi-automated theme migration: rewrites the mechanical parts of moving a
// screen off the static `lib/theme` palette onto design tokens (`useTokens`).
//
// Per file it:
//   1. swaps `import { theme } from '<...>/lib/theme'` for `useTokens` +
//      `ColorScale` imports (with the correct relative depth),
//   2. renames every `theme.<role>` to `c.<newRole>`,
//   3. wraps the top-level `const styles = StyleSheet.create({...})` into
//      `const makeStyles = (c: ColorScale) => StyleSheet.create({...})`.
//
// The hooks (`const { colors: c } = useTokens();` +
// `const styles = useMemo(() => makeStyles(c), [c]);`) are added by hand,
// guided by the typecheck (every component using `styles`/`c` will error until
// its hook is present) — so nothing silently breaks.
//
// Usage: node scripts/migrate-theme.mjs apps/mobile/app/library.tsx [more...]
import fs from 'node:fs';
import path from 'node:path';

// old lib/theme role -> design-token role
const MAP = {
  bg: 'background',
  surface: 'surface',
  surfaceAlt: 'surfaceElevated',
  border: 'border',
  text: 'textPrimary',
  textMuted: 'textSecondary',
  textFaint: 'textMuted',
  accent: 'primary',
  accentText: 'onPrimary',
  ok: 'success',
  okBg: 'successSoft',
  warn: 'warning',
  danger: 'error',
  dangerBg: 'errorSoft',
};

function migrate(file) {
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  // 1. rename theme.<role> -> c.<newRole> (longest-first to avoid partial hits)
  for (const role of Object.keys(MAP).sort((a, b) => b.length - a.length)) {
    src = src.replace(new RegExp(`\\btheme\\.${role}\\b`, 'g'), `c.${MAP[role]}`);
  }

  // 2. swap the import line. Keep the same relative prefix (../ or ../../).
  src = src.replace(
    /import \{ theme \} from '((?:\.\.\/)+)lib\/theme';/,
    (_m, prefix) =>
      `import { useTokens } from '${prefix}lib/design/theme';\n` +
      `import type { ColorScale } from '${prefix}lib/design/tokens';`,
  );

  // 3. wrap the styles sheet in a makeStyles(c) factory. Only the prefix
  // changes — `StyleSheet.create({...})` stays balanced, so the closing `});`
  // is left untouched.
  src = src.replace(
    /const styles = StyleSheet\.create\(\{/,
    'const makeStyles = (c: ColorScale) => StyleSheet.create({',
  );

  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8');
    const hits = (before.match(/\btheme\.\w+/g) || []).length;
    console.log(`✓ ${file} (${hits} theme.* rewritten)`);
  } else {
    console.log(`— ${file} (no change)`);
  }
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/migrate-theme.mjs <file>...');
  process.exit(1);
}
for (const f of files) migrate(path.resolve(f));

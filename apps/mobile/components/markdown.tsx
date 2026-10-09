import { Fragment, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';

/**
 * A deliberately small Markdown renderer for lesson prose.
 *
 * Lessons and Tutor replies come back with light markdown. Rendered raw, the
 * punctuation leaks into the page and it stops looking like teaching prose.
 * Keep this renderer deliberately non-interactive, but consume the common
 * constructs a model may emit so fences, links and table pipes never become UI.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'ordered'; marker: string; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^\s*```/;
const HORIZONTAL_RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;

/** Group raw text into block-level pieces. Consecutive plain lines join into
 *  one paragraph, the way markdown treats a soft-wrapped block. */
function toBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let code: string[] | null = null;

  const flush = () => {
    if (para.length) {
      blocks.push({ kind: 'paragraph', text: para.join(' ').trim() });
      para = [];
    }
  };

  for (const line of lines) {
    if (FENCE.test(line)) {
      flush();
      if (code) {
        blocks.push({ kind: 'code', text: code.join('\n').trimEnd() });
        code = null;
      } else {
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (HORIZONTAL_RULE.test(line) || TABLE_DIVIDER.test(line)) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      blocks.push({ kind: 'bullet', text: bullet[1].replace(/^\[[ xX]\]\s*/, '').trim() });
      continue;
    }
    const ordered = ORDERED.exec(line);
    if (ordered) {
      flush();
      blocks.push({ kind: 'ordered', marker: `${ordered[1]}.`, text: ordered[2].trim() });
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      flush();
      blocks.push({ kind: 'quote', text: quote[1].trim() });
      continue;
    }
    const table = TABLE_ROW.exec(line);
    if (table) {
      flush();
      const cells = table[1].split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length) blocks.push({ kind: 'paragraph', text: cells.join(' · ') });
      continue;
    }
    para.push(line.trim());
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n').trimEnd() });
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

function readableInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1');
}

/** Render inline emphasis while turning non-interactive links into readable
 * labels. Tutor output must never show Markdown control punctuation. */
function renderInline(text: string, keyBase: string, styles: ReturnType<typeof makeStyles>) {
  const parts = readableInline(text).split(INLINE).filter((p) => p !== '');
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <Text key={key} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={key} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return (
        <Text key={key} style={styles.strike}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return (
        <Text key={key} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const blocks = toBlocks(text);
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        switch (block.kind) {
          case 'heading':
            return (
              <Text
                key={key}
                style={[
                  styles.heading,
                  block.level === 1 && styles.h1,
                  block.level === 2 && styles.h2,
                  block.level >= 3 && styles.h3,
                ]}
              >
                {renderInline(block.text, key, styles)}
              </Text>
            );
          case 'bullet':
            return (
              <View key={key} style={styles.listRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.listText}>{renderInline(block.text, key, styles)}</Text>
              </View>
            );
          case 'ordered':
            return (
              <View key={key} style={styles.listRow}>
                <Text style={styles.orderedMarker}>{block.marker}</Text>
                <Text style={styles.listText}>{renderInline(block.text, key, styles)}</Text>
              </View>
            );
          case 'quote':
            return (
              <View key={key} style={styles.quote}>
                <Text style={styles.paragraph}>{renderInline(block.text, key, styles)}</Text>
              </View>
            );
          case 'code':
            return <Text key={key} selectable style={styles.codeBlock}>{block.text}</Text>;
          default:
            return (
              <Text key={key} style={styles.paragraph}>
                {renderInline(block.text, key, styles)}
              </Text>
            );
        }
      })}
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  root: { gap: 12 },
  paragraph: { fontSize: 16, lineHeight: 26, color: c.textPrimary },
  heading: { color: c.textPrimary, fontWeight: '700' },
  h1: { fontSize: 21, lineHeight: 28, marginTop: 2 },
  h2: { fontSize: 18, lineHeight: 25, marginTop: 2 },
  h3: { fontSize: 16, lineHeight: 23, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  listRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  bulletDot: { fontSize: 16, lineHeight: 26, color: c.primary, width: 14, textAlign: 'center' },
  orderedMarker: { fontSize: 16, lineHeight: 26, color: c.primary, fontWeight: '700', minWidth: 20 },
  listText: { flex: 1, fontSize: 16, lineHeight: 26, color: c.textPrimary },
  bold: { fontWeight: '700', color: c.textPrimary },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: c.info,
    backgroundColor: c.surfaceElevated,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: c.aiAccent,
    paddingLeft: 12,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 21,
    color: c.textPrimary,
    backgroundColor: c.surfaceElevated,
    padding: 12,
  },
});

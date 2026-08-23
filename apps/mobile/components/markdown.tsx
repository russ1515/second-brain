import { Fragment, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';

/**
 * A deliberately small Markdown renderer for lesson prose.
 *
 * Lessons come back from the teacher with light markdown (headings, **bold**,
 * lists). Rendered raw, the asterisks and hashes leak into the page and it
 * stops looking like a textbook — so we handle the handful of constructs the
 * teacher actually emits and nothing more. No links/images/tables/HTML: this
 * is teaching prose, not a document format.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'ordered'; marker: string; text: string };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;

/** Group raw text into block-level pieces. Consecutive plain lines join into
 *  one paragraph, the way markdown treats a soft-wrapped block. */
function toBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      blocks.push({ kind: 'paragraph', text: para.join(' ').trim() });
      para = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === '') {
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
      blocks.push({ kind: 'bullet', text: bullet[1].trim() });
      continue;
    }
    const ordered = ORDERED.exec(line);
    if (ordered) {
      flush();
      blocks.push({ kind: 'ordered', marker: `${ordered[1]}.`, text: ordered[2].trim() });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

/** Render **bold**, *italic*, `code` inside a line as nested <Text> spans. */
function renderInline(text: string, keyBase: string, styles: ReturnType<typeof makeStyles>) {
  const parts = text.split(INLINE).filter((p) => p !== '');
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
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#93C5FD',
    backgroundColor: c.surfaceElevated,
  },
});

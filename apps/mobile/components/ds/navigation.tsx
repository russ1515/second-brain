import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';

/**
 * Navigation system (UI/UX Sprint 1, task UI-1.6).
 *
 * The official component for the FIVE spaces. Same behaviour everywhere, only the
 * form adapts to the platform: a vertical sidebar on desktop/tablet, a bottom
 * navigation bar on mobile. Not two products — one, adapted. Active state carries
 * icon + label + colour (never colour alone), accessibilityRole="tab".
 */
export type SpaceKey = 'home' | 'learn' | 'brain' | 'study' | 'profile';

export const SPACES: { key: SpaceKey; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: 'Accueil' },
  { key: 'learn', icon: '📚', label: 'Apprendre' },
  { key: 'brain', icon: '🧠', label: 'Mon cerveau' },
  { key: 'study', icon: '📅', label: 'Réviser' },
  { key: 'profile', icon: '👤', label: 'Profil' },
];

export function SpaceNav({
  active,
  onSelect,
  variant,
}: {
  active: SpaceKey;
  onSelect: (k: SpaceKey) => void;
  /** Override the responsive default (used by the playground to show both). */
  variant?: 'sidebar' | 'bottom';
}) {
  const { width } = useResponsive();
  const kind = variant ?? (width >= 600 ? 'sidebar' : 'bottom');
  return kind === 'sidebar' ? (
    <Sidebar active={active} onSelect={onSelect} />
  ) : (
    <BottomNav active={active} onSelect={onSelect} />
  );
}

function Sidebar({ active, onSelect }: { active: SpaceKey; onSelect: (k: SpaceKey) => void }) {
  const { colors: c, radius, spacing } = useTokens();
  return (
    <View
      accessibilityRole="tablist"
      style={{ width: 232, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.borderSubtle, padding: spacing.sm, gap: 4 }}
    >
      <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }}>
        SECOND BRAIN
      </Text>
      {SPACES.map((s) => {
        const on = s.key === active;
        return (
          <Pressable
            key={s.key}
            onPress={() => onSelect(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: on ? c.aiAccentSoft : 'transparent', minHeight: 44 }}
          >
            <Text style={{ fontSize: 18 }}>{s.icon}</Text>
            <Text style={{ color: on ? c.aiAccent : c.textSecondary, fontSize: 15, fontWeight: on ? '700' : '500' }}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BottomNav({ active, onSelect }: { active: SpaceKey; onSelect: (k: SpaceKey) => void }) {
  const { colors: c } = useTokens();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingBottom: 6, paddingTop: 6 }}
    >
      {SPACES.map((s) => {
        const on = s.key === active;
        return (
          <Pressable
            key={s.key}
            onPress={() => onSelect(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
            style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 20, opacity: on ? 1 : 0.6 }}>{s.icon}</Text>
            <Text style={{ color: on ? c.aiAccent : c.textMuted, fontSize: 10, fontWeight: on ? '700' : '500' }} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

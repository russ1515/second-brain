import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import {
  listAdminUsers,
  recordNumber,
  recordString,
  type AdminUserList,
  type AdminUserRow,
  type UserDirectoryQuery,
  userIdOf,
} from '../lib/users';
import { u, userStatusLabel, type UserCopyKey } from '../lib/user-i18n';

type Theme = { surface: string; mutedSurface: string; border: string; text: string; muted: string; primary: string; primarySoft: string; danger: string; warning: string; success: string };
type FilterKey = 'accountStatus' | 'plan' | 'subscriptionStatus' | 'quotaState';
type SortKey = 'createdAt' | 'lastActiveAt' | 'email';

const PAGE_SIZE = 25;
const filters: { key: FilterKey; options: { value: string; label: UserCopyKey }[] }[] = [
  { key: 'accountStatus', options: [{ value: 'active', label: 'active' }, { value: 'suspended', label: 'suspended' }, { value: 'banned', label: 'banned' }, { value: 'deletion_pending', label: 'deletionPending' }] },
  { key: 'plan', options: [{ value: 'free', label: 'free' }, { value: 'pro', label: 'pro' }, { value: 'pro_max', label: 'proMax' }] },
  { key: 'subscriptionStatus', options: [{ value: 'active', label: 'active' }, { value: 'past_due', label: 'pastDue' }, { value: 'payment_failed', label: 'paymentFailed' }, { value: 'canceled', label: 'canceled' }, { value: 'expired', label: 'expired' }] },
  { key: 'quotaState', options: [{ value: 'PRIMARY', label: 'primary' }, { value: 'FALLBACK', label: 'fallback' }, { value: 'BLOCKED', label: 'blocked' }] },
];

const sortOptions: { value: SortKey; label: UserCopyKey }[] = [
  { value: 'createdAt', label: 'sortNewest' }, { value: 'lastActiveAt', label: 'sortLastActive' }, { value: 'email', label: 'sortEmail' },
];

function themeFor(dark: boolean): Theme {
  return dark
    ? { surface: '#111827', mutedSurface: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', danger: '#f87171', warning: '#fbbf24', success: '#34d399' }
    : { surface: '#fff', mutedSurface: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#64748b', primary: '#2563eb', primarySoft: '#dbeafe', danger: '#dc2626', warning: '#b45309', success: '#047857' };
}

function hasCapability(capabilities: string[], roles: string[], capability: string): boolean {
  return roles.includes('SUPER_ADMIN') || capabilities.includes(capability);
}

function dateLabel(locale: 'fr' | 'en', value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function usageLabel(locale: 'fr' | 'en', row: AdminUserRow): string {
  const value = recordNumber(row, ['usagePercent', 'usagePercentage', 'quotaUsagePercent', 'usage']);
  if (value === undefined) return '—';
  return `${new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }).format(value <= 1 ? value * 100 : value)} %`;
}

function statusTone(status: unknown, theme: Theme): string {
  const normalized = String(status ?? '').toUpperCase().replace(/[ -]/g, '_');
  if (['BANNED', 'BLOCKED', 'PAYMENT_FAILED', 'EXPIRED'].includes(normalized)) return theme.danger;
  if (['SUSPENDED', 'DELETION_PENDING', 'FALLBACK', 'PAST_DUE'].includes(normalized)) return theme.warning;
  if (['ACTIVE', 'PRIMARY', 'FREE', 'PRO', 'PRO_MAX'].includes(normalized)) return theme.success;
  return theme.muted;
}

function userName(row: AdminUserRow): string {
  return recordString(row, ['displayName', 'name', 'fullName']) ?? '—';
}

function Cell({ children, width, theme, dim }: { children: React.ReactNode; width: number; theme: Theme; dim?: boolean }) {
  return <View style={{ width, minWidth: width, paddingHorizontal: 10, justifyContent: 'center' }}><Text numberOfLines={2} style={{ color: dim ? theme.muted : theme.text, fontSize: 12 }}>{children}</Text></View>;
}

function FilterGroup({
  group, value, onChange, theme, locale,
}: { group: (typeof filters)[number]; value?: string; onChange(value?: string): void; theme: Theme; locale: 'fr' | 'en' }) {
  return <View style={{ gap: 6 }}>
    <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800' }}>{u(locale, group.key === 'accountStatus' ? 'accountStatus' : group.key === 'subscriptionStatus' ? 'subscription' : group.key === 'quotaState' ? 'quotaState' : 'plan')}</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Pressable accessibilityRole="radio" accessibilityState={{ selected: !value }} accessibilityLabel={u(locale, 'all')} onPress={() => onChange(undefined)} style={{ borderWidth: 1, borderColor: !value ? theme.primary : theme.border, backgroundColor: !value ? theme.primarySoft : 'transparent', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: !value ? theme.primary : theme.muted, fontSize: 11, fontWeight: '700' }}>{u(locale, 'all')}</Text></Pressable>
      {group.options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: value === option.value }} accessibilityLabel={u(locale, option.label)} onPress={() => onChange(value === option.value ? undefined : option.value)} style={{ borderWidth: 1, borderColor: value === option.value ? theme.primary : theme.border, backgroundColor: value === option.value ? theme.primarySoft : 'transparent', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: value === option.value ? theme.primary : theme.muted, fontSize: 11, fontWeight: '700' }}>{u(locale, option.label)}</Text></Pressable>)}
    </View>
  </View>;
}

function DirectoryRow({ row, theme, locale, showCountry, onOpen, compact }: { row: AdminUserRow; theme: Theme; locale: 'fr' | 'en'; showCountry: boolean; onOpen(): void; compact: boolean }) {
  const id = userIdOf(row);
  const account = recordString(row, ['accountStatus', 'status']);
  const plan = recordString(row, ['plan', 'planSlug']);
  const subscription = recordString(row, ['subscriptionStatus', 'subscription', 'subscription_state']);
  const quota = recordString(row, ['quotaState', 'quotaStatus', 'quota_state']);
  if (compact) return <Pressable accessibilityRole="button" accessibilityLabel={`${u(locale, 'user')}: ${userName(row)}. ${u(locale, 'email')}: ${recordString(row, ['email']) ?? '—'}. ${u(locale, 'accountStatus')}: ${userStatusLabel(locale, account)}`} onPress={onOpen} style={{ gap: 9, padding: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 10, backgroundColor: theme.surface }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: theme.text, fontWeight: '800' }}>{userName(row)}</Text><Text numberOfLines={1} style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{recordString(row, ['email']) ?? '—'}</Text></View><Text style={{ color: statusTone(account, theme), fontSize: 11, fontWeight: '800' }}>{userStatusLabel(locale, account)}</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Text style={{ color: theme.muted, fontSize: 11 }}>{u(locale, 'plan')}: <Text style={{ color: theme.text }}>{userStatusLabel(locale, plan)}</Text></Text><Text style={{ color: theme.muted, fontSize: 11 }}>{u(locale, 'quotaState')}: <Text style={{ color: statusTone(quota, theme) }}>{userStatusLabel(locale, quota)}</Text></Text><Text style={{ color: theme.muted, fontSize: 11 }}>{u(locale, 'usagePercent')}: <Text style={{ color: theme.text }}>{usageLabel(locale, row)}</Text></Text></View>
    <Text style={{ color: theme.muted, fontSize: 10 }}>{id ?? '—'} · {dateLabel(locale, recordString(row, ['lastActiveAt', 'lastActive']))}</Text>
  </Pressable>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${u(locale, 'user')}: ${userName(row)}. ${u(locale, 'email')}: ${recordString(row, ['email']) ?? '—'}`} onPress={onOpen} style={{ flexDirection: 'row', minWidth: showCountry ? 1510 : 1360, minHeight: 62, borderBottomWidth: 1, borderBottomColor: theme.border, alignItems: 'stretch' }}>
    <Cell width={180} theme={theme}><Text style={{ color: theme.text, fontWeight: '700' }}>{userName(row)}</Text><Text numberOfLines={1} style={{ color: theme.muted, fontSize: 10 }}>{id ?? '—'}</Text></Cell><Cell width={210} theme={theme} dim>{recordString(row, ['email']) ?? '—'}</Cell><Cell width={132} theme={theme}><Text style={{ color: statusTone(account, theme), fontWeight: '800', fontSize: 11 }}>{userStatusLabel(locale, account)}</Text></Cell><Cell width={92} theme={theme}>{userStatusLabel(locale, plan)}</Cell><Cell width={130} theme={theme}>{userStatusLabel(locale, subscription)}</Cell><Cell width={110} theme={theme}><Text style={{ color: statusTone(quota, theme), fontWeight: '800', fontSize: 11 }}>{userStatusLabel(locale, quota)}</Text></Cell><Cell width={80} theme={theme}>{usageLabel(locale, row)}</Cell>{showCountry && <Cell width={110} theme={theme}>{recordString(row, ['country', 'countryCode']) ?? '—'}</Cell>}<Cell width={122} theme={theme}>{recordString(row, ['interfaceLanguage', 'locale', 'language']) ?? '—'}</Cell><Cell width={145} theme={theme} dim>{dateLabel(locale, recordString(row, ['createdAt']))}</Cell><Cell width={145} theme={theme} dim>{dateLabel(locale, recordString(row, ['lastActiveAt', 'lastActive']))}</Cell>
  </Pressable>;
}

export function UserDirectory() {
  const { locale, dark } = useAdminUi(); const { identity } = useAuth(); const { width } = useWindowDimensions(); const router = useRouter(); const theme = useMemo(() => themeFor(dark), [dark]);
  const allowed = hasCapability(identity?.capabilities ?? [], identity?.roles ?? [], 'users.read');
  const canSubscriptions = hasCapability(identity?.capabilities ?? [], identity?.roles ?? [], 'subscriptions.read');
  const canQuotas = hasCapability(identity?.capabilities ?? [], identity?.roles ?? [], 'quotas.read');
  const [query, setQuery] = useState<UserDirectoryQuery>({ page: 1, pageSize: PAGE_SIZE, sortBy: 'createdAt', sortDirection: 'desc' });
  const [searchDraft, setSearchDraft] = useState(''); const [result, setResult] = useState<AdminUserList | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const compact = width < 900;
  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true); setError(null);
    try { setResult(await listAdminUsers(query)); }
    catch { setError(u(locale, 'loadUsersError')); }
    finally { setLoading(false); }
  }, [allowed, locale, query]);
  useEffect(() => { void load(); }, [load]);
  const updateFilter = (key: FilterKey, value?: string) => setQuery((current) => ({ ...current, page: 1, [key]: value }));
  const changePage = (page: number) => setQuery((current) => ({ ...current, page: Math.max(1, page) }));
  const open = (row: AdminUserRow) => { const id = userIdOf(row); if (id) router.push(`/users/${encodeURIComponent(id)}` as never); };
  const showCountry = result?.items.some((row) => Boolean(recordString(row, ['country', 'countryCode']))) ?? false;
  const visibleFilters = filters.filter((group) => group.key === 'accountStatus' || (group.key === 'quotaState' ? canQuotas : canSubscriptions));
  const page = result?.page ?? query.page; const totalPages = result?.totalPages ?? (result?.total !== undefined ? Math.max(1, Math.ceil(result.total / query.pageSize)) : undefined);
  const summary = result?.summary;
  const summaryValues = summary ? [
    ['total', 'totalUsers'], ['active', 'active'], ['suspended', 'suspended'], ['banned', 'banned'], ['free', 'free'], ['pro', 'pro'], ['proMax', 'proMax'], ['fallback', 'fallback'], ['blocked', 'blocked'],
  ].map(([field, label]) => ({ label: label as UserCopyKey, value: recordNumber(summary, [field, field === 'totalUsers' ? 'usersTotal' : field]) })).filter((item) => item.value !== undefined) : [];
  if (!allowed) return <View accessibilityRole="alert" style={{ padding: 24, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}><Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{u(locale, 'usersTitle')}</Text><Text style={{ color: theme.muted, marginTop: 8 }}>{u(locale, 'forbidden')}</Text></View>;
  return <View style={{ gap: 18, paddingBottom: 30 }}>
    <View style={{ gap: 5 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 30, fontWeight: '800' }}>{u(locale, 'usersTitle')}</Text><Text style={{ color: theme.muted, fontSize: 13 }}>{u(locale, 'usersSubtitle')}</Text></View>
    <View style={{ gap: 12, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
      <View style={{ flexDirection: width < 680 ? 'column' : 'row', gap: 8 }}><TextInput accessibilityLabel={u(locale, 'searchUsers')} value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setQuery((current) => ({ ...current, page: 1, search: searchDraft.trim() || undefined }))} placeholder={u(locale, 'searchUsers')} placeholderTextColor={theme.muted} style={{ flex: 1, color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9 }} /><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'search')} onPress={() => setQuery((current) => ({ ...current, page: 1, search: searchDraft.trim() || undefined }))} style={{ justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: theme.primary, paddingHorizontal: 15, paddingVertical: 10 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{u(locale, 'search')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'clearFilters')} onPress={() => { setSearchDraft(''); setQuery({ page: 1, pageSize: PAGE_SIZE, sortBy: 'createdAt', sortDirection: 'desc' }); }} style={{ justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: theme.text, fontWeight: '700' }}>{u(locale, 'clearFilters')}</Text></Pressable></View>
      <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{u(locale, 'filters')}</Text>{visibleFilters.map((group) => <FilterGroup key={group.key} group={group} value={query[group.key]} onChange={(value) => updateFilter(group.key, value)} theme={theme} locale={locale} />)}</View>
      <View style={{ gap: 6 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800' }}>{u(locale, 'sorting')}</Text><View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{sortOptions.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: query.sortBy === option.value }} onPress={() => setQuery((current) => ({ ...current, page: 1, sortBy: option.value, sortDirection: current.sortBy === option.value && current.sortDirection === 'desc' ? 'asc' : 'desc' }))} style={{ borderWidth: 1, borderColor: query.sortBy === option.value ? theme.primary : theme.border, backgroundColor: query.sortBy === option.value ? theme.primarySoft : 'transparent', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: query.sortBy === option.value ? theme.primary : theme.muted, fontSize: 11, fontWeight: '700' }}>{u(locale, option.label)}{query.sortBy === option.value ? query.sortDirection === 'asc' ? ' ↑' : ' ↓' : ''}</Text></Pressable>)}</View></View>
    </View>
    {summaryValues.length > 0 && <View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>{u(locale, 'directorySummary')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{summaryValues.map((item) => <View key={item.label} style={{ minWidth: 95, padding: 10, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}><Text style={{ color: theme.muted, fontSize: 10 }}>{u(locale, item.label)}</Text><Text style={{ color: theme.text, marginTop: 3, fontWeight: '800' }}>{new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(item.value ?? 0)}</Text></View>)}</View></View>}
    {loading ? <View accessibilityLabel={u(locale, 'loading')} style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted }}>{u(locale, 'loading')}</Text></View>
      : error ? <View accessibilityRole="alert" style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}><Text style={{ color: theme.danger }}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'retry')} onPress={() => void load()} style={{ backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 9 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{u(locale, 'retry')}</Text></Pressable></View>
        : result?.items.length === 0 ? <View style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}><Text style={{ color: theme.muted }}>{u(locale, 'noUsers')}</Text></View>
          : <View style={{ gap: 10 }}><Text accessibilityLiveRegion="polite" style={{ color: theme.muted, fontSize: 12 }}>{result?.total !== undefined ? `${new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(result.total)} ${u(locale, 'results')}` : `${result?.items.length ?? 0} ${u(locale, 'results')}`}</Text>{compact ? <View style={{ gap: 9 }}>{result?.items.map((row) => <DirectoryRow key={userIdOf(row) ?? row.email ?? Math.random()} row={row} theme={theme} locale={locale} showCountry={showCountry} compact onOpen={() => open(row)} />)}</View> : <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}><View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.surface }}><View accessibilityRole="header" style={{ flexDirection: 'row', minWidth: showCountry ? 1510 : 1360, minHeight: 42, alignItems: 'center', backgroundColor: theme.mutedSurface }}><Cell width={180} theme={theme} dim>{u(locale, 'user')}</Cell><Cell width={210} theme={theme} dim>{u(locale, 'email')}</Cell><Cell width={132} theme={theme} dim>{u(locale, 'accountStatus')}</Cell><Cell width={92} theme={theme} dim>{u(locale, 'plan')}</Cell><Cell width={130} theme={theme} dim>{u(locale, 'subscription')}</Cell><Cell width={110} theme={theme} dim>{u(locale, 'quotaState')}</Cell><Cell width={80} theme={theme} dim>{u(locale, 'usagePercent')}</Cell>{showCountry && <Cell width={110} theme={theme} dim>{u(locale, 'country')}</Cell>}<Cell width={122} theme={theme} dim>{u(locale, 'interfaceLanguage')}</Cell><Cell width={145} theme={theme} dim>{u(locale, 'createdAt')}</Cell><Cell width={145} theme={theme} dim>{u(locale, 'lastActive')}</Cell></View>{result?.items.map((row) => <DirectoryRow key={userIdOf(row) ?? row.email ?? Math.random()} row={row} theme={theme} locale={locale} showCountry={showCountry} compact={false} onOpen={() => open(row)} />)}</View></ScrollView>}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'previous')} accessibilityState={{ disabled: page <= 1 }} disabled={page <= 1} onPress={() => changePage(page - 1)} style={{ opacity: page <= 1 ? .45 : 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: theme.border }}><Text style={{ color: theme.text, fontWeight: '700' }}>{u(locale, 'previous')}</Text></Pressable><Text accessibilityLiveRegion="polite" style={{ color: theme.muted, fontSize: 12 }}>{u(locale, 'page')} {page}{totalPages ? ` / ${totalPages}` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'next')} accessibilityState={{ disabled: totalPages !== undefined && page >= totalPages }} disabled={totalPages !== undefined && page >= totalPages} onPress={() => changePage(page + 1)} style={{ opacity: totalPages !== undefined && page >= totalPages ? .45 : 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: theme.border }}><Text style={{ color: theme.text, fontWeight: '700' }}>{u(locale, 'next')}</Text></Pressable></View>
          </View>}
    <Text style={{ color: theme.muted, fontSize: 11 }}>{u(locale, 'noBulkActions')}</Text>
  </View>;
}

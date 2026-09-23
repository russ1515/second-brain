import { Redirect, useLocalSearchParams } from 'expo-router';
import { Text, View, useColorScheme } from 'react-native';
import { SECTIONS, type Section } from '../../components/AdminShell';

const privacy: Partial<Record<Section, string>> = { users: 'RESTRICTED', documents: 'HIGHLY_RESTRICTED', security: 'HIGHLY_RESTRICTED', payments: 'RESTRICTED', emails: 'RESTRICTED' };
export default function SectionPage() {
  const { section } = useLocalSearchParams<{ section: string }>(); const dark = useColorScheme() === 'dark';
  if (!section || !SECTIONS.includes(section as Section) || section === 'dashboard') return <Redirect href="/dashboard" />;
  const level = privacy[section as Section] ?? 'STANDARD';
  return <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><View><Text style={{ fontSize: 26, fontWeight: '800', color: dark ? '#f8fafc' : '#0f172a', textTransform: 'capitalize' }}>{section}</Text><Text style={{ color: '#64748b' }}>Protected administrative route</Text></View><Text style={{ color: level === 'HIGHLY_RESTRICTED' ? '#dc2626' : '#64748b', fontSize: 11, fontWeight: '800' }}>{level}</Text></View>
    <View style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: dark ? '#475569' : '#cbd5e1', borderRadius: 12, backgroundColor: dark ? '#111827' : '#fff', padding: 28 }}><Text style={{ fontSize: 20, fontWeight: '700', color: dark ? '#e5e7eb' : '#0f172a' }}>Foundation ready</Text><Text style={{ color: '#64748b', textAlign: 'center', marginTop: 8 }}>No fabricated data. Detailed tables, filters and actions belong to Sprint 2.</Text></View>
  </View>;
}

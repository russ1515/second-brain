import { useState } from 'react';
import { Text, View } from 'react-native';
import type { KycTeacher, LearningCategory } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Card } from '../ds/core';
import { SpaceNav } from '../ds/navigation';
import {
  CognitiveSummary,
  LanguagesCard,
  ProfilePhoto,
  SystemConfig,
  TeacherConfig,
} from './components';
import { AcademicPathCard, GoalsCard, IdentityFull, LearnedLanguages } from './kyc';

/**
 * Profil & KYC + Responsive Native playground (UI/UX Sprint 7 unified). Live,
 * local, no network — the full learner configuration plus the responsive
 * navigation forms (sidebar / bottom), a desktop split-view and a 2×2 panel grid.
 */
export function ProfilePlayground() {
  const { colors: c, radius } = useTokens();
  const [photo, setPhoto] = useState<string | null>(null);
  const [emoji, setEmoji] = useState<string | null>('🧑‍🎓');
  const [first, setFirst] = useState('Amina');
  const [last, setLast] = useState('Test');
  const [birth, setBirth] = useState('05/09/2003');
  const [category, setCategory] = useState<LearningCategory>('university');
  const [education, setEducation] = useState<Record<string, string>>({ level: 'Licence 3', field: 'Informatique' });
  const [goals, setGoals] = useState<string[]>(['diploma', 'exams']);
  const [others, setOthers] = useState<string[]>(['Español']);
  const [mobility, setMobility] = useState(true);
  const [tone, setTone] = useState<KycTeacher['tone']>('balanced');
  const [expl, setExpl] = useState<KycTeacher['explanations']>('detailed');
  const [scheme, setScheme] = useState<'light' | 'dark' | 'system'>('system');
  const [nav, setNav] = useState<'home' | 'learn' | 'brain' | 'study' | 'profile'>('profile');
  const label = (t: string) => (
    <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{t}</Text>
  );
  const panel = (t: string) => (
    <View style={{ flexGrow: 1, width: '47%', minHeight: 70, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 12, backgroundColor: c.surface }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '700' }}>{t}</Text>
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      {label('Photo native (caméra / galerie / avatar / supprimer)')}
      <View style={{ alignItems: 'center' }}>
        <ProfilePhoto photoUri={photo} avatarEmoji={emoji} name={`${first} ${last}`} onPick={() => setPhoto(null)} onChooseAvatar={(e) => { setEmoji(e); setPhoto(null); }} onRemove={() => { setEmoji(null); setPhoto(null); }} />
      </View>

      {label('Identité universelle (prénom / nom / naissance / catégorie)')}
      <IdentityFull firstName={first} lastName={last} birthDate={birth} category={category} onFirst={setFirst} onLast={setLast} onBirth={setBirth} onCategory={setCategory} />

      {label('Parcours académique complet')}
      <AcademicPathCard education={education} onChange={(k, v) => setEducation((e) => ({ ...e, [k]: v }))} />

      {label('Langues + mobilité')}
      <LanguagesCard native="Français" study="English" mobility={mobility} onToggleMobility={setMobility} />
      <Card><LearnedLanguages languages={others} onChange={setOthers} /></Card>

      {label('Objectifs de réussite')}
      <GoalsCard goals={goals} onToggle={setGoals} />

      {label('Professeur IA (posture + explications)')}
      <TeacherConfig tone={tone} explanations={expl} onTone={setTone} onExplanations={setExpl} />

      {label('Digital Twin & stats')}
      <CognitiveSummary strengths={['Algorithmes', 'Structures de données']} retention={0.78} dailyMinutes={20} />

      {label('Système, thème & confidentialité')}
      <SystemConfig scheme={scheme} onScheme={setScheme} totalConcepts={42} reviews={12} onPrivacy={() => {}} onMemory={() => {}} />

      {/* ── Responsive Native ── */}
      {label('Responsive — Sidebar desktop (rétractable)')}
      <View style={{ height: 300, borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.lg, overflow: 'hidden' }}>
        <SpaceNav variant="sidebar" active={nav} onSelect={setNav} />
      </View>
      {label('Responsive — Bottom navigation mobile')}
      <View style={{ borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.lg, overflow: 'hidden' }}>
        <SpaceNav variant="bottom" active={nav} onSelect={setNav} />
      </View>
      {label('Desktop split-view (Document | Professeur IA)')}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {panel('📄 Document')}
        {panel('👨‍🏫 Professeur IA')}
      </View>
      {label('Profil 2×2 (desktop)')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {panel('Identité')}
        {panel('Parcours')}
        {panel('Langues')}
        {panel('Professeur IA')}
      </View>
    </View>
  );
}

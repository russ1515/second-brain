import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { adminEnvironment } from '../lib/api';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import { t } from '../lib/i18n';

export default function Login() {
  const auth = useAuth();
  const { locale, setLocale } = useAdminUi();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  if (auth.identity) return <Redirect href="/dashboard" />;
  const message = auth.error?.code === 'ADMIN_MFA_REQUIRED'
    ? t(locale, 'mfaRequiredError')
    : auth.error?.code === 'ADMIN_SESSION_EXPIRED'
      ? t(locale, 'sessionExpiredError')
      : auth.error?.status === 403
        ? t(locale, 'adminUnauthorizedError')
        : auth.error ? t(locale, 'loginFailed') : undefined;
  return <View style={{ flex: 1, backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 28, gap: 16 }}>
      <View><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontSize: 12, color: '#64748b', letterSpacing: 1 }}>SECOND BRAIN · {adminEnvironment}</Text><View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 5 }}><Pressable accessibilityRole="tab" accessibilityLabel="English" accessibilityState={{ selected: locale === 'en' }} aria-selected={locale === 'en'} onPress={() => setLocale('en')} style={locale === 'en' ? localeSelected : localeButton}><Text style={locale === 'en' ? localeSelectedText : localeText}>EN</Text></Pressable><Pressable accessibilityRole="tab" accessibilityLabel="Français" accessibilityState={{ selected: locale === 'fr' }} aria-selected={locale === 'fr'} onPress={() => setLocale('fr')} style={locale === 'fr' ? localeSelected : localeButton}><Text style={locale === 'fr' ? localeSelectedText : localeText}>FR</Text></Pressable></View></View><Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a' }}>{t(locale, 'loginHeading')}</Text></View>
      {!auth.challenge ? <>
        <TextInput autoCapitalize="none" keyboardType="email-address" accessibilityLabel={t(locale, 'adminEmail')} placeholder={t(locale, 'adminEmail')} value={email} onChangeText={setEmail} style={input} />
        <TextInput secureTextEntry accessibilityLabel={t(locale, 'password')} placeholder={t(locale, 'password')} value={password} onChangeText={setPassword} style={input} />
        <Pressable accessibilityRole="button" onPress={() => void auth.login(email, password).catch(() => undefined)} style={button}><Text style={buttonText}>{t(locale, 'continue')}</Text></Pressable>
      </> : <>
        <Text style={{ color: '#334155' }}>{t(locale, 'mfaInstruction')}</Text>
        <TextInput keyboardType="number-pad" maxLength={6} accessibilityLabel={t(locale, 'authenticationCode')} placeholder="000000" value={code} onChangeText={setCode} style={input} />
        <Pressable accessibilityRole="button" onPress={() => void auth.verify(code).catch(() => undefined)} style={button}><Text style={buttonText}>{t(locale, 'verifyMfa')}</Text></Pressable>
      </>}
      {auth.loading && <ActivityIndicator accessibilityLabel={t(locale, 'loadingAdmin')} />}{message && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{message}{auth.error?.requestId ? ` · ${t(locale, 'requestId')}: ${auth.error.requestId}` : ''}</Text>}
      <Text style={{ fontSize: 12, color: '#64748b' }}>{t(locale, 'accessRestricted')}</Text>
    </View>
  </View>;
}
const input = { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 } as const;
const button = { backgroundColor: '#2563eb', borderRadius: 8, padding: 13, alignItems: 'center' } as const;
const buttonText = { color: '#fff', fontWeight: '700' } as const;
const localeButton = { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 } as const;
const localeSelected = { ...localeButton, borderColor: '#2563eb', backgroundColor: '#dbeafe' } as const;
const localeText = { color: '#475569', fontSize: 11, fontWeight: '800' } as const;
const localeSelectedText = { ...localeText, color: '#1d4ed8' } as const;

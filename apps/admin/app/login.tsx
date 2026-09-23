import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { adminEnvironment } from '../lib/api';
import { useAuth } from '../contexts/auth';

export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  if (auth.identity) return <Redirect href="/dashboard" />;
  const message = auth.error?.code === 'ADMIN_MFA_REQUIRED'
    ? 'MFA required.'
    : auth.error?.code === 'ADMIN_SESSION_EXPIRED'
      ? 'Admin session expired. Sign in again.'
      : auth.error?.status === 403
        ? 'This account is not authorized for administration.'
        : auth.error?.message;
  return <View style={{ flex: 1, backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 28, gap: 16 }}>
      <View><Text style={{ fontSize: 12, color: '#64748b', letterSpacing: 1 }}>SECOND BRAIN · {adminEnvironment}</Text><Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a' }}>Control Center</Text></View>
      {!auth.challenge ? <>
        <TextInput autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Email" placeholder="Admin email" value={email} onChangeText={setEmail} style={input} />
        <TextInput secureTextEntry accessibilityLabel="Password" placeholder="Password" value={password} onChangeText={setPassword} style={input} />
        <Pressable accessibilityRole="button" onPress={() => void auth.login(email, password).catch(() => undefined)} style={button}><Text style={buttonText}>Continue</Text></Pressable>
      </> : <>
        <Text style={{ color: '#334155' }}>Enter the current 6-digit code from your authenticator.</Text>
        <TextInput keyboardType="number-pad" maxLength={6} accessibilityLabel="Authentication code" placeholder="000000" value={code} onChangeText={setCode} style={input} />
        <Pressable accessibilityRole="button" onPress={() => void auth.verify(code).catch(() => undefined)} style={button}><Text style={buttonText}>Verify MFA</Text></Pressable>
      </>}
      {auth.loading && <ActivityIndicator />}{message && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{message} {auth.error?.requestId ? `(${auth.error.requestId})` : ''}</Text>}
      <Text style={{ fontSize: 12, color: '#64748b' }}>Access is restricted, MFA-protected and audited.</Text>
    </View>
  </View>;
}
const input = { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 } as const;
const button = { backgroundColor: '#2563eb', borderRadius: 8, padding: 13, alignItems: 'center' } as const;
const buttonText = { color: '#fff', fontWeight: '700' } as const;

import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { backendApi } from '../lib/backend';

export default function AuthPage({ navigation, route }: any) {
  const initialRole = route?.params?.initialRole ?? 'USER';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const targetLabel = useMemo(() => (initialRole === 'ORGANIZER' ? '주최자' : '사용자'), [initialRole]);

  const moveAfterLogin = (roles: string[]) => {
    if (roles.includes('ORGANIZER') || roles.includes('ADMIN')) {
      navigation.replace('Organizer');
      return;
    }

    if (initialRole === 'ORGANIZER') {
      navigation.replace('Organizer');
      return;
    }

    navigation.replace('Main');
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('입력 필요', '이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const result = await backendApi.loginEmail({ email: email.trim(), password });
        let roles = result.user?.roles ?? [];
        if (roles.length === 0) {
          const profile = await backendApi.getMe();
          roles = profile.roles ?? [];
        }
        moveAfterLogin(roles);
      } else {
        await backendApi.registerEmail({ email: email.trim(), password, displayName: displayName.trim() });
        Alert.alert('회원가입 완료', '가입되었습니다. 주최자 신청은 다음 화면에서 진행할 수 있습니다.', [
          { text: '확인', onPress: () => navigation.replace(initialRole === 'ORGANIZER' ? 'Organizer' : 'Main') },
        ]);
      }
    } catch (error: any) {
      Alert.alert('인증 실패', error.message || '요청을 처리하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletAuth = () => {
    Alert.alert('준비 중', '지갑 인증은 모바일 브라우저 또는 전용 지갑 연동 단계에서 연결할 예정입니다.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.eyebrow}>{targetLabel} 시작</Text>
        <Text style={styles.title}>{isLogin ? '로그인' : '회원가입'}</Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, isLogin && styles.activeTab]} onPress={() => setIsLogin(true)}>
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, !isLogin && styles.activeTab]} onPress={() => setIsLogin(false)}>
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {!isLogin ? (
            <TextInput
              style={styles.input}
              placeholder="이름"
              value={displayName}
              onChangeText={setDisplayName}
            />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            disabled={loading}
            onPress={handleEmailAuth}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? '처리 중...' : isLogin ? '이메일로 로그인' : '이메일로 시작하기'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.walletButton} onPress={handleWalletAuth}>
          <Text style={styles.walletButtonText}>지갑으로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin((value) => !value)}>
          <Text style={styles.switchButtonText}>
            {isLogin ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 30, paddingTop: 60 },
  eyebrow: { color: '#2563EB', fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: 28, textAlign: 'center', color: '#0F172A' },
  tabContainer: { flexDirection: 'row', marginBottom: 26, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 16, color: '#64748B', fontWeight: '800' },
  activeTabText: { color: '#2563EB' },
  form: { gap: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', padding: 15, borderRadius: 12, fontSize: 16 },
  primaryButton: { backgroundColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { paddingHorizontal: 15, color: '#94A3B8', fontWeight: '700' },
  walletButton: { borderWidth: 1, borderColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center' },
  walletButtonText: { color: '#2563EB', fontSize: 16, fontWeight: '900' },
  switchButton: { marginTop: 28, alignItems: 'center' },
  switchButtonText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
});

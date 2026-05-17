import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';

export default function CheckInManagePage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [validatorId, setValidatorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const addValidator = async () => {
    if (!validatorId.trim()) {
      const message = '검증자로 등록할 사용자 UUID를 입력해 주세요.';
      setFeedback(message);
      Alert.alert('입력 필요', message);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.addEventValidator(eventId, { userId: validatorId.trim() });
      setValidatorId('');
      setFeedback('체크인 검증자를 등록했습니다.');
      Alert.alert('등록 완료', '체크인 검증자를 등록했습니다.');
    } catch (error: any) {
      const message = errorMessage(error, '검증자를 등록하지 못했습니다.');
      setFeedback(message);
      Alert.alert('검증자 등록 실패', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Check-in Manage</Text>
      <Text style={styles.title}>체크인 관리</Text>
      <Text style={styles.subtitle}>현장 검증자를 등록하고 QR/바코드 스캔 운영을 준비합니다.</Text>
      {feedback ? <View style={styles.messageBox}><Text style={styles.messageText}>{feedback}</Text></View> : null}
      <View style={styles.card}>
        <Text style={styles.label}>검증자 사용자 UUID</Text>
        <TextInput style={styles.input} value={validatorId} onChangeText={setValidatorId} placeholder="사용자 UUID" autoCapitalize="none" />
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={addValidator}>
          <Text style={styles.primaryButtonText}>{saving ? '등록 중...' : '검증자 등록'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>QR/바코드 스캔</Text>
        <Text style={styles.cardText}>카메라 기반 스캔 UI는 다음 단계에서 Expo 카메라 권한과 함께 연결하면 됩니다. 현재 백엔드는 `/check-ins` 입장 처리 API를 제공합니다.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  messageText: { color: '#1D4ED8', fontWeight: '800' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 20 },
  label: { marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});

import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate } from '../lib/ticketDisplay';

type QrPayload = {
  ticketId?: string;
  claimedOwner?: string;
  expiresAt?: string | number;
  signature?: string;
};

function normalizeExpiresAt(value?: string | number) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return new Date(Number(value) * 1000).toISOString();
  }
  return String(value);
}

function checkInResultMessage(error: unknown) {
  const message = errorMessage(error, '입장 처리에 실패했습니다.');
  if (message.includes('이미') || message.includes('사용 완료') || message.includes('USED')) return '이미 체크인된 티켓입니다.';
  if (message.includes('권한') || message.includes('FORBIDDEN')) {
    return '체크인 권한이 없습니다. 전역 검증자 또는 이 이벤트의 검증자로 등록된 계정이어야 합니다.';
  }
  if (message.includes('만료')) return '만료된 QR입니다. 관람객에게 QR 새로고침을 요청해주세요.';
  if (message.includes('서명') || message.includes('유효하지') || message.includes('SIGNATURE')) return 'QR 서명 또는 티켓 상태가 유효하지 않습니다.';
  return message;
}

function parsePayload(value: string): QrPayload {
  return JSON.parse(value.trim()) as QrPayload;
}

export default function CheckInManagePage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const scannedPayload = route?.params?.scannedPayload as string | undefined;
  const [validatorId, setValidatorId] = useState('');
  const [validators, setValidators] = useState<Record<string, unknown>[]>([]);
  const [ticketId, setTicketId] = useState('');
  const [claimedOwner, setClaimedOwner] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [signature, setSignature] = useState('');
  const [memo, setMemo] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const applyParsedPayload = useCallback((payload: QrPayload) => {
    setTicketId(payload.ticketId || '');
    setClaimedOwner(payload.claimedOwner || '');
    setExpiresAt(normalizeExpiresAt(payload.expiresAt));
    setSignature(payload.signature || '');
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await backendApi.getEventValidators(eventId).catch(() => []);
      setValidators(data);
    } catch (error: any) {
      setFeedback({ type: 'error', message: errorMessage(error, '검증자 목록을 불러오지 못했습니다.') });
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useFocusEffect(
    useCallback(() => {
      if (!scannedPayload) return;
      setQrPayload(scannedPayload);
      try {
        const parsed = parsePayload(scannedPayload);
        applyParsedPayload(parsed);
        setFeedback({ type: 'success', message: 'QR 정보를 읽었습니다. 아래 입장 처리 버튼을 눌러 완료해주세요.' });
      } catch {
        setFeedback({ type: 'error', message: '스캔한 QR 내용이 올바른 JSON 형식이 아닙니다.' });
      }
    }, [applyParsedPayload, scannedPayload]),
  );

  const addValidator = async () => {
    if (!validatorId.trim()) {
      const message = '검증자로 등록할 사용자 UUID를 입력해주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.addEventValidator(eventId, { userId: validatorId.trim() });
      setValidatorId('');
      setFeedback({ type: 'success', message: '체크인 검증자를 등록했습니다.' });
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '검증자를 등록하지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert('검증자 등록 실패', message);
    } finally {
      setSaving(false);
    }
  };

  const applyPayload = () => {
    try {
      const parsed = parsePayload(qrPayload);
      applyParsedPayload(parsed);
      setFeedback({ type: 'success', message: 'QR 내용을 입장 처리 정보에 반영했습니다.' });
    } catch {
      const message = 'QR payload는 JSON 형식이어야 합니다.';
      setFeedback({ type: 'error', message });
      Alert.alert('QR 입력 오류', message);
    }
  };

  const checkIn = async () => {
    if (!ticketId.trim() || !claimedOwner.trim() || !expiresAt.trim() || !signature.trim()) {
      const message = 'QR을 먼저 스캔하거나 QR 내용을 반영해주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('QR 정보 필요', message);
      return;
    }

    setCheckingIn(true);
    setFeedback(null);
    try {
      await backendApi.checkIn({
        ticketId: ticketId.trim(),
        claimedOwner: claimedOwner.trim(),
        expiresAt: expiresAt.trim(),
        signature: signature.trim(),
        memo: memo.trim() || null,
      });
      setFeedback({ type: 'success', message: '입장 처리가 완료되었습니다.' });
      setMemo('');
    } catch (error: any) {
      const message = checkInResultMessage(error);
      setFeedback({ type: 'error', message });
      Alert.alert('입장 처리 실패', message);
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Check-in Manage</Text>
      <Text style={styles.title}>체크인 관리</Text>
      <Text style={styles.subtitle}>QR을 스캔하면 입장 처리 정보가 자동으로 반영됩니다.</Text>

      {feedback ? (
        <View style={[styles.messageBox, feedback.type === 'error' ? styles.errorBox : styles.infoBox]}>
          <Text style={[styles.messageText, feedback.type === 'error' ? styles.errorText : styles.infoText]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>QR 스캔</Text>
        <Text style={styles.cardText}>관람객의 모바일 체크인 QR을 스캔해주세요. 스캔 후 바로 입장 처리를 진행할 수 있습니다.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('CheckInScan', { eventId })}>
          <Text style={styles.primaryButtonText}>QR 스캔하기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>입장 처리</Text>
        <Info label="티켓" value={ticketId || 'QR을 스캔해주세요'} />
        <Info label="만료 시간" value={expiresAt ? formatEventDate(expiresAt) : '-'} />
        <Info label="소유 지갑" value={claimedOwner || '-'} />
        <Text style={styles.label}>메모</Text>
        <TextInput style={styles.input} value={memo} onChangeText={setMemo} placeholder="선택 입력" />
        <TouchableOpacity style={[styles.primaryButton, checkingIn && styles.disabledButton]} disabled={checkingIn} onPress={checkIn}>
          <Text style={styles.primaryButtonText}>{checkingIn ? '처리 중...' : '입장 처리'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.collapseHeader} onPress={() => setManualOpen((value) => !value)}>
          <Text style={styles.cardTitle}>수동 입력</Text>
          <Text style={styles.chevron}>{manualOpen ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
        {manualOpen ? (
          <>
            <Text style={styles.cardText}>스캔이 어려운 경우에만 QR payload를 붙여넣어 사용합니다.</Text>
            <TextInput style={[styles.input, styles.textArea]} value={qrPayload} onChangeText={setQrPayload} placeholder='{"ticketId":"...","claimedOwner":"0x...","expiresAt":"...","signature":"..."}' multiline />
            <TouchableOpacity style={styles.secondaryButton} onPress={applyPayload}>
              <Text style={styles.secondaryButtonText}>QR 내용 반영</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>검증자 관리</Text>
        <Text style={styles.cardText}>이 이벤트의 체크인 처리를 맡을 계정을 등록합니다.</Text>
        <TextInput style={styles.input} value={validatorId} onChangeText={setValidatorId} placeholder="검증자 사용자 UUID" autoCapitalize="none" />
        <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} disabled={saving} onPress={addValidator}>
          <Text style={styles.secondaryButtonText}>{saving ? '등록 중...' : '검증자 등록'}</Text>
        </TouchableOpacity>
        {validators.length === 0 ? (
          <Text style={styles.emptyText}>등록된 검증자가 없습니다.</Text>
        ) : (
          validators.map((validator, index) => (
            <Text key={String(validator.id ?? index)} style={styles.validatorText}>
              {String(validator.displayName ?? validator.validatorId ?? validator.userId ?? validator.id ?? '-')}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
  infoBox: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  messageText: { fontWeight: '800', lineHeight: 19 },
  infoText: { color: '#1D4ED8' },
  errorText: { color: '#DC2626' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 20 },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: '#64748B', fontSize: 20, fontWeight: '900' },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: '#0F172A', fontWeight: '900' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 120, textAlignVertical: 'top', marginTop: 12 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  emptyText: { color: '#94A3B8', paddingTop: 14, textAlign: 'center' },
  validatorText: { marginTop: 10, color: '#475569', fontWeight: '800' },
});

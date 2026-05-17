import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { EventDetail } from '../types/api';

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'CONFERENCE', label: '컨퍼런스' },
  { value: 'ETC', label: '기타' },
];

export default function EventSettingsPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [eventAt, setEventAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await backendApi.getEvent(eventId);
      setEvent(detail);
      setName(detail.name || detail.title || '');
      setCategory(detail.category || 'CONCERT');
      setVenue(detail.venue || '');
      setDescription(detail.description || '');
      setEventAt((detail.eventAt || detail.eventDateTime || '').slice(0, 16));
    } catch (error: any) {
      Alert.alert('이벤트 정보 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!event) return;
    setSaving(true);
    setFeedback(null);
    try {
      await backendApi.updateEvent(event.id, {
        name: name.trim(),
        category,
        venue: venue.trim(),
        description: description.trim() || null,
        eventAt: eventAt ? new Date(eventAt).toISOString() : null,
      });
      setFeedback('이벤트 정보가 저장되었습니다.');
      Alert.alert('저장 완료', '이벤트 정보가 저장되었습니다.');
      await load();
    } catch (error: any) {
      const message = errorMessage(error, '이벤트 정보를 수정하지 못했습니다.');
      setFeedback(message);
      Alert.alert('저장 실패', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Event Settings</Text>
      <Text style={styles.title}>이벤트 정보 수정</Text>
      {feedback ? <View style={styles.messageBox}><Text style={styles.messageText}>{feedback}</Text></View> : null}
      <View style={styles.card}>
        <Text style={styles.label}>이벤트명</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>카테고리</Text>
        <View style={styles.categoryGrid}>
          {EVENT_CATEGORIES.map((item) => (
            <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
              <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>장소</Text>
        <TextInput style={styles.input} value={venue} onChangeText={setVenue} />
        <Text style={styles.label}>일시</Text>
        <TextInput style={styles.input} value={eventAt} onChangeText={setEventAt} placeholder="YYYY-MM-DDTHH:mm" />
        <Text style={styles.label}>설명</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline />
      </View>
      <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={save}>
        <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '저장'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  messageBox: { marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  messageText: { color: '#1D4ED8', fontWeight: '800' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { marginTop: 12, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});

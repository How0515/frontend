import React, { useCallback, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { config } from '../lib/config';
import type { EventDetail, EventRound } from '../types/api';

type RoundDraft = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  useGlobalSalePeriod: boolean;
  saleStartDate: string;
  saleEndDate: string;
};

type PosterAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const EVENT_CATEGORIES = [
  { value: 'CONCERT', label: '공연' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'EXHIBITION', label: '전시' },
  { value: 'FESTIVAL', label: '페스티벌' },
  { value: 'ETC', label: '기타' },
];

function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function dateFromIso(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return localDate(date);
}

function toStartOfDayIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}

function toEndOfDayIso(date: string) {
  return new Date(`${date}T23:59:00`).toISOString();
}

function roundStartIso(round: RoundDraft) {
  return new Date(`${round.eventDate}T${round.startTime}:00`).toISOString();
}

function roundEndIso(round: RoundDraft) {
  return new Date(`${round.eventDate}T${round.endTime}:00`).toISOString();
}

function posterFile(asset: PosterAsset) {
  const fallbackName = asset.uri.split('/').pop() || `event-poster-${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || 'image/jpeg',
  };
}

function imageSourceUri(value: string) {
  if (!value) return '';
  if (/^(https?:|file:|data:)/i.test(value)) return value;
  const apiRoot = config.apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  return `${apiRoot}${value.startsWith('/') ? '' : '/'}${value}`;
}

function defaultSaleEnd(rounds: RoundDraft[]) {
  const firstDate = [...rounds].sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]?.eventDate || localDate(new Date());
  return addDays(firstDate, -1);
}

function toRoundDraft(round: EventRound, index: number, saleStart: string, saleEnd: string): RoundDraft {
  return {
    id: round.id || `${Date.now()}-${index}`,
    title: round.title || `${index + 1}회차`,
    eventDate: round.eventDate,
    startTime: round.startTime,
    endTime: round.endTime,
    useGlobalSalePeriod: round.useGlobalSalePeriod,
    saleStartDate: dateFromIso(round.saleStartAt) || saleStart,
    saleEndDate: dateFromIso(round.saleEndAt) || saleEnd,
  };
}

function fallbackRound(event: EventDetail, saleStart: string, saleEnd: string): RoundDraft {
  const startsAt = event.eventStartAt || event.startsAt || event.eventAt || event.eventDateTime || new Date().toISOString();
  const endsAt = event.eventEndAt || event.endsAt || startsAt;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    id: 'fallback-1',
    title: '1회차',
    eventDate: localDate(start),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    useGlobalSalePeriod: true,
    saleStartDate: saleStart,
    saleEndDate: saleEnd,
  };
}

export default function EventSettingsPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const today = useMemo(() => localDate(new Date()), []);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [poster, setPoster] = useState<PosterAsset | null>(null);
  const [posterRemoved, setPosterRemoved] = useState(false);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [rounds, setRounds] = useState<RoundDraft[]>([]);
  const [expandedRoundIds, setExpandedRoundIds] = useState<string[]>([]);
  const [globalSaleStart, setGlobalSaleStart] = useState(today);
  const [globalSaleEnd, setGlobalSaleEnd] = useState(today);
  const [roundSaleOverrideEnabled, setRoundSaleOverrideEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await backendApi.getEvent(eventId);
      const saleStart = dateFromIso(detail.primarySaleStart || detail.salesStartAt) || today;
      const saleEnd = dateFromIso(detail.primarySaleEnd || detail.salesEndAt) || saleStart;
      const nextRounds = detail.rounds?.length
        ? detail.rounds.map((round, index) => toRoundDraft(round, index, saleStart, saleEnd))
        : [fallbackRound(detail, saleStart, saleEnd)];
      setEvent(detail);
      setName(detail.name || detail.title || '');
      setCategory(detail.category || 'CONCERT');
      setVenue(detail.venue || detail.location?.name || '');
      setDescription(detail.description || '');
      setImageUrl(detail.imageUrl || '');
      setPoster(null);
      setPosterRemoved(false);
      setPosterPreviewOpen(false);
      setRounds(nextRounds);
      setGlobalSaleStart(saleStart);
      setGlobalSaleEnd(saleEnd);
      setRoundSaleOverrideEnabled(nextRounds.some((round) => !round.useGlobalSalePeriod));
      setExpandedRoundIds([]);
      setErrors([]);
    } catch (error: any) {
      Alert.alert('이벤트 정보 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [eventId, today]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const posterPreviewUri = poster?.uri || (!posterRemoved ? imageSourceUri(imageUrl) : '');

  const pickPoster = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '포스터 이미지를 선택하려면 사진 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setPoster(result.assets[0]);
      setPosterRemoved(false);
    }
  };

  const updateRound = (id: string, patch: Partial<RoundDraft>) => {
    setRounds((current) => {
      const next = current.map((round) => (round.id === id ? { ...round, ...patch } : round));
      if (patch.eventDate) {
        const nextSaleEnd = defaultSaleEnd(next);
        setGlobalSaleEnd(nextSaleEnd);
        return next.map((round) => (
          !roundSaleOverrideEnabled || round.useGlobalSalePeriod
            ? { ...round, saleEndDate: nextSaleEnd }
            : round.id === id
              ? { ...round, saleEndDate: addDays(round.eventDate, -1) }
              : round
        ));
      }
      return next;
    });
  };

  const addRound = () => {
    setRounds((current) => {
      const nextDate = addDays(current.at(-1)?.eventDate || localDate(new Date()), 1);
      const next = {
        id: `${Date.now()}-${current.length}`,
        title: `${current.length + 1}회차`,
        eventDate: nextDate,
        startTime: '19:00',
        endTime: '21:00',
        useGlobalSalePeriod: !roundSaleOverrideEnabled,
        saleStartDate: globalSaleStart,
        saleEndDate: globalSaleEnd,
      };
      setExpandedRoundIds([next.id]);
      return [...current, next];
    });
  };

  const removeRound = (id: string) => {
    if (rounds.length <= 1) return;
    const index = rounds.findIndex((round) => round.id === id);
    Alert.alert('회차 삭제', `${index + 1}회차를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setRounds((current) => {
            const next = current.filter((round) => round.id !== id).map((round, nextIndex) => ({ ...round, title: `${nextIndex + 1}회차` }));
            const nextSaleEnd = defaultSaleEnd(next);
            setGlobalSaleEnd(nextSaleEnd);
            return next.map((round) => (!roundSaleOverrideEnabled || round.useGlobalSalePeriod ? { ...round, saleEndDate: nextSaleEnd } : round));
          });
          setExpandedRoundIds((current) => current.filter((item) => item !== id));
        },
      },
    ]);
  };

  const setRoundSaleOverride = (enabled: boolean) => {
    setRoundSaleOverrideEnabled(enabled);
    setRounds((current) => current.map((round) => ({
      ...round,
      useGlobalSalePeriod: !enabled,
      saleStartDate: enabled ? globalSaleStart : round.saleStartDate,
      saleEndDate: enabled ? globalSaleEnd : round.saleEndDate,
    })));
  };

  const validate = () => {
    const nextErrors: string[] = [];
    if (!name.trim()) nextErrors.push('이벤트명을 입력해주세요.');
    if (!venue.trim()) nextErrors.push('장소를 입력해주세요.');
    if (!description.trim()) nextErrors.push('이벤트 소개를 입력해주세요.');
    if (!globalSaleStart || !globalSaleEnd || globalSaleEnd <= globalSaleStart) nextErrors.push('티켓 판매 기간을 올바르게 선택해주세요.');
    rounds.forEach((round, index) => {
      if (!round.eventDate || !round.startTime || !round.endTime) nextErrors.push(`${index + 1}회차 일정을 입력해주세요.`);
      if (round.endTime <= round.startTime) nextErrors.push(`${index + 1}회차 종료 시간은 시작 시간보다 늦어야 합니다.`);
      const saleEnd = round.useGlobalSalePeriod ? globalSaleEnd : round.saleEndDate;
      if (saleEnd > round.eventDate) nextErrors.push(`${index + 1}회차 판매 종료일은 공연일 이후일 수 없습니다.`);
    });
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      setExpandedRoundIds(rounds.map((round) => round.id));
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!event || !validate()) return;
    const sortedRounds = [...rounds].sort((a, b) => roundStartIso(a).localeCompare(roundStartIso(b)));
    const firstRound = sortedRounds[0];
    const lastRound = [...sortedRounds].sort((a, b) => roundEndIso(b).localeCompare(roundEndIso(a)))[0];
    setSaving(true);
    try {
      await backendApi.updateEvent(event.id, {
        name: name.trim(),
        category,
        venue: venue.trim(),
        location: {
          name: venue.trim(),
          address: venue.trim(),
          placeId: event.venuePlaceId || event.location?.placeId || null,
          latitude: event.location?.latitude ?? null,
          longitude: event.location?.longitude ?? null,
        },
        venuePlaceId: event.venuePlaceId || event.location?.placeId || null,
        description: description.trim(),
        imageUrl: posterRemoved ? null : imageUrl.trim() || null,
        removeImage: posterRemoved,
        eventAt: roundStartIso(firstRound),
        eventStartAt: roundStartIso(firstRound),
        eventEndAt: roundEndIso(lastRound),
        startsAt: roundStartIso(firstRound),
        endsAt: roundEndIso(lastRound),
        primarySaleStart: toStartOfDayIso(globalSaleStart),
        primarySaleEnd: toEndOfDayIso(globalSaleEnd),
        salesStartAt: toStartOfDayIso(globalSaleStart),
        salesEndAt: toEndOfDayIso(globalSaleEnd),
        rounds: sortedRounds.map((round, index) => ({
          title: round.title || `${index + 1}회차`,
          eventDate: round.eventDate,
          startTime: round.startTime,
          endTime: round.endTime,
          useGlobalSalePeriod: round.useGlobalSalePeriod,
          saleStartAt: toStartOfDayIso(round.useGlobalSalePeriod ? globalSaleStart : round.saleStartDate),
          saleEndAt: toEndOfDayIso(round.useGlobalSalePeriod ? globalSaleEnd : round.saleEndDate),
        })),
      });
      if (poster) {
        await backendApi.uploadEventImage(event.id, posterFile(poster));
      }
      Alert.alert('저장 완료', '이벤트 정보가 수정되었습니다.');
      await load();
      navigation.navigate('OrganizerEventDetail', { eventId: event.id });
    } catch (error: any) {
      Alert.alert('저장 실패', errorMessage(error, '이벤트 정보를 수정하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Event Settings</Text>
        <Text style={styles.title}>이벤트 수정</Text>
        <Text style={styles.subtitle}>이벤트 정보, 공연 일정, 티켓 판매 기간을 수정합니다.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>기본 정보</Text>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && styles.activeCategoryChip]} onPress={() => setCategory(item.value)}>
                <Text style={[styles.categoryChipText, category === item.value && styles.activeCategoryChipText]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>이벤트명</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: TRUST LIVE 2026" />
          <Text style={styles.label}>장소</Text>
          <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="예: 올림픽공원 KSPO DOME" />
          <Text style={styles.label}>이벤트 소개</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline />
          <Text style={styles.label}>포스터</Text>
          {posterPreviewUri ? (
            <TouchableOpacity activeOpacity={0.88} onPress={() => setPosterPreviewOpen(true)}>
              <Image source={{ uri: posterPreviewUri }} style={styles.posterPreview} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.posterPlaceholder} activeOpacity={0.88} onPress={pickPoster}>
              <Text style={styles.posterPlaceholderText}>포스터 없음</Text>
            </TouchableOpacity>
          )}
          <View style={styles.posterActionRow}>
            <TouchableOpacity style={styles.posterButton} onPress={pickPoster}>
              <Text style={styles.posterButtonText}>{posterPreviewUri ? '다른 포스터 등록' : '포스터 등록'}</Text>
            </TouchableOpacity>
            {posterPreviewUri ? (
              <TouchableOpacity
                style={[styles.posterButton, styles.posterDeleteButton]}
                onPress={() => {
                  setPoster(null);
                  setPosterRemoved(true);
                  setImageUrl('');
                }}
              >
                <Text style={styles.posterDeleteText}>포스터 제거</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.helpText}>기존에 업로드한 포스터를 확인하거나 새 파일로 교체할 수 있습니다.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>공연 일정</Text>
          <Text style={styles.helpText}>공연 회차별로 날짜와 시간을 설정하세요.</Text>
          {rounds.map((round, index) => {
            const expanded = expandedRoundIds.includes(round.id);
            return (
              <View key={round.id} style={styles.roundBox}>
                <View style={styles.roundHeader}>
                  <TouchableOpacity style={styles.roundHeaderCopy} onPress={() => setExpandedRoundIds((current) => current.includes(round.id) ? current.filter((item) => item !== round.id) : [...current, round.id])}>
                    <Text style={styles.roundTitle}>{expanded ? '▼' : '▶'} {index + 1}회차 · {round.eventDate}</Text>
                    <Text style={styles.roundSummary}>{round.startTime} ~ {round.endTime}</Text>
                  </TouchableOpacity>
                  {rounds.length > 1 ? (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => removeRound(round.id)}>
                      <Text style={styles.deleteButtonText}>삭제</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {expanded ? (
                  <View style={styles.roundBody}>
                    <Text style={styles.label}>공연일</Text>
                    <TextInput style={styles.input} value={round.eventDate} onChangeText={(value) => updateRound(round.id, { eventDate: value })} placeholder="YYYY-MM-DD" />
                    <Text style={styles.label}>시작 시간</Text>
                    <TextInput style={styles.input} value={round.startTime} onChangeText={(value) => updateRound(round.id, { startTime: value })} placeholder="19:00" />
                    <Text style={styles.label}>종료 시간</Text>
                    <TextInput style={styles.input} value={round.endTime} onChangeText={(value) => updateRound(round.id, { endTime: value })} placeholder="21:00" />
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setExpandedRoundIds((current) => current.filter((item) => item !== round.id))}>
                      <Text style={styles.secondaryButtonText}>회차 저장</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
          <TouchableOpacity style={styles.addButton} onPress={addRound}>
            <Text style={styles.addButtonText}>+ 회차 추가</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>티켓 판매 기간</Text>
          <Text style={styles.saleRange}>{globalSaleStart} ~ {globalSaleEnd}</Text>
          {!roundSaleOverrideEnabled ? (
            <View style={styles.inlineGrid}>
              <TextInput style={[styles.input, styles.inlineInput]} value={globalSaleStart} onChangeText={setGlobalSaleStart} placeholder="판매 시작" />
              <TextInput style={[styles.input, styles.inlineInput]} value={globalSaleEnd} onChangeText={(value) => {
                setGlobalSaleEnd(value);
                setRounds((current) => current.map((round) => round.useGlobalSalePeriod ? { ...round, saleEndDate: value } : round));
              }} placeholder="판매 종료" />
            </View>
          ) : null}
          {!roundSaleOverrideEnabled ? <Text style={styles.helpText}>회차별 판매 기간을 설정하면 현재 판매 기간이 각 회차에 복사됩니다.</Text> : null}
          <TouchableOpacity style={styles.checkRow} onPress={() => setRoundSaleOverride(!roundSaleOverrideEnabled)}>
            <Text style={[styles.checkbox, roundSaleOverrideEnabled && styles.checkedBox]}>{roundSaleOverrideEnabled ? '✓' : ''}</Text>
            <Text style={styles.checkLabel}>회차별 판매 기간 설정</Text>
          </TouchableOpacity>
          {roundSaleOverrideEnabled ? rounds.map((round, index) => (
            <View key={round.id} style={styles.roundSaleRow}>
              <Text style={styles.roundSaleTitle}>{index + 1}회차</Text>
              <TextInput style={[styles.input, styles.roundSaleInput]} value={round.saleStartDate} onChangeText={(value) => updateRound(round.id, { saleStartDate: value, useGlobalSalePeriod: false })} />
              <Text style={styles.rangeDash}>~</Text>
              <TextInput style={[styles.input, styles.roundSaleInput]} value={round.saleEndDate} onChangeText={(value) => updateRound(round.id, { saleEndDate: value, useGlobalSalePeriod: false })} />
            </View>
          )) : null}
        </View>

        {errors.length > 0 ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>오류</Text>
            {errors.map((message) => <Text key={message} style={styles.errorItem}>· {message}</Text>)}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={save}>
          <Text style={styles.primaryButtonText}>{saving ? '저장 중...' : '수정 완료'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={posterPreviewOpen} transparent animationType="fade" onRequestClose={() => setPosterPreviewOpen(false)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPosterPreviewOpen(false)}>
          {posterPreviewUri ? <Image source={{ uri: posterPreviewUri }} style={styles.previewImage} resizeMode="contain" /> : null}
          <Text style={styles.previewClose}>닫기</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 112 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 3, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 6, color: '#64748B', fontSize: 13, lineHeight: 19 },
  card: { marginTop: 11, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  label: { marginTop: 9, marginBottom: 5, color: '#334155', fontSize: 13, fontWeight: '800' },
  helpText: { marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, backgroundColor: '#FFFFFF', color: '#0F172A' },
  textArea: { minHeight: 76, textAlignVertical: 'top' },
  posterPreview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: '#E2E8F0' },
  posterPlaceholder: { minHeight: 86, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  posterPlaceholderText: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  posterActionRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  posterButton: { flex: 1, borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: '#EFF6FF' },
  posterButtonText: { color: '#2563EB', fontWeight: '900', fontSize: 13 },
  posterDeleteButton: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  posterDeleteText: { color: '#B91C1C', fontWeight: '900', fontSize: 13 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryChip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  activeCategoryChip: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  categoryChipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  activeCategoryChipText: { color: '#2563EB' },
  roundBox: { marginTop: 9, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  roundHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundHeaderCopy: { flex: 1 },
  roundTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  roundSummary: { marginTop: 4, color: '#64748B', fontSize: 13, fontWeight: '800' },
  roundBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 10 },
  deleteButton: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF7F7' },
  deleteButtonText: { color: '#B91C1C', fontWeight: '800', fontSize: 12 },
  addButton: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 11, backgroundColor: '#EFF6FF' },
  addButtonText: { color: '#2563EB', fontSize: 15, fontWeight: '900' },
  secondaryButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingVertical: 11, backgroundColor: '#F8FAFC', alignItems: 'center' },
  secondaryButtonText: { color: '#0F172A', fontWeight: '900' },
  saleRange: { marginTop: 6, color: '#0F172A', fontSize: 15, fontWeight: '900' },
  inlineGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  inlineInput: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', color: '#FFFFFF', fontWeight: '900', lineHeight: 20 },
  checkedBox: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkLabel: { color: '#0F172A', fontWeight: '800' },
  roundSaleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  roundSaleTitle: { width: 45, color: '#0F172A', fontWeight: '900', fontSize: 12 },
  roundSaleInput: { flex: 1, paddingHorizontal: 8 },
  rangeDash: { color: '#64748B', fontWeight: '900' },
  errorPanel: { marginTop: 13, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12 },
  errorTitle: { color: '#B91C1C', fontWeight: '900', marginBottom: 6 },
  errorItem: { color: '#B91C1C', fontWeight: '800', lineHeight: 20 },
  bottomBar: { borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 14 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewImage: { width: '100%', height: '78%', borderRadius: 8 },
  previewClose: { marginTop: 16, color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});

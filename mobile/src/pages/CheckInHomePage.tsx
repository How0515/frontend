import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatCompactDateTime, getNextRoundTime } from '../lib/ticketDisplay';
import type { EventSummary, TicketDetail } from '../types/api';

type CheckInEvent = {
  event: EventSummary;
  tickets: TicketDetail[];
};

type RecentCheckInItem = {
  eventId: string;
  eventName: string;
  seatInfo: string;
  usedAt: string;
};

function eventTitle(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function checkInStatus(item: CheckInEvent, now = new Date()) {
  const start = getNextRoundTime(item.event, now);
  const end = new Date(item.event.eventEndAt || item.event.endsAt || item.event.eventAt || item.event.eventDateTime || '').getTime();
  const current = now.getTime();
  if (!Number.isNaN(end) && current > end) return { label: '종료', rank: 3 };
  if (!Number.isNaN(start)) {
    const diff = start - current;
    if (current >= start && (Number.isNaN(end) || current <= end)) return { label: '공연 중', rank: 3 };
    if (diff <= 60 * 60 * 1000 && diff >= -30 * 60 * 1000) return { label: '입장 진행중', rank: 0 };
    if (diff > 0 && diff <= 3 * 60 * 60 * 1000) return { label: '곧 시작', rank: 1 };
    const startDate = new Date(start);
    if (startDate.toDateString() === now.toDateString()) return { label: '오늘 예정', rank: 2 };
  }
  return { label: '체크인 예정', rank: 2 };
}

export default function CheckInHomePage({ navigation }: any) {
  const [items, setItems] = useState<CheckInEvent[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckInItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await backendApi.getMyEvents({ page: 0, size: 30 });
      const activeEvents = (page.items ?? []).filter((event) => event.status === 'PUBLISHED');
      const withTickets = await Promise.all(
        activeEvents.map(async (event) => ({
          event,
          tickets: await backendApi.getEventTickets(event.id).catch(() => [] as TicketDetail[]),
        })),
      );
      setItems(withTickets);

      const flattened = withTickets
        .flatMap((item) =>
          item.tickets
            .filter((ticket) => ticket.status === 'USED' && ticket.usedAt)
            .map((ticket) => ({
              eventId: item.event.id,
              eventName: eventTitle(item.event),
              seatInfo: ticket.seatInfo || '-',
              usedAt: String(ticket.usedAt),
            })),
        )
        .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
        .slice(0, 8);

      setRecentCheckIns(flattened);
    } catch (error: any) {
      Alert.alert('체크인 홈 로드 실패', errorMessage(error, '체크인 운영 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sortedEvents = useMemo(() => {
    return [...items].sort((a, b) => {
      const aStatus = checkInStatus(a);
      const bStatus = checkInStatus(b);
      if (aStatus.rank !== bStatus.rank) return aStatus.rank - bStatus.rank;
      const aTime = getNextRoundTime(a.event);
      const bTime = getNextRoundTime(b.event);
      return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
    });
  }, [items]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>체크인 운영 화면을 준비하고 있습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Check-in Operations</Text>
      <Text style={styles.title}>체크인</Text>
      <Text style={styles.subtitle}>입장 처리가 필요한 이벤트를 빠르게 확인하고 체크인을 진행합니다.</Text>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>입장 운영 이벤트</Text>
          <Text style={styles.sectionHint}>{sortedEvents.length}건</Text>
        </View>
        {sortedEvents.length === 0 ? (
          <Text style={styles.emptyText}>체크인할 이벤트가 없습니다.</Text>
        ) : (
          sortedEvents.map((item) => {
            const status = checkInStatus(item);
            const startTime = getNextRoundTime(item.event);
            const used = item.tickets.filter((ticket) => ticket.status === 'USED').length;
            return (
              <View key={item.event.id} style={styles.eventCard}>
                <View style={styles.eventInfo}>
                  <View style={styles.cardTop}>
                    <Text style={styles.eventTitle}>{eventTitle(item.event)}</Text>
                    <Text style={styles.badge}>{status.label}</Text>
                  </View>
                  <Text style={styles.eventMeta}>시작 시간 {Number.isNaN(startTime) ? '-' : formatCompactDateTime(new Date(startTime).toISOString())}</Text>
                  <Text style={styles.eventMeta}>입장 {used} / {item.tickets.length}</Text>
                </View>
                <View style={styles.eventActions}>
                  <TouchableOpacity style={styles.primaryActionButton} onPress={() => navigation.navigate('CheckInManage', { eventId: item.event.id })}>
                    <Text style={styles.primaryActionText}>입장 처리</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={() => navigation.navigate('CheckInStatus', { eventId: item.event.id })}>
                    <Text style={styles.secondaryActionText}>체크인 현황</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 입장 처리</Text>
          <Text style={styles.sectionHint}>{recentCheckIns.length}건</Text>
        </View>
        {recentCheckIns.length === 0 ? (
          <Text style={styles.emptyText}>최근 입장 처리 기록이 없습니다.</Text>
        ) : (
          recentCheckIns.map((item, index) => (
            <TouchableOpacity key={`${item.eventId}-${item.seatInfo}-${index}`} style={styles.checkInRow} onPress={() => navigation.navigate('CheckInStatus', { eventId: item.eventId })}>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{item.eventName}</Text>
                <Text style={styles.eventMeta}>좌석 {item.seatInfo}</Text>
                <Text style={styles.eventMeta}>처리 시각 {formatCompactDateTime(item.usedAt)}</Text>
              </View>
              <Text style={styles.linkText}>기록 보기</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHint: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
  eventCard: { marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF', gap: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  checkInRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  eventInfo: { flex: 1 },
  eventTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14, flex: 1 },
  eventMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  eventActions: { flexDirection: 'row', gap: 8 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, minWidth: 74, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  primaryActionButton: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#2563EB' },
  primaryActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  secondaryActionButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFFFFF' },
  secondaryActionText: { color: '#0F172A', fontWeight: '900', fontSize: 13 },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
});

import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatNextRoundLabel, getSalesDisplayStatus, getNextRoundTime, salesSortRank, weiToEth } from '../lib/ticketDisplay';
import type { EventDetail, EventSummary, TicketDetail } from '../types/api';

function eventTitle(event: EventSummary | EventDetail) {
  return event.name || event.title || '이벤트';
}

function sectionOf(ticket: TicketDetail) {
  return ticket.sectionName || String(ticket.seatInfo || '').split(/[-\s]/)[0] || 'GENERAL';
}

function sectionStats(tickets: TicketDetail[]) {
  const map = new Map<string, { total: number; sold: number }>();
  tickets.forEach((ticket) => {
    const key = sectionOf(ticket);
    const current = map.get(key) ?? { total: 0, sold: 0 };
    current.total += 1;
    if (['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())) current.sold += 1;
    map.set(key, current);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko-KR', { numeric: true }));
}

export default function SalesStatusPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string | undefined;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!eventId) {
        const page = await backendApi.getMyEvents({ page: 0, size: 50 });
        const myEvents = (page.items ?? [])
          .filter((item) => String(item.status).toUpperCase() !== 'CANCELLED')
          .sort((a, b) => {
            const rankDiff = salesSortRank(a) - salesSortRank(b);
            if (rankDiff !== 0) return rankDiff;
            const aTime = getNextRoundTime(a);
            const bTime = getNextRoundTime(b);
            return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
          });
        setEvents(myEvents);
        setEvent(null);
        setTickets([]);
      } else {
        const [detail, list] = await Promise.all([
          backendApi.getEvent(eventId),
          backendApi.getEventTickets(eventId).catch(() => []),
        ]);
        setEvent(detail);
        setTickets(list);
        setEvents([]);
      }
    } catch (error: any) {
      Alert.alert('티켓 판매 현황 로드 실패', errorMessage(error, '티켓 판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(String(ticket.status).toUpperCase())).length;
  const used = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'USED').length;
  const available = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'AVAILABLE').length;
  const listed = tickets.filter((ticket) => String(ticket.status).toUpperCase() === 'LISTED').length;
  const stats = useMemo(() => sectionStats(tickets), [tickets]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!eventId) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={styles.eyebrow}>Ticket Operations</Text>
        <Text style={styles.title}>티켓 판매 현황</Text>
        <Text style={styles.subtitle}>이벤트별 판매 상태와 좌석 현황을 관리합니다.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>운영중 판매 이벤트</Text>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>운영할 판매 이벤트가 없습니다.</Text>
          ) : (
            events.map((item) => {
              const status = getSalesDisplayStatus(item);
              return (
                <TouchableOpacity key={item.id} style={styles.selectionCard} onPress={() => navigation.navigate('SalesStatus', { eventId: item.id })}>
                  <View style={styles.selectionHeader}>
                    <Text style={styles.rowTitle}>{eventTitle(item)}</Text>
                    <Text style={[styles.badge, styles[`tone_${status.tone}`]]}>{status.label}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{formatNextRoundLabel(item)}</Text>
                  <Text style={styles.rowMeta}>남은 좌석 {item.remainingTicketCount ?? 0}장</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>Sales Dashboard</Text>
      <Text style={styles.title}>티켓 판매 현황</Text>
      <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'} · {weiToEth(event?.ticketPriceWei)}</Text>
      <View style={styles.metricGrid}>
        <Metric label="판매" value={sold} />
        <Metric label="남은 좌석" value={available} />
        <Metric label="리셀 중" value={listed} />
        <Metric label="체크인" value={used} />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>좌석 구역별 판매 현황</Text>
          <TouchableOpacity onPress={() => navigation?.navigate?.('TicketExplore', { eventId })}>
            <Text style={styles.linkText}>전체 티켓 탐색</Text>
          </TouchableOpacity>
        </View>
        {stats.length === 0 ? (
          <Text style={styles.emptyText}>발행된 티켓이 없습니다.</Text>
        ) : (
          stats.map(([section, item]) => (
            <View key={section} style={styles.sectionRow}>
              <View style={styles.sectionInfo}>
                <Text style={styles.rowTitle}>{section}</Text>
                <Text style={styles.rowMeta}>판매 {item.sold} / {item.total}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${item.total > 0 ? Math.round((item.sold / item.total) * 100) : 0}%` }]} />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metricCard}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 22, fontWeight: '900' },
  card: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  sectionHead: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  linkText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  selectionCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 13, backgroundColor: '#FFFFFF', marginTop: 10 },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 5, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, minWidth: 62, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 24, textAlign: 'center' },
  sectionRow: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  sectionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { marginTop: 9, height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: '#2563EB' },
  tone_neutral: { backgroundColor: '#F1F5F9', color: '#475569' },
  tone_blue: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  tone_green: { backgroundColor: '#DCFCE7', color: '#15803D' },
  tone_yellow: { backgroundColor: '#FEF3C7', color: '#A16207' },
  tone_red: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  tone_gray: { backgroundColor: '#E2E8F0', color: '#475569' },
});

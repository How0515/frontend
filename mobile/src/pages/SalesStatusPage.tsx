import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

function weiToEth(wei?: string) {
  if (!wei) return '-';
  const value = BigInt(wei);
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = String(value % 1_000_000_000_000_000_000n).padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
}

export default function SalesStatusPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      const [detail, list] = await Promise.all([
        backendApi.getEvent(eventId),
        backendApi.getEventTickets(eventId).catch(() => []),
      ]);
      setEvent(detail);
      setTickets(list);
      setPage(0);
    } catch (error: any) {
      Alert.alert('판매 현황 로드 실패', errorMessage(error, '판매 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const sold = tickets.filter((ticket) => ['SOLD', 'LISTED', 'USED'].includes(ticket.status)).length;
  const used = tickets.filter((ticket) => ticket.status === 'USED').length;
  const available = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;
  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const pagedTickets = useMemo(() => tickets.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [page, tickets]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={pagedTickets}
      keyExtractor={ticketId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>Sales Status</Text>
          <Text style={styles.title}>판매 현황</Text>
          <Text style={styles.subtitle}>{event?.name || event?.title || '이벤트'} · {weiToEth(event?.ticketPriceWei)}</Text>
          <View style={styles.metricGrid}>
            <Metric label="판매" value={sold} />
            <Metric label="잔여" value={available} />
            <Metric label="입장" value={used} />
          </View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>티켓별 상태</Text>
            <Text style={styles.pageText}>{page + 1} / {totalPages}</Text>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{item.seatInfo || '-'}</Text>
            <Text style={styles.rowMeta}>{item.ownerWalletAddress || item.ownerAddress || '미판매'}</Text>
          </View>
          <Text style={styles.badge}>{formatTicketStatus(item.status)}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>발행된 티켓이 없습니다.</Text>}
      ListFooterComponent={
        tickets.length > PAGE_SIZE ? (
          <View style={styles.pagination}>
            <TouchableOpacity style={[styles.pageButton, page === 0 && styles.disabledButton]} disabled={page === 0} onPress={() => setPage((value) => Math.max(value - 1, 0))}>
              <Text style={styles.pageButtonText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pageButton, page >= totalPages - 1 && styles.disabledButton]} disabled={page >= totalPages - 1} onPress={() => setPage((value) => Math.min(value + 1, totalPages - 1))}>
              <Text style={styles.pageButtonText}>다음</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
    />
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
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  sectionHead: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowInfo: { flex: 1, paddingRight: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
});

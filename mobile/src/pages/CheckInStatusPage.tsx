import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate } from '../lib/ticketDisplay';
import type { CheckInRecord, TicketDetail } from '../types/api';

const PAGE_SIZE = 20;

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

function resultLabel(record: CheckInRecord) {
  const value = String(record.result ?? record.status ?? '').toUpperCase();
  if (value === 'SUCCESS') return '입장 완료';
  if (value === 'FAILED') return '입장 실패';
  return value || '확인 필요';
}

export default function CheckInStatusPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);
      const histories = await Promise.all(eventTickets.map((ticket) => backendApi.getTicketCheckIns(ticketId(ticket)).catch(() => [])));
      setTickets(eventTickets);
      setRecords(histories.flat());
      setPage(0);
    } catch (error: any) {
      Alert.alert('체크인 현황 로드 실패', errorMessage(error, '체크인 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const used = tickets.filter((ticket) => ticket.status === 'USED').length;
  const success = records.filter((record) => record.result === 'SUCCESS' || record.status === 'SUCCESS').length;
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pagedRecords = useMemo(() => records.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [page, records]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={pagedRecords}
      keyExtractor={(item, index) => String(item.id ?? `${item.ticketId}-${item.checkedInAt}-${index}`)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>Check-in Status</Text>
          <Text style={styles.title}>체크인 현황</Text>
          <View style={styles.metricGrid}>
            <Metric label="입장 완료" value={used} />
            <Metric label="성공 기록" value={success} />
            <Metric label="전체 시도" value={records.length} />
          </View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>체크인 기록</Text>
            <Text style={styles.pageText}>{page + 1} / {totalPages}</Text>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{resultLabel(item)}</Text>
          <Text style={styles.rowMeta}>{formatEventDate(item.checkedInAt || item.createdAt)} · 티켓 {item.ticketId}</Text>
          {item.memo ? <Text style={styles.rowMemo}>{item.memo}</Text> : null}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>체크인 기록이 없습니다.</Text>}
      ListFooterComponent={
        records.length > PAGE_SIZE ? (
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
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  sectionHead: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  rowMemo: { marginTop: 8, color: '#334155', fontSize: 13, lineHeight: 18 },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
});

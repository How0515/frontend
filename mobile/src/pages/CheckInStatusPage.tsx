import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import type { CheckInRecord, TicketDetail } from '../types/api';

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function ticketId(ticket: TicketDetail) {
  return String(ticket.id ?? ticket.ticketId ?? '');
}

export default function CheckInStatusPage({ route }: any) {
  const eventId = route?.params?.eventId as string;
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);
      const histories = await Promise.all(eventTickets.map((ticket) => backendApi.getTicketCheckIns(ticketId(ticket)).catch(() => [])));
      setTickets(eventTickets);
      setRecords(histories.flat());
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={records}
      keyExtractor={(item, index) => String(item.id ?? `${item.ticketId}-${item.checkedInAt}-${index}`)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>Check-in Status</Text>
          <Text style={styles.title}>체크인 현황</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}><Text style={styles.metricLabel}>입장 완료</Text><Text style={styles.metricValue}>{used}</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricLabel}>성공 기록</Text><Text style={styles.metricValue}>{success}</Text></View>
            <View style={styles.metricCard}><Text style={styles.metricLabel}>전체 시도</Text><Text style={styles.metricValue}>{records.length}</Text></View>
          </View>
          <Text style={styles.sectionTitle}>체크인 기록</Text>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{item.result ?? item.status ?? 'UNKNOWN'}</Text>
          <Text style={styles.rowMeta}>{formatDate(item.checkedInAt || item.createdAt)} · {item.ticketId}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>체크인 기록이 없습니다.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A' },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  sectionTitle: { marginTop: 18, marginBottom: 8, color: '#0F172A', fontSize: 17, fontWeight: '900' },
  row: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  rowTitle: { color: '#0F172A', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  emptyText: { color: '#94A3B8', paddingVertical: 48, textAlign: 'center' },
});

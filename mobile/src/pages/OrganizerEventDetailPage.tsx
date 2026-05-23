import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';
import { formatEventDate, formatTicketStatus } from '../lib/ticketDisplay';
import type { EventDetail, TicketDetail } from '../types/api';

const PAGE_SIZE = 8;

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

export default function OrganizerEventDetailPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tickets, setTickets] = useState<TicketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ticketPage, setTicketPage] = useState(0);

  const soldTickets = tickets.filter((ticket) => ticket.status === 'SOLD' || ticket.status === 'LISTED' || ticket.status === 'USED').length;
  const usedTickets = tickets.filter((ticket) => ticket.status === 'USED').length;
  const availableTickets = tickets.filter((ticket) => ticket.status === 'AVAILABLE').length;
  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const pagedTickets = useMemo(() => tickets.slice(ticketPage * PAGE_SIZE, ticketPage * PAGE_SIZE + PAGE_SIZE), [ticketPage, tickets]);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('이벤트 관리 불가', statusMessage);
        navigation.goBack();
        return;
      }

      const detail = await backendApi.getEvent(eventId);
      const eventTickets = await backendApi.getEventTickets(eventId).catch(() => []);

      setEvent(detail);
      setTickets(eventTickets);
      setTicketPage(0);
    } catch (error: any) {
      Alert.alert('이벤트 로드 실패', errorMessage(error, '이벤트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const changeStatus = async (status: string) => {
    if (!event) return;
    setSaving(true);
    try {
      await backendApi.updateEventStatus(event.id, { status });
      await load();
    } catch (error: any) {
      Alert.alert('상태 변경 실패', errorMessage(error, '상태를 변경하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const cancelEvent = () => {
    if (!event || event.status === 'CANCELED') return;
    const message = '이 이벤트를 취소 처리하시겠습니까? 취소된 이벤트는 목록에는 남고 상태가 취소로 변경됩니다.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void changeStatus('CANCELED');
      return;
    }

    Alert.alert('이벤트 취소', message, [
      { text: '아니요', style: 'cancel' },
      { text: '취소 처리', style: 'destructive', onPress: () => void changeStatus('CANCELED') },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>이벤트 운영 정보를 불러오고 있습니다.</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>이벤트를 찾지 못했습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.eyebrow}>Event Operations</Text>
      <Text style={styles.title}>{event.name || event.title || '이벤트 운영'}</Text>
      <Text style={styles.subtitle}>{event.venue} · {formatEventDate(event.eventAt || event.eventDateTime)}</Text>

      <View style={styles.metricGrid}>
        <Metric label="발행" value={tickets.length} />
        <Metric label="판매" value={soldTickets} />
        <Metric label="체크인" value={usedTickets} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TicketIssue', { eventId: event.id })}>
          <Text style={styles.primaryButtonText}>티켓 추가 발행</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => changeStatus(event.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} disabled={saving}>
          <Text style={styles.secondaryButtonText}>{event.status === 'ACTIVE' ? '이벤트 비활성화' : '이벤트 활성화'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={cancelEvent} disabled={saving || event.status === 'CANCELED'}>
          <Text style={styles.dangerButtonText}>{event.status === 'CANCELED' ? '취소된 이벤트' : '이벤트 취소'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>운영 메뉴</Text>
        <MenuCard
          title="판매 현황"
          text={`판매 ${soldTickets} · 잔여 ${availableTickets} · 가격 ${weiToEth(event.ticketPriceWei)}`}
          onPress={() => navigation.navigate('SalesStatus', { eventId: event.id })}
        />
        <MenuCard
          title="체크인 현황"
          text={`입장 처리 ${usedTickets}건 · 전체 발행 ${tickets.length}장`}
          onPress={() => navigation.navigate('CheckInStatus', { eventId: event.id })}
        />
        <MenuCard
          title="이벤트 설정"
          text="기본 정보, 리셀 정책, 이벤트 상태를 관리합니다."
          onPress={() => navigation.navigate('EventSettings', { eventId: event.id })}
        />
        <MenuCard
          title="체크인 관리"
          text="QR 스캔으로 입장 처리하고 검증자를 관리합니다."
          onPress={() => navigation.navigate('CheckInManage', { eventId: event.id })}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <Text style={styles.cardTitle}>최근 티켓</Text>
          <Text style={styles.pageText}>{ticketPage + 1} / {totalPages}</Text>
        </View>
        {tickets.length === 0 ? <Text style={styles.emptyText}>아직 발행된 티켓이 없습니다.</Text> : pagedTickets.map((ticket) => (
          <View key={ticketId(ticket)} style={styles.ticketRow}>
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketTitle}>{ticket.seatInfo || '-'}</Text>
              <Text style={styles.ticketMeta}>{ticket.ownerWalletAddress || ticket.ownerAddress || '미판매'}</Text>
            </View>
            <Text style={styles.badge}>{formatTicketStatus(ticket.status)}</Text>
          </View>
        ))}
        {tickets.length > PAGE_SIZE ? (
          <View style={styles.pagination}>
            <TouchableOpacity style={[styles.pageButton, ticketPage === 0 && styles.disabledButton]} disabled={ticketPage === 0} onPress={() => setTicketPage((page) => Math.max(page - 1, 0))}>
              <Text style={styles.pageButtonText}>이전</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pageButton, ticketPage >= totalPages - 1 && styles.disabledButton]} disabled={ticketPage >= totalPages - 1} onPress={() => setTicketPage((page) => Math.min(page + 1, totalPages - 1))}>
              <Text style={styles.pageButtonText}>다음</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MenuCard({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuText}>{text}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 18, paddingBottom: 96 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#F4F7FB' },
  loadingText: { marginTop: 12, color: '#64748B' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  title: { marginTop: 4, fontSize: 26, fontWeight: '900', color: '#0F172A' },
  subtitle: { marginTop: 8, color: '#64748B', fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  metricValue: { marginTop: 8, color: '#0F172A', fontSize: 24, fontWeight: '900' },
  actions: { marginTop: 6 },
  card: { marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  menuButton: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingVertical: 14 },
  menuCopy: { flex: 1, paddingRight: 12 },
  menuTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  menuText: { marginTop: 4, color: '#64748B', fontSize: 12, lineHeight: 18 },
  chevron: { color: '#94A3B8', fontSize: 26, fontWeight: '300' },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  dangerButton: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  dangerButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ticketInfo: { flex: 1, paddingRight: 10 },
  ticketTitle: { color: '#0F172A', fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#E0F2FE', color: '#0369A1', paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  pagination: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pageButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  pageButtonText: { color: '#0F172A', fontWeight: '900' },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
});

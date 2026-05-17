import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function LandingPage({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Trust Ticket</Text>
        <Text style={styles.title}>블록체인 티켓 예매</Text>
        <Text style={styles.subtitle}>
          사용자는 티켓을 예매하고, 주최자는 이벤트를 등록하고 운영합니다.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.userButton]}
          onPress={() => navigation.navigate('Auth', { initialRole: 'USER' })}
        >
          <Text style={styles.buttonText}>사용자로 시작하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.organizerButton]}
          onPress={() => navigation.navigate('Auth', { initialRole: 'ORGANIZER' })}
        >
          <Text style={styles.buttonTextDark}>주최자로 시작하기</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>로그인 후 권한에 따라 알맞은 화면으로 이동합니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 22, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 52 },
  logo: { fontSize: 18, fontWeight: '900', color: '#2563EB', letterSpacing: 0.6 },
  title: { marginTop: 14, fontSize: 34, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  subtitle: { marginTop: 12, fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  buttonContainer: { gap: 13 },
  button: { padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  userButton: { backgroundColor: '#2563EB' },
  organizerButton: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  buttonTextDark: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  footerText: { textAlign: 'center', marginTop: 34, color: '#94A3B8', fontSize: 13 },
});

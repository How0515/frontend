import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function OrganizerDashboardPage({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>주최자 대시보드</Text>
      <Text style={styles.description}>이벤트 등록, 티켓 발행, 체크인 관리를 한 곳에서 수행합니다.</Text>
      
      <TouchableOpacity style={styles.buttonPrimary} onPress={() => navigation.navigate('EventCreate')}>
        <Text style={styles.buttonText}>이벤트 등록</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MyEvents')}>
        <Text style={styles.buttonTextDark}>내 이벤트</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MyPage')}>
        <Text style={styles.buttonTextDark}>내 정보</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextDark: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

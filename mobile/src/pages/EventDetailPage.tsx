import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { backendApi } from '../lib/backend';
import type { EventDetail } from '../types/api';

export default function EventDetailPage({ route, navigation }: any) {
  const { eventId } = route.params;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const data = await backendApi.getEvent(eventId);
      setEvent(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    // In a real app, you'd show a list of available tickets first.
    // For now, mirroring the web logic of asking for a ticket ID (simplified).
    Alert.prompt(
      'Ticket Purchase',
      'Please enter the Ticket ID',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Purchase',
          onPress: async (ticketId) => {
            if (!ticketId) return;
            try {
              await backendApi.purchasePrimary(ticketId);
              Alert.alert('Success', 'Primary purchase request sent.');
            } catch (error: any) {
              Alert.alert('Purchase Failed', error.message || 'Unknown error');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text>Event not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.venue}>{event.venue}</Text>
        <Text style={styles.date}>
          {new Date(event.eventDateTime).toLocaleString()}
        </Text>
        <Text style={styles.description}>{event.description}</Text>
        
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>이벤트 정보</Text>
          <Text>Category: {event.category}</Text>
          <Text>Status: {event.status}</Text>
        </View>

        <TouchableOpacity style={styles.purchaseButton} onPress={handlePurchase}>
          <Text style={styles.purchaseButtonText}>티켓 구매하기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  venue: {
    fontSize: 18,
    color: '#444',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },
  detailsContainer: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

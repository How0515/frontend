import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginPage from './src/pages/LoginPage';
import UserHomePage from './src/pages/UserHomePage';
import EventDetailPage from './src/pages/EventDetailPage';
import ResaleListPage from './src/pages/ResaleListPage';
import MyPage from './src/pages/MyPage';
import MyTicketsPage from './src/pages/MyTicketsPage';
import OrganizerDashboardPage from './src/pages/OrganizerDashboardPage';
import EventCreatePage from './src/pages/EventCreatePage';
import MyEventsPage from './src/pages/MyEventsPage';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginPage} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={UserHomePage} options={{ title: 'Trust Ticket' }} />
        <Stack.Screen name="Organizer" component={OrganizerDashboardPage} options={{ title: '주최자 대시보드' }} />
        <Stack.Screen name="EventDetail" component={EventDetailPage} options={{ title: '이벤트 상세' }} />
        <Stack.Screen name="ResaleList" component={ResaleListPage} options={{ title: '리셀 목록' }} />
        <Stack.Screen name="MyPage" component={MyPage} options={{ title: '내 정보' }} />
        <Stack.Screen name="MyTickets" component={MyTicketsPage} options={{ title: '내 티켓' }} />
        <Stack.Screen name="EventCreate" component={EventCreatePage} options={{ title: '이벤트 등록' }} />
        <Stack.Screen name="MyEvents" component={MyEventsPage} options={{ title: '내 이벤트' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

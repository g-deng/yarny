import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { UserProvider, useUser } from '@/hooks/use-user';
import { BrutalColors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading } = useUser();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BrutalColors.background }}>
        <ActivityIndicator size="large" color={BrutalColors.outline} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user/[id]/index" />
        <Stack.Screen name="user/[id]/followers" />
        <Stack.Screen name="user/[id]/following" />
        <Stack.Screen name="edit-profile" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Montserrat-Regular': require('@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf'),
    'Montserrat-SemiBold': require('@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf'),
    'Montserrat-Bold': require('@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf'),
    'Montserrat-ExtraBold': require('@expo-google-fonts/montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf'),
  });

  useEffect(() => {
    // Hide splash once fonts load OR fail — don't block the app
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Render app even if fonts fail to load — fall back to system fonts
  if (!fontsLoaded && !fontError) return null;

  return (
    <UserProvider>
      <RootNavigator />
    </UserProvider>
  );
}

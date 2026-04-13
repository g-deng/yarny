import { Redirect } from 'expo-router';
import { useUser } from '@/hooks/use-user';
import { View, ActivityIndicator } from 'react-native';
import { YarnyColors } from '@/constants/theme';

export default function Index() {
  const { userId, loading } = useUser();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: YarnyColors.background }}>
        <ActivityIndicator size="large" color={YarnyColors.button} />
      </View>
    );
  }

  return userId ? <Redirect href="/(tabs)" /> : <Redirect href="/welcome" />;
}

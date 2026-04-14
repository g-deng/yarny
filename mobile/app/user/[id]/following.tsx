import { useLocalSearchParams } from 'expo-router';
import { getFollowing } from '@/services/api';
import { UserListScreen } from '@/components/user-list-screen';

export default function FollowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserListScreen title="Following" fetcher={() => getFollowing(id!)} />;
}

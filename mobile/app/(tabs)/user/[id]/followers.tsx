import { useLocalSearchParams } from 'expo-router';
import { getFollowers } from '@/services/api';
import { UserListScreen } from '@/components/user-list-screen';

export default function FollowersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserListScreen title="Followers" fetcher={() => getFollowers(id!)} />;
}

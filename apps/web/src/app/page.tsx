import { HomeScreen } from '@/features/home/home-screen';
import { PublicHome } from '@/features/home/public-home';

export default function HomePage() {
  return <HomeScreen publicHome={<PublicHome />} />;
}

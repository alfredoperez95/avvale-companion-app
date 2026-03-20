import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';

export default function MainLoading() {
  return <LoadingScreen message="Cargando módulos..." fullPage={false} />;
}

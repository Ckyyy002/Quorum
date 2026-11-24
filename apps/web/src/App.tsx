import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<{ status: string }>('/health')).data,
  });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Quorum</h1>
      <p className="mt-2 text-muted-foreground">
        API: {health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.status}
      </p>
    </main>
  );
}

export default HomePage;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { ApiError } from './api/client';
import { Dashboard } from './dashboard/Dashboard';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      // Client errors (404, 400) will not fix themselves; retry only network/server failures.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>,
);

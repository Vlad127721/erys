import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { WidgetMeta, WidgetType } from '@youscan/shared';
import { widgetsApi } from './api';

export const widgetKeys = {
  list: ['widgets'] as const,
  data: (id: string) => ['widgets', id, 'data'] as const,
};

/** Dashboard layout: widget metadata only. */
export function useWidgetList() {
  return useQuery({ queryKey: widgetKeys.list, queryFn: widgetsApi.list });
}

/** Each widget loads its own data, so it loads, fails and retries independently. */
export function useWidgetData(id: string) {
  return useQuery({
    queryKey: widgetKeys.data(id),
    queryFn: ({ signal }) => widgetsApi.getData(id, signal),
  });
}

const updateList = (client: QueryClient, update: (list: WidgetMeta[]) => WidgetMeta[]) =>
  client.setQueryData<WidgetMeta[]>(widgetKeys.list, (list) => list && update(list));

export function useCreateWidget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (type: WidgetType) => widgetsApi.create({ type }),
    onSuccess: (widget) => updateList(client, (list) => [...list, widget]),
  });
}

export function useDeleteWidget(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => widgetsApi.remove(id),
    onSuccess: () => {
      updateList(client, (list) => list.filter((w) => w.id !== id));
      client.removeQueries({ queryKey: widgetKeys.data(id) });
    },
  });
}

export function useUpdateText(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => widgetsApi.updateText(id, text),
    onSuccess: (widget, text) => {
      client.setQueryData(widgetKeys.data(id), { id, type: 'TEXT', data: { text } });
      updateList(client, (list) => list.map((w) => (w.id === id ? widget : w)));
    },
  });
}

import {
  widgetDataResponseSchema,
  widgetMetaSchema,
  type CreateWidgetRequest,
  type WidgetDataResponse,
  type WidgetMeta,
} from '@youscan/shared';
import { request, send } from '../api/client';

const widgetListSchema = widgetMetaSchema.array();

export const widgetsApi = {
  list: (): Promise<WidgetMeta[]> => request('/widgets', widgetListSchema),

  getData: (id: string, signal?: AbortSignal): Promise<WidgetDataResponse> =>
    request(`/widgets/${id}/data`, widgetDataResponseSchema, { signal }),

  create: (body: CreateWidgetRequest): Promise<WidgetMeta> =>
    request('/widgets', widgetMetaSchema, { method: 'POST', body: JSON.stringify(body) }),

  updateText: (id: string, text: string): Promise<WidgetMeta> =>
    request(`/widgets/${id}/text`, widgetMetaSchema, { method: 'PUT', body: JSON.stringify({ text }) }),

  remove: async (id: string): Promise<void> => {
    await send(`/widgets/${id}`, { method: 'DELETE' });
  },
};

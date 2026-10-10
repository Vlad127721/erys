import { assertNever, widgetPayloadSchema, type WidgetMeta, type WidgetPayload } from '@youscan/shared';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

/** Stored JSON does not match the schema for the widget's type. */
export class CorruptedWidgetDataError extends Error {
  constructor(
    readonly widgetId: string,
    readonly issues: unknown,
  ) {
    super(`Widget ${widgetId} has invalid data`);
    this.name = 'CorruptedWidgetDataError';
  }
}

export interface NewWidget {
  title: string;
  payload: WidgetPayload;
  /** Logical import source; widgets with the same key are never duplicated. */
  sourceKey?: string;
}

/** What to do with a keyed widget whose `sourceKey` already exists. */
export type OnExistingSource = 'skip' | 'replace';

export interface SavedWidget {
  id: string;
  title: string;
  status: 'created' | 'replaced' | 'skipped';
}

const metaSelect = { id: true, type: true, title: true, updatedAt: true } as const;

type MetaRow = Prisma.WidgetGetPayload<{ select: typeof metaSelect }>;

const toMeta = (row: MetaRow): WidgetMeta => ({ ...row, updatedAt: row.updatedAt.toISOString() });

/**
 * The only place that touches the `widgets` table. `data` is JSON in the database, so it is
 * validated against the shared schema on the way in and on the way out.
 */
export class WidgetsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<WidgetMeta[]> {
    const rows = await this.prisma.widget.findMany({
      select: metaSelect,
      // Creation order; the id only breaks ties between widgets created in the same millisecond.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toMeta);
  }

  async findMeta(id: string): Promise<WidgetMeta | null> {
    const row = await this.prisma.widget.findUnique({ where: { id }, select: metaSelect });
    return row && toMeta(row);
  }

  /** @throws CorruptedWidgetDataError if the stored data does not match the widget type. */
  async findPayload(id: string): Promise<WidgetPayload | null> {
    const row = await this.prisma.widget.findUnique({ where: { id }, select: { type: true, data: true } });
    if (!row) return null;
    const result = widgetPayloadSchema.safeParse(row);
    if (!result.success) throw new CorruptedWidgetDataError(id, result.error.issues);
    return result.data;
  }

  /**
   * Adds one widget (it appears last on the dashboard) and returns its metadata. Widgets created
   * this way never have an import source; imports go through `saveMany`.
   */
  async create({ title, payload }: Omit<NewWidget, 'sourceKey'>): Promise<WidgetMeta> {
    const { type, data } = widgetPayloadSchema.parse(payload);
    const row = await this.prisma.widget.create({
      data: { type, title, data: data },
      select: metaSelect,
    });
    return toMeta(row);
  }

  /** Updates only if the widget exists and has the payload's type; returns null otherwise. */
  async updatePayload(id: string, payload: WidgetPayload): Promise<WidgetMeta | null> {
    const { type, data } = widgetPayloadSchema.parse(payload);
    const { count } = await this.prisma.widget.updateMany({
      where: { id, type },
      data: { data: data },
    });
    return count === 0 ? null : this.findMeta(id);
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.widget.deleteMany({ where: { id } });
    return count > 0;
  }

  /**
   * Inserts widgets (they appear last on the dashboard) in one transaction: either all of them
   * are saved or none. Keyed widgets that already exist are skipped, or replaced in place,
   * keeping their creation time and so their place.
   */
  async saveMany(widgets: readonly NewWidget[], onExisting: OnExistingSource): Promise<SavedWidget[]> {
    const rows = widgets.map(({ title, payload, sourceKey }) => {
      const { type, data } = widgetPayloadSchema.parse(payload);
      return { title, type, data: data, sourceKey: sourceKey ?? null };
    });

    return this.prisma.$transaction(async (tx) => {
      const keys = rows.flatMap((r) => (r.sourceKey ? [r.sourceKey] : []));
      const existing = new Map(
        (await tx.widget.findMany({ where: { sourceKey: { in: keys } }, select: { id: true, sourceKey: true } })).map(
          (w) => [w.sourceKey!, w.id],
        ),
      );

      const saved: SavedWidget[] = [];
      for (const row of rows) {
        const existingId = row.sourceKey ? existing.get(row.sourceKey) : undefined;
        if (!existingId) {
          // A concurrent seed inserting the same key fails here on the unique index and
          // rolls the whole transaction back rather than creating a duplicate.
          const created = await tx.widget.create({ data: row, select: { id: true } });
          saved.push({ id: created.id, title: row.title, status: 'created' });
          continue;
        }
        switch (onExisting) {
          case 'skip':
            saved.push({ id: existingId, title: row.title, status: 'skipped' });
            break;
          case 'replace':
            await tx.widget.update({
              where: { id: existingId },
              data: { type: row.type, title: row.title, data: row.data },
            });
            saved.push({ id: existingId, title: row.title, status: 'replaced' });
            break;
          default:
            assertNever(onExisting);
        }
      }
      return saved;
    });
  }
}

import { AbstractPowerSyncDatabase, CrudEntry } from "@powersync/web";
import { supabase } from "@/lib/supabase";

// ============================================================================
// Supabase Backend Module untuk PowerSync
// ============================================================================

/**
 * Adapter untuk menghubungkan PowerSync dengan Supabase.
 *
 * Catatan: Ini adalah implementasi dasar. Untuk produksi, perlu:
 * 1. PowerSync service instance (cloud powersync.dev atau self-hosted)
 * 2. Sync rules di PowerSync dashboard
 * 3. Supabase Auth token yang valid
 */
export class SupabasePowerSyncAdapter {
  /**
   * Upload local changes ke Supabase.
   */
  static async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await this.applyCrudOperation(op);
      }
      await transaction.complete();
    } catch (error) {
      console.error("[powersync] Upload error:", error);
      throw error;
    }
  }

  private static async applyCrudOperation(op: CrudEntry): Promise<void> {
    const table = op.table;
    const id = op.id;
    const data = op.opData ?? {};

    switch (op.op) {
      case "PUT": {
        const { error } = await supabase
          .from(table)
          .upsert({ id, ...data, store_id: process.env.NEXT_PUBLIC_STORE_ID });
        if (error) throw error;
        break;
      }
      case "PATCH": {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq("id", id);
        if (error) throw error;
        break;
      }
      case "DELETE": {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", id);
        if (error) throw error;
        break;
      }
    }
  }
}

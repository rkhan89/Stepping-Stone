import { db, deleteRuns, loadRun, saveRun } from "@/lib/db";
import { getOwnerId, peekOwnerId, clearOwnerId } from "@/lib/owner";
import type { Run } from "@/lib/session";

/** The run belonging to this browser. Never anyone else's. */
export async function GET() {
  if (!db()) return Response.json({ run: null, persisted: false });

  const ownerId = await peekOwnerId();
  if (!ownerId) return Response.json({ run: null, persisted: true });

  try {
    const stored = await loadRun(ownerId);
    return Response.json({ run: stored, persisted: true });
  } catch (err) {
    // A database that is down should not take the app with it. The run still
    // works in memory for this tab.
    console.error("run load failed", err);
    return Response.json({ run: null, persisted: false });
  }
}

export async function PUT(req: Request) {
  if (!db()) return Response.json({ id: null, persisted: false });

  const { id, state } = (await req.json()) as { id?: string | null; state?: Run };
  if (!state) return Response.json({ error: "Nothing to save." }, { status: 400 });

  try {
    const ownerId = await getOwnerId();
    const savedId = await saveRun(ownerId, id ?? null, state.input || "(untitled)", state);
    return Response.json({ id: savedId, persisted: true });
  } catch (err) {
    console.error("run save failed", err);
    return Response.json({ id: id ?? null, persisted: false });
  }
}

/**
 * "Cancel and it's deleted. No newsletter." Built before the save, so that
 * promise is true from the first day rather than a later intention.
 */
export async function DELETE() {
  const ownerId = await peekOwnerId();
  if (!ownerId) return Response.json({ deleted: 0 });

  try {
    const deleted = await deleteRuns(ownerId);
    await clearOwnerId();
    return Response.json({ deleted });
  } catch (err) {
    console.error("run delete failed", err);
    return Response.json({ error: "Couldn't delete that. Try again?" }, { status: 502 });
  }
}

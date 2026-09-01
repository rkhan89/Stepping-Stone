import { deleteApplication, updateApplication } from "@/lib/db";
import { peekOwnerId } from "@/lib/owner";
import { APPLICATION_STATUSES, isoDate } from "@/lib/applications";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await peekOwnerId();
  if (!ownerId) return Response.json({ error: "Nothing to update." }, { status: 404 });

  const body = (await req.json()) as { status?: string; outcomeNote?: string };

  if (body.status && !APPLICATION_STATUSES.includes(body.status as never)) {
    return Response.json({ error: "Unknown status." }, { status: 400 });
  }

  try {
    const application = await updateApplication(ownerId, id, {
      status: body.status,
      outcomeNote: body.outcomeNote?.trim() || null,
      // Marking it followed up records when, so the next chase is measured
      // from the follow-up rather than the original application.
      followedUpOn: body.status === "followed_up" ? isoDate(new Date()) : null,
    });
    if (!application) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return Response.json({ application });
  } catch (err) {
    console.error("application update failed", err);
    return Response.json({ error: "Couldn't update that." }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await peekOwnerId();
  if (!ownerId) return Response.json({ deleted: false });

  try {
    return Response.json({ deleted: await deleteApplication(ownerId, id) });
  } catch (err) {
    console.error("application delete failed", err);
    return Response.json({ error: "Couldn't delete that." }, { status: 502 });
  }
}

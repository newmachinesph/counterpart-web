"""Administrator case ownership, notes and outcomes with an append-only history."""
from app.models import Pairing, User, Venture
from app.services.common import Forbidden, Validation, now_utc
from app.services.notifications import notify


def record(row, user, action, note="", **extra):
    row.events = [*(row.events or []), {
        "action": action, "actor": user.id, "at": now_utc().isoformat(), "note": note, **extra,
    }]
    row.version = (row.version or 0) + 1


def resolve(db, row, user, note):
    if "admin" not in user.roles:
        raise Forbidden("Only administrators record review outcomes")
    if row.status not in ("open", "in_review") or len(note.strip()) < 20:
        raise Validation("An open review needs a documented outcome of at least 20 characters")
    row.status, row.resolution, row.resolved_by, row.resolved_at = "resolved", note.strip(), user.id, now_utc()
    record(row, user, "resolved", note.strip())
    if row.pairing_id:
        pairing = db.get(Pairing, row.pairing_id)
        recipients = {pairing.builder_id, pairing.counterpart_id}
        href = f"/pairings/{pairing.id}/compensation"
    else:
        recipients, href = {row.opened_by}, "/support"
    for identifier in recipients:
        notify(db, identifier, "A review outcome has been recorded for your request.", href)


def update(db, row, user, body):
    if row.version != body.version:
        from fastapi import HTTPException
        raise HTTPException(409, "This case changed. Reload it before saving your update.")
    action, note = body.action, body.note.strip()
    if action == "resolve":
        resolve(db, row, user, note)
        return
    if row.status == "resolved" and action != "reopen":
        raise Validation("Reopen this case before making changes")
    if action == "assign":
        assignee = db.get(User, body.assigned_to) if body.assigned_to else None
        if body.assigned_to and (not assignee or "admin" not in assignee.roles):
            raise Validation("Assign this case to an administrator")
        row.assigned_to = body.assigned_to
        record(row, user, action, note, assigned_to=body.assigned_to)
        return
    if action == "start":
        if row.status != "open":
            raise Validation("Only an open case can move into review")
        row.status = "in_review"
        row.assigned_to = row.assigned_to or user.id
    elif action == "reopen":
        if row.status != "resolved" or len(note) < 20:
            raise Validation("Record why this resolved case needs to be reopened (at least 20 characters)")
        row.status, row.resolution, row.resolved_by, row.resolved_at = "open", None, None, None
    elif action == "note":
        if len(note) < 3:
            raise Validation("Write an internal note")
    elif action in ("hide_listing", "restore_listing"):
        if row.category != "listing" or not row.venture_id or len(note) < 20:
            raise Validation("Listing moderation requires a listing report and a reason of at least 20 characters")
        venture = db.get(Venture, row.venture_id)
        db.refresh(venture, with_for_update=True)
        previous = venture.status
        if action == "hide_listing":
            if previous not in ("published", "development"):
                raise Validation("This listing is already hidden")
            venture.status = "draft"
            venture.moderation_hold = True
        else:
            moderation = [e for e in row.events if e["action"] in ("hide_listing", "restore_listing")]
            if previous != "draft" or not venture.moderation_hold or not moderation or moderation[-1]["action"] != "hide_listing":
                raise Validation("Only the listing hidden by this case can be restored")
            venture.status = moderation[-1]["previous_status"]
            venture.moderation_hold = False
        record(row, user, action, note, previous_status=previous, new_status=venture.status)
        notify(db, venture.builder_id, f"Your listing {venture.name} was {'hidden from' if action == 'hide_listing' else 'restored to'} the Bench. Reason: {note}", f"/bench/{venture.slug}")
        return
    else:
        raise Validation("Unknown case action")
    record(row, user, action, note)

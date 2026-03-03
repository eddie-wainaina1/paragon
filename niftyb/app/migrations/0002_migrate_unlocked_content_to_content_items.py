"""
Migrate Class.unlocked_content (ListField of DBRef) to
Class.content_items (EmbeddedDocumentList of {content: DBRef, blocking: false}).
Idempotent: skips classes that already have content_items or have no unlocked_content.
"""


def run() -> None:
    from mongoengine.connection import get_db

    db = get_db()
    classes = db.classes

    migrated = 0
    for doc in classes.find({"unlocked_content": {"$exists": True, "$not": {"$size": 0}}}):
        # Skip if content_items already populated (partial run protection)
        if doc.get("content_items"):
            continue

        items = [
            {"content": ref, "blocking": False}
            for ref in doc.get("unlocked_content", [])
        ]
        classes.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {"content_items": items},
                "$unset": {"unlocked_content": ""},
            },
        )
        migrated += 1

    # Remove the unlocked_content field from any class that has it but is empty
    classes.update_many(
        {"unlocked_content": {"$exists": True}},
        {"$unset": {"unlocked_content": ""}},
    )

    import logging
    logging.getLogger(__name__).info(
        "Migration 0002 complete", extra={"migrated_classes": migrated}
    )

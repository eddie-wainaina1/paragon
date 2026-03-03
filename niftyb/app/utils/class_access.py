"""Shared helpers for class content access control."""
from __future__ import annotations


def is_content_accessible(content_items, target_content_id: str, completed_ids: set[str]) -> bool:
    """
    Return True if *target_content_id* is accessible to a student given their
    *completed_ids* set.

    A content item is inaccessible if any blocking item that appears *before* it
    in the ordered list has not been completed.
    """
    for item in content_items:
        if not hasattr(item.content, "id"):
            continue
        item_id = str(item.content.id)
        if item_id == target_content_id:
            return True
        if item.blocking and item_id not in completed_ids:
            return False
    return False

from __future__ import annotations

import uuid
from datetime import datetime

import structlog
from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CreateArcRequest,
    CreateDirectiveRequest,
    CreateNodeRequest,
    GenerateNodesRequest,
    NarrativeDirective,
    NarratorArc,
    StoryNode,
    UpdateArcRequest,
    UpdateNodeRequest,
)
from app.services.narrator_service import (
    generate_nodes_with_ai,
    load_arc,
    save_arc,
    seed_initial_directives,
)
from app.storage.narrator_storage import delete_narrator

log = structlog.get_logger()
router = APIRouter(tags=["narrator"])


def _arc_not_found(session_id: str):
    raise HTTPException(status_code=404, detail=f"No narrator arc for session {session_id}")


@router.get("/narrator/{session_id}", response_model=NarratorArc)
async def get_arc(session_id: str):
    arc = await load_arc(session_id)
    if arc is None:
        raise HTTPException(status_code=404, detail="No narrator arc")
    return arc


@router.post("/narrator/{session_id}", response_model=NarratorArc)
async def create_arc(session_id: str, body: CreateArcRequest):
    arc = NarratorArc(
        id=str(uuid.uuid4()),
        session_id=session_id,
        title=body.title,
        goal=body.goal,
        themes=body.themes,
        tone=body.tone,
        pacing_notes=body.pacing_notes,
        tension_level=body.tension_level,
        connection_id=body.connection_id,
        nodes=[
            StoryNode(id=str(uuid.uuid4()), **{k: v for k, v in n.items() if k != "id"})
            for n in body.nodes
        ] if body.nodes else [],
    )
    await save_arc(arc)
    await seed_initial_directives(session_id)
    return arc


@router.put("/narrator/{session_id}", response_model=NarratorArc)
async def update_arc(session_id: str, body: UpdateArcRequest):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(arc, key, val)
    arc.updated_at = datetime.now().isoformat()

    await save_arc(arc)
    return arc


@router.delete("/narrator/{session_id}")
async def delete_arc(session_id: str):
    deleted = await delete_narrator(session_id)
    return {"status": "deleted" if deleted else "not_found"}


@router.post("/narrator/{session_id}/toggle", response_model=NarratorArc)
async def toggle_arc(session_id: str):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    arc.enabled = not arc.enabled
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)
    if arc.enabled:
        await seed_initial_directives(session_id)
    return arc


# ── Node management ──

@router.post("/narrator/{session_id}/nodes", response_model=StoryNode)
async def add_node(session_id: str, body: CreateNodeRequest):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    node = StoryNode(
        id=str(uuid.uuid4()),
        title=body.title,
        description=body.description,
        conditions=body.conditions,
        order=body.order if body.order else len(arc.nodes) + 1,
        directives_template=body.directives_template,
    )
    arc.nodes.append(node)
    arc.nodes.sort(key=lambda n: n.order)
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)
    return node


@router.put("/narrator/{session_id}/nodes/{node_id}", response_model=StoryNode)
async def update_node(session_id: str, node_id: str, body: UpdateNodeRequest):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    node = next((n for n in arc.nodes if n.id == node_id), None)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    update_data = body.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(node, key, val)

    arc.nodes.sort(key=lambda n: n.order)
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)
    return node


@router.delete("/narrator/{session_id}/nodes/{node_id}")
async def delete_node(session_id: str, node_id: str):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    arc.nodes = [n for n in arc.nodes if n.id != node_id]
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)
    return {"status": "deleted"}


@router.post("/narrator/{session_id}/generate-nodes")
async def generate_nodes(session_id: str, body: GenerateNodesRequest):
    """AI-assisted story node generation."""
    nodes = await generate_nodes_with_ai(
        goal=body.goal,
        count=body.count,
        context=body.context,
        connection_id=body.connection_id,
    )
    return {"nodes": nodes}


# ── Directive management ──

@router.get("/narrator/{session_id}/directives")
async def get_directives(session_id: str):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)
    return {"directives": [d.model_dump() for d in arc.active_directives]}


@router.post("/narrator/{session_id}/directives", response_model=NarrativeDirective)
async def add_directive(session_id: str, body: CreateDirectiveRequest):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    directive = NarrativeDirective(
        id=str(uuid.uuid4()),
        type=body.type,
        content=body.content,
        priority=body.priority,
        persistent=body.persistent,
        turns_remaining=body.turns_remaining,
    )
    arc.active_directives.append(directive)
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)
    return directive


@router.delete("/narrator/{session_id}/directives/{directive_id}")
async def delete_directive(session_id: str, directive_id: str):
    arc = await load_arc(session_id)
    if arc is None:
        _arc_not_found(session_id)

    arc.active_directives = [d for d in arc.active_directives if d.id != directive_id]
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)
    return {"status": "deleted"}

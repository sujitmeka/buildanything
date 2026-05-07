# Product Spec

## App Overview

A note-taking app for one user.

| Persona | Role | Primary JTBD | Relationship to Other Personas |
|---------|------|--------------|--------------------------------|
| Writer (primary) | Solo author | Capture and retrieve notes quickly | None — single-persona tool |

## Screen Inventory

| Screen | Description | Features |
|--------|-------------|----------|
| Editor | Text editor with sidebar | Note Editing |

## Permissions & Roles

Single role: writer.

## First 60 Seconds

### Persona: Writer

**First-encounter promise**: Writer opens editor and types notes into it for later retrieval and editing.

## Cross-Feature Interactions

- None.

## Feature: Note Editing

### States
States: empty (initial), loaded

### Transitions

| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| empty → loaded | User picks note | Note exists | Render content |

### Data Requirements

`note { id, body }`

### Failure Modes

- `save_failed`: network down; user sees error; retry button.

### Business Rules

- Autosave fires 500ms after last keystroke.

### Happy Path

User picks note, types.

### Persona Constraints

- Writer: offline-first.

### Empty/Loading/Error States

- Empty: "No notes."

### Acceptance Criteria

- AC-1: saves within 500ms.

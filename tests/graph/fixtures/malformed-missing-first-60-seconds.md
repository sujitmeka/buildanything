# Product Spec

## App Overview

A note-taking app for one user. Single role, single persona.

| Persona | Role | Primary JTBD | Relationship to Other Personas |
|---------|------|--------------|--------------------------------|
| Writer (primary) | Solo author | Capture and retrieve notes quickly | None — single-persona tool |

## Screen Inventory

| Screen | Description | Features |
|--------|-------------|----------|
| Editor | Text editor with sidebar of notes | Note Editing |

## Permissions & Roles

Single role: writer.

## Cross-Feature Interactions

- None — single-feature.

## Feature: Note Editing

### States
States: empty (initial), loaded, saving, error

### Transitions

| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| empty → loaded | User selects note | Note exists | Editor renders content |
| loaded → saving | User edits text | Note loaded | Debounced save fires |
| saving → loaded | Save succeeds | — | Editor unblocked |
| saving → error | Save fails | — | Show error banner |

### Data Requirements

`note { id, title, body, updated_at }`

### Failure Modes

- `save_failed`: trigger = network down; user sees: "Couldn't save — try again"; recovery: retry button.

### Business Rules

- Autosave fires 500ms after last keystroke.

### Happy Path

User picks note, types, autosave persists.

### Persona Constraints

- Writer: must work offline-first.

### Empty/Loading/Error States

- Empty: "No notes yet. Press ⌘N to create one."
- Loading: shimmer over note list.
- Error: red banner above editor.

### Acceptance Criteria

- AC-1: editor saves within 500ms of last keystroke.
- AC-2: offline edit persists locally and syncs when online.

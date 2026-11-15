# Tuntas V1 · routes and states

| URL after # | Goal | Primary interaction |
|---|---|---|
| /home | Capture immediately | Choose a file, use native camera picker, paste, or try the labeled receipt |
| /capture | Supply an original | Drop/select one file or paste text, choose processing, Save & organize |
| /inbox | Resolve exceptions | Open uncertain, interrupted or failed record; fix or retry |
| /library | Retrieve filed records | Search all query words across title, name, category, text, facts and tags; combine with a category |
| /document/:id | Inspect or correct | Original download, evidence, editable facts, filing undo, add an optional action |
| /actions | Finish a follow-up | Check to complete, uncheck to reopen, open source |

```mermaid
stateDiagram-v2
  [*] --> Intake
  Intake --> Intake: Reject unsupported format or size
  Intake --> Existing: Identical original
  Intake --> Pending: Commit bytes and metadata atomically
  Pending --> Processing: Read original
  Processing --> Review: Ambiguous, partial or unsupported facts
  Processing --> Library: Confident supported result
  Processing --> Error: Parse, model or validation failure
  Error --> Processing: Explicit retry
  Error --> Library: File original manually
  Review --> Library: Confirm or correct
  Library --> Review: Undo filing
  Library --> Detail: Retrieve
  Detail --> Action: Explicit user request
  Action --> Completed: User checks action
  Completed --> Action: Reopen
```

There is no cloud-storage upload phase in the browser workspace. The displayed saving/reading/processing stages correspond to operations, not a timer. Opening a pending/processing record after interruption offers retry/manual recovery. Search is literal word matching, not semantic retrieval. Actions start empty; the user supplies a title and may leave the due date blank. Text is rendered as text. The immutable source and original filing proposal are separate from edits.

Desktop: persistent left rail and top search; tablet switches by available width. Mobile: Home / Inbox / Capture / Library / Actions dock; document forms flow in one column. Keyboard: native controls, skip link, visible focus, Ctrl/Cmd-K to Library search, focus moves to the destination heading. Compare the [design inventory](STITCH-AUDIT.md) and the generated [desktop](demo/desktop.png) / [mobile](demo/mobile.png) images.


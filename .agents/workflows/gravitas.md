---
description: Apply the Gravitas reliability runtime for coding, debugging, and verification
---

Apply the **gravitas** skill to execute the following request:

$PROMPT

Remember to follow the Gravitas invariants:
1. Ground before mutating (inspect target code, tests, and callers first).
2. Keep edits strictly scoped within target files.
3. Verify changes with executable evidence (tests, linters, or compiler output).
4. Provide structured reporting with:
   - ## What Changed
   - ## Evidence
   - ## Why

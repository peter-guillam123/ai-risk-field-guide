# AI risk field guide

Audience: readers who know nothing about AI (public-facing)
Voice: Chris's voice and house style; the About page and diary in the first person
Design: its own look (sage paper, pine ink, kingfisher blue, amber; Bricolage Grotesque, Literata, DM Mono), not Guardian

- Every factual claim cites a source in `js/data.js`. Run `node tools/check_refs.js` before each commit.
- The model's training data predates the summer 2026 events, so anything new needs fresh research from primary sources, labelled by how it was checked.
- Add a diary entry in `js/content.js` (`GUIDE.prose['about-body']`) with each significant change.
- Artifact: rebuild with `tools/build_artifact.py` and republish to https://claude.ai/artifact/6drbcp2KXPQbDFHkVQbPUZ
- GitHub: `peter-guillam123/ai-risk-field-guide`, private until Chris says otherwise.

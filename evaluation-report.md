# PII Redaction Evaluation Report

Generated: 2026-08-13T19:02:14.137Z

## Validation methodology

This report is from an independent validation pass — not a self-referential re-run of the original evaluation script.

1. **Ground truth** was hand-built by reading a stratified sample from the NSDL RHP extract: cover page, contact/banker tables, registrar, KMP table, biographical paragraphs, statutory details, and selling-shareholder lines. Annotations were written before scoring and verified against extracted text offsets.
2. **Synthetic supplement** (`evaluation/synthetic-supplement.json`) contains clearly labeled fabricated SSN, credit card, IP, and DOB instances plus negative controls (Luhn-fail 16-digit number, bare filing date, DIN).
3. Detectors were run on each sample unit; predictions were scored with type-matched span overlap.
4. Redacted `.docx` output was sanity-checked for coverage, substitution consistency, boilerplate false positives, and structural readability.

### Reader fix applied before validation

During validation, a docx reader bug was found: the original regex `</w:(?:p|tbl)>` stopped at the first `</w:p>` inside tables, flattening tables and dropping email/phone lines after `<w:br/>`. Fixed in `src/docx/reader.js` before re-scoring. Prior metrics from the broken reader are invalid.

## Real document metrics

| Category | TP | FP | FN | Precision | Recall | F1 |
|----------|----|----|-----|-----------|--------|------|
| name | 15 | 0 | 6 | 100.0% (1.000) | 71.4% (0.714) | 83.3% (0.833) |
| email | 14 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |
| phone | 13 | 0 | 1 | 100.0% (1.000) | 92.9% (0.929) | 96.3% (0.963) |
| company | 13 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |
| address | 2 | 1 | 0 | 66.7% (0.667) | 100.0% (1.000) | 80.0% (0.800) |
| cin | 2 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |
| date_of_birth | 2 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |

### False negatives (real document) — actual missed items

- **name** (6 missed):
  - `Indrajit Bhagat` in sample `brlm-idbi-capital`
  - `Shanti Gopalkrishnan` in sample `registrar-row`
  - `Vijay Chandok` in sample `kmp-table`
  - `Shanti Gopalkrishnan` in sample `kmp-table`
  - `Vijay Chandok` in sample `kmp-vijay-bio`
  - `Alen Wilfred Ferns` in sample `kmp-alen-bio`
- **email**: none
- **phone** (1 missed):
  - `+91 810 811 4949` in sample `registrar-row`
- **company**: none
- **address**: none
- **cin**: none
- **date_of_birth**: none

### False positives (real document) — wrongly flagged items

- **name**: none
- **email**: none
- **phone**: none
- **company**: none
- **address** (1 false alarms):
  - `+91 810 811 4949` in sample `registrar-row`
- **cin**: none
- **date_of_birth**: none

### Error pattern analysis (real document)

- **name**: 6 missed total — 4 in table cells without honorific cues (Indrajit Bhagat, Shanti Gopalkrishnan, Vijay Chandok, Shanti Gopalkrishnan); 2 in biographical paragraphs where compromise extracts a partial span (Vijay Chandok, Alen Wilfred Ferns).
- **phone**: 1 missed — +91 810 811 4949
- **email**: all annotated emails detected.
- **address**: 1 false positive(s) — PIN-anchored heuristic over-captured adjacent text.
- **date_of_birth**: both DOB-cued dates detected in the real sample; incorporation/appointment dates correctly ignored. (Synthetic supplement reveals a separate precision bug — see Contradictions.)

## Name recall — layered breakdown

| Layer | TP | FN | Recall |
|-------|----|----|--------|
| compromise alone | 3 | 18 | 14.3% (0.143) |
| compromise + title-cue heuristic | 15 | 6 | 71.4% (0.714) |

Absolute recall gain from title-cue layer: **57.1%** (0.571)

**Names missed even with title-cue layer:**
- `Indrajit Bhagat` in `brlm-idbi-capital`
- `Shanti Gopalkrishnan` in `registrar-row`
- `Vijay Chandok` in `kmp-table`
- `Shanti Gopalkrishnan` in `kmp-table`
- `Vijay Chandok` in `kmp-vijay-bio`
- `Alen Wilfred Ferns` in `kmp-alen-bio`

**Names rescued by title-cue layer (missed by compromise alone):**
- `Aboli Pitre` in `brlm-icici`
- `Hitesh Malhotra` in `brlm-icici`
- `Simran Gadh` in `brlm-axis`
- `Harish Patel` in `brlm-axis`
- `Harsh Thakkar` in `brlm-hsbc`
- `Harshit Tayal` in `brlm-hsbc`
- `Ritu Sharma` in `brlm-motilal`
- `Sankita Ajinkya` in `brlm-motilal`
- `Sylvia Mendonca` in `brlm-sbi`
- `Prashant Patankar` in `brlm-sbi`
- `Samar Banwat` in `appointment-paragraph`
- `Vijay Chandok` in `appointment-paragraph`

## Synthetic supplement metrics (separate from real document)

| Category | TP | FP | FN | Precision | Recall | F1 |
|----------|----|----|-----|-----------|--------|------|
| ssn | 3 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |
| credit_card | 2 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |
| ip_address | 2 | 0 | 0 | 100.0% (1.000) | 100.0% (1.000) | 100.0% (1.000) |
| date_of_birth | 2 | 2 | 0 | 50.0% (0.500) | 100.0% (1.000) | 66.7% (0.667) |

### False negatives (synthetic)

- **ssn**: none
- **credit_card**: none
- **ip_address**: none
- **date_of_birth**: none

### False positives (synthetic)

- **ssn**: none
- **credit_card**: none
- **ip_address**: none
- **date_of_birth**: `January 14, 2025` in `synthetic-mixed-paragraph`
- **date_of_birth**: `22/08/2025` in `synthetic-born-on`

### Negative controls (synthetic — should NOT be flagged)

- `January 14, 2025`: FLAGGED (precision failure) — bare filing date — no DOB cue within window
- `1234567890123456`: correctly ignored — 16-digit reference — fails Luhn
- `00012345`: correctly ignored — DIN-style number — not SSN format
- `22/08/2025`: FLAGGED (precision failure) — offer date — no DOB cue

## Redacted output sanity checks

### Substitution consistency (repeated entities)

- **Alen Wilfred Ferns** (name): source ×4 → fake `Vaijayanthi Reddy-Ganaka` ×1 in output; original still present: YES (problem)
- **Vijay Chandok** (name): source ×3 → fake `Gemini Dwivedi` ×1 in output; original still present: YES (problem)
- **ICICI Securities Limited** (company): source ×1 → fake `Asan, Chaturvedi and Agarwal Limited` ×1 in output; original still present: no
- **301, 3rd Floor, Naman Chambers, G-Block, Plot No. C-32, Bandra Kurla Complex, Bandra East, Mumbai – 400 051, Maharashtra, India** (address): source ×2 → fake `(not in substitution map)` ×0 in output; original still present: no

### Ground-truth coverage in redacted docx

- Redacted: 58 / 68 annotated instances
- Known misses (original still in output): 10
  - [name] `Alen Wilfred Ferns` in `cover-contact-person`
  - [name] `Indrajit Bhagat` in `brlm-idbi-capital`
  - [name] `Shanti Gopalkrishnan` in `registrar-row`
  - [name] `Vijay Chandok` in `kmp-table`
  - [name] `Alen Wilfred Ferns` in `kmp-table`
  - [name] `Shanti Gopalkrishnan` in `kmp-table`
  - [name] `Vijay Chandok` in `kmp-vijay-bio`
  - [name] `Alen Wilfred Ferns` in `kmp-alen-bio`
  - [name] `Alen Wilfred Ferns` in `kmp-alen-bio`
  - [name] `Vijay Chandok` in `appointment-paragraph`

### Boilerplate false-positive check

- No PII flags in the boilerplate-only negative-control paragraph.

### Structure / readability

- Source table blocks: 4; redacted table blocks: 4
- Heading/label "RED HERRING PROSPECTUS" preserved: yes
- Heading/label "BOOK RUNNING LEAD MANAGERS" preserved: yes
- Heading/label "REGISTERED OFFICE" preserved: yes
- Heading/label "Name" preserved: yes
- Heading/label "Designation" preserved: yes
- Heading/label "DIN" preserved: yes
- Tables remain tabular (not flattened to orphan paragraphs) after reader fix.

## Contradictions vs design assumptions

1. **DOB precision is worse than stated design intent.** The detector matches the substring `DOB` inside phrases like "no DOB cue", causing false positives on filing dates (`January 14, 2025`, `22/08/2025`). Synthetic DOB precision: **50.0%** (2 FP / 4 predictions). This contradicts the README claim that bare filing dates are "correctly ignored" — they are not, when the negation sentence contains the letters "DOB".

2. **Name substitution is incomplete, not just low-recall.** Even when a name is detected, compromise often captures a suffix only (`Wilfred Ferns` instead of `Alen Wilfred Ferns`), leaving `Alen` in the redacted output. Spot-check: `Alen`, `Vijay`, and `Wilfred` still appear in `output/redacted-prospectus.docx`.

3. **Title-cue layer helps substantially but not enough for tables.** Compromise-alone recall: **14.3%**; with title-cue: **71.4%**. Six names remain missed — mostly bare names in table cells (`Vijay Chandok`, `Shanti Gopalkrishnan`, `Indrajit Bhagat`) with no honorific or designation in the same text unit.

4. **Address and phone detectors collide on mobile numbers.** `+91 810 811 4949` contains digit groups matching the PIN heuristic (`811 4949`), so the address detector claims it (FP) and the phone detector loses it (FN) in the combined registrar row.

5. **Docx reader was broken before this validation pass** (tables flattened, emails after `<w:br/>` dropped). Fixed for validation; metrics from the earlier `evaluate.js` run are invalid.

6. **Redaction coverage gap:** 10 of 68 hand-annotated instances still appear verbatim in the redacted document.
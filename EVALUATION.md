# Evaluation Strategy and Metrics

This document outlines the evaluation framework used to measure the effectiveness, accuracy, and reliability of the PII Redaction Tool. 

Our primary evaluation goal is to produce **ground-truth-anchored, unbiased metrics** that accurately reflect how the tool performs on real-world financial filings, without artificially inflating scores by evaluating the tool against its own outputs.

## 1. Two-Pronged Evaluation Approach

We utilize two separate datasets to evaluate the detectors, ensuring coverage across all PII types.

### A. Real-World Ground Truth (The Primary Test)
The source Red Herring Prospectus (RHP) contains rich representations of Names, Companies, Emails, Phones, Addresses, and CINs.
- **Independent Hand-Labeling**: We selected a stratified sample of PII-dense sections (cover page, BRLM banker tables, registrar tables, KMP biographies, and statutory blocks). These sections were manually read and hand-annotated with exact text offsets.
- **Bias Prevention**: Ground truth was built entirely independently of the detectors. This ensures we are testing the tool's actual recall against human reading comprehension, not just verifying that the tool outputs what it is programmed to output.

### B. Synthetic Supplement (Edge Cases & Missing PII)
Real-world RHPs typically do not contain Social Security Numbers (SSNs), Credit Card numbers, or IP Addresses. Furthermore, we needed to test precise edge cases.
- **Fabricated Data**: We inject a supplementary JSON file containing explicitly planted SSNs, Credit Cards, IPs, and Dates of Birth (DOBs).
- **Negative Controls**: The synthetic supplement includes deliberate "near-misses" to rigorously test **precision**:
  - A 16-digit number that fails the Luhn algorithm (should not flag as a credit card).
  - A bare filing date (e.g., "January 14, 2025") with no DOB cue (should not flag as DOB).
  - An 8-digit DIN number (should not flag as SSN).

## 2. Core Metrics

Each detector is scored against the ground truth using standard classification metrics, calculated on a per-category basis. A detection is considered a True Positive (TP) if the predicted span overlaps with the ground-truth span and the types match.

- **True Positives (TP)**: The detector successfully flagged an actual PII instance.
- **False Positives (FP)**: The detector wrongly flagged text that is not PII (or not the correct type).
- **False Negatives (FN)**: The detector completely missed an actual PII instance.

From these counts, we calculate:
- **Precision**: `TP / (TP + FP)` — Out of everything the tool flagged as PII, what percentage was actually PII? (Measures over-redaction).
- **Recall**: `TP / (TP + FN)` — Out of all actual PII in the document, what percentage did the tool successfully catch? (Measures under-redaction).
- **F1 Score**: `2 * (Precision * Recall) / (Precision + Recall)` — The harmonic mean of precision and recall.

## 3. Layered Name Recall Analysis

Name detection is notoriously difficult in unstructured text without deep context. We evaluate Name detection using a **layered breakdown** to quantify the exact contribution of our heuristics over standard NLP models:
1. **NLP Baseline**: We score the recall of the `compromise` NLP library's built-in `.people()` detection running alone.
2. **Heuristic Layer**: We score the recall when adding our custom Title-Cue heuristics (e.g., looking for adjacent honorifics, slashes in contact tables, and "was appointed" phrasing).
3. **Delta**: The report explicitly lists the names missed by the NLP baseline but "rescued" by the heuristics, quantifying the absolute recall gain.

## 4. Redacted Output Sanity Checks

Beyond scoring raw detector outputs, the pipeline performs end-to-end sanity checks on the final reconstructed `.docx` file to ensure the substitution map and document writer behave correctly.

- **Substitution Consistency**: Spot-checks entities that appear multiple times in the source (e.g., a specific contact person). Verifies that they are mapped to the *same* fake entity across all occurrences, and that the original name is entirely absent.
- **Coverage Gap Verification**: Scans the redacted text for every ground-truth value to definitively prove whether a known PII instance leaked into the final output.
- **Boilerplate False-Positive Check**: Scans a negative-control paragraph of pure legal/financial boilerplate to ensure financial terms (e.g., "financing arrangements", "securities") aren't mistakenly redacted.
- **Structural Integrity**: Confirms that key section headers and table structures survive the extraction and reconstruction process without being flattened.

## 5. Automated Reporting

Running `npm run validate` executes the entire suite. It calculates the metrics, cross-references the findings, and generates `evaluation-report.md`. The pipeline enforces radical transparency: false positives and false negatives are not just counted—the actual missed or wrongly flagged strings are listed in the report alongside the underlying failure pattern (e.g., "Address detector incorrectly captured a phone number due to PIN heuristic").

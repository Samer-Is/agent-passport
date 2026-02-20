# Data Validation Protocol

## 1. Protocol Name

Data Validation Protocol

## 2. Purpose & Scope

### Purpose

The purpose of this protocol is to ensure that all data used for analysis, KPIs, insights, and decisions is **reliable, consistent, and fit for use** before interpretation or recommendation.

This protocol exists to prevent:
- Decisions based on incorrect, incomplete, or misaligned data
- Blind trust in single data sources
- Misinterpretation caused by definition mismatches or tracking gaps

Data correctness precedes insight generation.

### Scope

This protocol applies to all situations involving:
- KPIs, metrics, and dashboards
- Analytics outputs (GA4, BI tools, spreadsheets, reports)
- Financial, operational, or performance data
- Comparisons across time, segments, or tools

This protocol is mandatory whenever data is referenced or interpreted.

## 3. Non-Negotiable Rules

The following rules are absolute:

- Never assume data is correct by default
- Never rely on a single source when validation is feasible
- Never interpret metrics without confirming their definitions

Mandatory behaviors:
- Validate data sources before analysis
- Confirm metric definitions and calculation logic
- Flag inconsistencies explicitly

If data validity cannot be confirmed, outputs must be labeled accordingly or paused.

## 4. Operating Principles

- Data is guilty until proven innocent
- Consistency matters more than precision
- Definitions are as important as numbers
- Validation precedes interpretation

The default stance is: *"Can this data be trusted?"*

## 5. Required Behaviors

Before using any data point, the system must:

- Identify the data source(s)
- Confirm metric definitions and calculation methods
- Check for internal consistency (e.g., totals vs. breakdowns)
- Compare against at least one secondary reference when possible

When issues are found, the system must:
- Flag discrepancies explicitly
- Avoid smoothing or reconciling data silently
- Label affected insights as provisional

## 6. Explicit Triggers

This protocol activates automatically when:

- Data is pulled from analytics tools or reports
- Metrics are compared across tools, timeframes, or segments
- Sudden changes or step-functions appear in KPIs
- Financial or performance data informs a decision

This protocol cannot be bypassed once triggered.

## 7. Output Standards

All outputs under this protocol must include:

- Data source identification
- Validation status (validated / partially validated / unvalidated)
- Explicit notes on known limitations

If discrepancies exist, they must be described clearly, including:
- Nature of the discrepancy
- Potential impact on interpretation

## 8. Escalation & Communication Rules

- All data discrepancies or validation failures must be flagged to Kareem
- The system must not autonomously resolve or correct data
- When relevant, the system may suggest which team (e.g., Data, BI, Engineering) should investigate

No assumptions should be made about root cause unless confirmed.

## 9. Examples

### Correct Application

"Session count differs between GA4 and the internal BI report by 12%. Metric definitions and attribution models differ. Until reconciled, conclusions based on session volume should be treated as provisional. [Requires Data Validation]."

### Incorrect Application

"We will use GA4 sessions since it is more accurate."
(Unjustified source preference)

## 10. Compliance Checklist

Before finalizing any output, the following must be true:

- [ ] Data sources identified
- [ ] Metric definitions confirmed
- [ ] Cross-check performed where feasible
- [ ] Discrepancies flagged and labeled

If any box is unchecked, the output must be labeled provisional or paused.

**Protocol Status:** Mandatory
**Overrides:** Blind trust in data, convenience, unverified reporting

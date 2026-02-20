# Anomaly Flagging Protocol

## 1. Protocol Name

Anomaly Flagging Protocol

## 2. Purpose & Scope

### Purpose

The purpose of this protocol is to ensure that unusual, unexpected, or potentially risky deviations in data, behavior, or system performance are explicitly identified, contextualized, and communicated—without autonomous escalation or corrective action.

This protocol exists to prevent:
- Silent normalization of abnormal behavior
- Overreaction to noise or expected variance
- Autonomous escalation without human judgment

Flagging anomalies is an informational responsibility, not an enforcement action.

### Scope

This protocol applies to all outputs involving:
- KPIs, metrics, and trend analysis
- Dashboards and monitoring views
- Operational, financial, or performance data
- User behavior, funnel metrics, or system activity

This protocol is mandatory whenever deviations, spikes, drops, or irregular patterns are observed.

## 3. Non-Negotiable Rules

The following rules are absolute:

- Never ignore or normalize unexplained anomalies
- Never assume anomalies are errors or issues without validation
- Never autonomously escalate, alert, or resolve anomalies

Mandatory behaviors:
- Explicitly flag anomalies when detected
- Distinguish signal from noise where possible
- Communicate anomalies neutrally and factually

If the nature or cause of an anomaly is unclear, it must be flagged—not interpreted.

## 4. Operating Principles

- Detection precedes diagnosis
- Flagging is descriptive, not prescriptive
- Human judgment is required before escalation
- Context reduces false alarms

The default stance is: *"This deviation requires attention, not action."*

## 5. Required Behaviors

When an anomaly is detected, the system must:

- Describe what deviated (metric, behavior, system)
- Quantify the deviation where possible
- State the reference baseline (historical average, threshold, expectation)
- Clarify whether the deviation is:
  - Unexplained
  - Potentially expected
  - Likely noise
- Avoid assigning blame or root cause without evidence

## 6. Explicit Triggers

This protocol activates automatically when:

- KPI values exceed expected thresholds
- Sudden spikes or drops appear without explanation
- Patterns deviate from historical norms
- Metric behavior contradicts business logic or lifecycle expectations

Once triggered, the anomaly must be flagged explicitly in the output.

## 7. Output Standards

All anomaly flags must include:

- **Anomaly Description** — What changed and how
- **Magnitude** — Size and direction of deviation
- **Baseline** — What this is compared against
- **Confidence Level** — High / Medium / Low
- **Next Recommended Review** — Who should look at this

Language must remain neutral, factual, and non-alarmist.

## 8. Escalation & Communication Rules

- All anomalies must be surfaced to Samer
- The system must not:
  - Trigger alerts
  - Assign urgency
  - Initiate corrective actions
- The system may recommend the most relevant team or function to review (e.g., Data, Product, Engineering, Ops)

Final escalation decisions remain with Kareem.

## 9. Examples

### Correct Application

"Checkout conversion dropped by 18% compared to the trailing 4-week average. No corresponding traffic change is observed. This deviation is unexplained and should be reviewed by Product and Engineering."

### Incorrect Application

"Checkout conversion dropped due to a checkout bug. Engineering should fix this immediately."
(Unverified diagnosis and autonomous escalation)

## 10. Compliance Checklist

Before finalizing any output containing anomalies, the following must be true:

- [ ] Anomaly explicitly identified
- [ ] Baseline and magnitude stated
- [ ] No root cause assumed
- [ ] No autonomous escalation or action taken
- [ ] Recommended review owner suggested

If any box is unchecked, the anomaly handling is invalid.

**Protocol Status:** Mandatory
**Overrides:** Silent normalization, autonomous escalation, speculative diagnosis

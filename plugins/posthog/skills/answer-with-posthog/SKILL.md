---
name: answer-with-posthog
description: Answer a product question from PostHog data — how many, how often, who, what changed — by checking that the event and property exist before querying, picking the query that fits the question, and saying what was counted. Use when the user asks about usage, signups, retention, a funnel, a feature flag's rollout, or what a person did in the product.
argument-hint: the product question to answer
allowed-tools: mcp__posthog__*
---

# Answer from PostHog, and say what you counted

A number without its definition is not an answer. The job is to find the right
event, count it the way the question means, and report the definition with the
result.

## 1. Read the server's own instructions

The PostHog server describes its tools and its required order of steps when it
connects. Follow those. They change more often than this skill does.

## 2. Confirm the event before you query it

Look up the project's events and the event's properties first. Do not query an
event name taken from the question, even a standard-looking one: names differ
per project, and a wrong name returns zero, which reads like a real answer.
If the event does not exist, say so.

## 3. Pick the query that fits the question

- "How many" or "over time": a trend.
- "What share get from A to B": a funnel.
- "Do they come back": retention.
- A lookup of rows, a join, or a custom calculation: SQL.

Use the smallest query that answers the question. State the date range and
whether internal and test accounts are filtered out.

## 4. Report

Give the number, then what it counts: the event, the filters, the range, and
whether it is events or unique people. If two reasonable definitions give
different numbers, give both and say which you would use.

## Changes

Creating or editing an insight, a dashboard or a feature flag changes what the
team sees. Do it only when the user asks for that change. Changing a flag's
rollout affects live users: state the before and after, and get a go-ahead
first. Deleting a person's data cannot be undone.

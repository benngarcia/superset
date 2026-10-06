---
name: schedule-a-meeting
description: Find a time that works and put it on Google Calendar without double-booking anyone or landing in the wrong time zone. Use when the user asks to schedule, book, move, or cancel a meeting, asks when they or someone else is free, or asks what is on their calendar.
argument-hint: who to meet, for how long, and roughly when
allowed-tools: mcp__google-calendar__*
---

# Schedule against the calendar, not against a guess

## 1. Pin the time zone first

Every time you read or write is in a time zone. Read the user's primary calendar
with `list_calendars` and use its time zone unless the user names another. When
attendees are in other zones, say each one's local time in your answer, so
"3pm" cannot mean two different hours.

## 2. Read before you write

- "What is on my calendar" is `list_events` with an explicit start and end.
  Do not leave the window open: a default range can silently drop the day the
  user asked about.
- "When are we free" is `find_free_time` with every attendee's email in
  `calendarIds`. Do not derive free time from one person's event list. If it
  says a calendar is not readable, that person's busy time is unknown: say so
  rather than treating them as free. Its windows are in UTC and ignore working
  hours, so convert them and drop the ones at 3am before proposing a time.
- To change an event, `get_event` first. Edit the event you read, not the one
  you remember from earlier in the conversation.

## 3. Writes reach other people

Creating, moving, or cancelling an event with attendees sends them email. Before
`create_event`, `update_event`, `delete_event`, or `respond_to_event`, state the
title, start and end with time zone, and the attendee list, and get a yes. A
recurring event asks one more question: this occurrence, or the whole series.

## 4. Report what the calendar now says

After a write, read the event back and report the stored title, time, and
attendees, with its link. If a field did not take, say so.

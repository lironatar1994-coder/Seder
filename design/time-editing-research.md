# Time editing refinement — 2026-10-04

The user's instruction is to remove unnecessary text and take inspiration from
Todoist. This is a narrow refinement of Seder's existing neutral task interface.

Primary reference:
https://www.todoist.com/help/todoist/features/schedule-a-date-and-time-for-your-todoist-tasks-q7VobO
Todoist documents Date → Time → time field → Save. Its duration documentation
also separates editing from saving:
https://www.todoist.com/help/todoist/features/set-a-task-duration-L1kYkZv8d

Seder now exposes a direct time control beside the task date, displays the
existing time there, and uses a small editor with an explicit Save action.
Intermediate native time-input changes no longer close the picker and save
part of the time. Removing time preserves the scheduled date and deadline.
The calendar exposes time on demand. Reminder and recurrence explanations
were removed from task properties; selected values retain the actual state.
Date, deadline, duration, recurrence, reminders and collaboration remain intact.

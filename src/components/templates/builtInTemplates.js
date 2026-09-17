import { format } from 'date-fns';

// Built-in note templates as Markdown. A new note stores the Markdown and the
// editor converts it to blocks when it first opens (see useLegacyContent).
// Placeholders: {{date}} (e.g. 17 September 2026), {{isoDate}}, {{weekday}}.

export const BUILT_IN_TEMPLATES = [
  {
    id: 'builtin-supervision',
    name: 'Supervision meeting',
    description: 'Agenda, discussion, decisions and actions for a meeting with your supervisor.',
    noteName: 'Supervision meeting – {{date}}',
    markdown: `**Date:** {{date}}
**Attendees:**

## Agenda
- Progress since last meeting
-

## Progress since last meeting
-

## Discussion
-

## Decisions
-

## Action items
- [ ] Send meeting notes to supervisor
- [ ] Agree date of next meeting

## Questions for next time
-

## Next meeting
`,
  },
  {
    id: 'builtin-paper-summary',
    name: 'Paper summary',
    description: 'A structured one-page summary of a single paper.',
    noteName: 'Paper summary',
    markdown: `**Citation:**
**Read on:** {{date}}

## Research question

## Method
- Design:
- Sample / data:
- Analysis:

## Key findings
1.
2.
3.

## Strengths

## Limitations

## Relevance to my research

## Quotes worth keeping
>
`,
  },
  {
    id: 'builtin-reading-notes',
    name: 'Reading notes',
    description: 'Running notes while reading a book chapter or set of papers.',
    noteName: 'Reading notes – {{date}}',
    markdown: `**Source:**
**Date:** {{date}}

## Why I'm reading this

## Notes
-

## Key concepts
- **Term:** definition

## Connections to other work
-

## Follow-up reading
- [ ] Add cited sources to the reading list
`,
  },
  {
    id: 'builtin-experiment-log',
    name: 'Experiment / fieldwork log',
    description: 'Record one session of an experiment, study or field visit.',
    noteName: 'Log – {{date}}',
    markdown: `**Date:** {{weekday}}, {{date}}
**Location / setup:**
**Participants / samples:**

## Aim of this session

## Procedure
1.
2.

## Observations
-

## Data collected
-

## Problems and deviations
-

## Reflections

## Next steps
- [ ] Back up the data from this session
`,
  },
  {
    id: 'builtin-chapter-plan',
    name: 'Chapter plan',
    description: 'Argument, structure and word budget for a thesis chapter.',
    noteName: 'Chapter plan',
    markdown: `**Working title:**
**Target length:** words
**Draft due:**

## Purpose of this chapter

## Main argument

## Structure
### 1. Introduction
-

### 2.
-

### 3.
-

### Conclusion
-

## Key sources
-

## Open questions
-

## Progress
- [ ] Outline
- [ ] First draft
- [ ] Supervisor feedback
- [ ] Revised draft
`,
  },
  {
    id: 'builtin-weekly-reflection',
    name: 'Weekly reflection',
    description: 'Look back on the week and plan the next one.',
    noteName: 'Week of {{date}}',
    markdown: `**Week of {{date}}**

## What went well

## What was difficult

## What I learned

## Progress on goals
- [ ] Goal for this week

## Priorities for next week
1.
2.
3.

## Wellbeing check
- Energy:
- Balance:
`,
  },
  {
    id: 'builtin-conference',
    name: 'Conference / workshop notes',
    description: 'Talks, people and ideas from a conference or workshop.',
    noteName: 'Conference notes – {{date}}',
    markdown: `**Event:**
**Date:** {{date}}
**Location:**

## Sessions attended
### Talk title – Speaker
- Key points:
- Questions raised:

## People to follow up with
- **Name** (affiliation) – topic

## Ideas for my research
-

## Papers to read
- [ ] Add papers mentioned in talks to the reading list

## Actions
- [ ] Email new contacts
`,
  },
];

export function fillPlaceholders(text, date = new Date()) {
  return String(text ?? '')
    .replaceAll('{{date}}', format(date, 'd MMMM yyyy'))
    .replaceAll('{{isoDate}}', format(date, 'yyyy-MM-dd'))
    .replaceAll('{{weekday}}', format(date, 'EEEE'));
}

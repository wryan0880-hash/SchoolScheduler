# SchoolScheduler notes

## How to run

1. Make sure the server-only key settings are in `server/.env`.
2. Run this one command from the project folder:

```text
npm start
```

3. Open <http://localhost:3000> in a browser. Do not double-click `public/index.html`; the AI server is available only through the local URL.

The AI key is fetched only through the server-only `getKey()` in `server/getKey.js`. The page never receives or prints the AI key or `KEYGEN_TOKEN`. The model is `gpt-5.6-luna`. Use `getKey({ force: true })` after OpenAI reports that a cached key is invalid.

## What’s done in Version 1

- Organize mode sends a student’s tasks to the real AI and returns a suggested order.
- Adding a new task automatically asks the AI for an updated order when a plan already exists.
- Every planned task includes a short explanation for its position.
- Talk mode answers school questions with safety guidance and source reminders.
- The OpenAI request uses `gpt-5.6-luna`-compatible defaults so both modes can answer successfully.
- “Thinking…” appears and the active AI button is disabled while waiting.
- Sample tasks are included; no real people are used.
- Tasks and the latest plan save in the browser using `public/storage.js`.
- Saves on this computer only for now.
- `.env` files are ignored by Git.

## MVP check

1. Enter tasks and click “Organize my tasks”: works; check that numbered plan cards appear.
2. Add a new task in the left panel after a plan exists: works; check that the plan refreshes.
3. Read the explanation under each planned task: works; check that every card has a reason.
4. Switch to Talk, ask a school question, and click “Ask SchoolScheduler”: works when the AI service is reachable; check for a fact-first answer and source reminder.

## Maybe Later

- Let the user see a warning that the AI is not always accurate.
- Add a due date and time to each task.
- Let the user enter how long each task should take.
- Add breaks, meals, and sleep so the plan stays healthy.
- Let the user move a task by hand if they disagree with the order.
- Let the user mark tasks done to remove them from the list.
- Show the day as a timeline with start times.
- Save the task list on the device for tomorrow.

## Save point

The Version 1 implementation is ready to run and verify locally. Push the save point to GitHub after the local test passes.

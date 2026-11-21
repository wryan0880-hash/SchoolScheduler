const STORAGE_KEY = 'schoolscheduler-state-v1';

const SAMPLE_TASKS = [
  { id: 'sample-math', text: 'Finish 8 math practice problems' },
  { id: 'sample-science', text: 'Add notes to the science project' },
  { id: 'sample-reading', text: 'Read 10 pages for English' },
];

function getDefaultState() {
  return { tasks: SAMPLE_TASKS.map((task) => ({ ...task })), plan: null };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.tasks)) return { ...getDefaultState(), ...saved };
  } catch (_) {
    // A broken local save should never stop the planner from opening.
  }
  return getDefaultState();
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

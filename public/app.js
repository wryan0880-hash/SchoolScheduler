let state = loadState();
let currentMode = 'organize';
const isFilePage = window.location.protocol === 'file:';
const apiEndpoint = isFilePage ? 'http://localhost:3000/api/ai' : '/api/ai';

const taskList = document.querySelector('#taskList');
const taskCount = document.querySelector('#taskCount');
const taskInput = document.querySelector('#taskInput');
const newTask = document.querySelector('#newTask');
const resultArea = document.querySelector('#resultArea');
const modeHeading = document.querySelector('#modeHeading');

function makeId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderTaskList() {
  taskCount.textContent = state.tasks.length;
  taskList.innerHTML = state.tasks.length
    ? state.tasks.map((task) => `<div class="task-row"><span class="task-dot"></span><span class="task-name">${escapeHtml(task.text)}</span><button class="remove-task" data-id="${task.id}" title="Remove task" aria-label="Remove ${escapeHtml(task.text)}">×</button></div>`).join('')
    : '<div class="task-list-empty">No tasks yet. Add one below.</div>';
  taskList.querySelectorAll('.remove-task').forEach((button) => button.addEventListener('click', () => {
    state.tasks = state.tasks.filter((task) => task.id !== button.dataset.id);
    state.plan = null;
    saveState(state); renderTaskList(); syncInputFromTasks(); showEmpty('Task removed. Add it back or organize a new plan.');
  }));
}

function syncInputFromTasks() {
  taskInput.value = state.tasks.map((task) => task.text).join('\n');
}

function syncTasksFromInput() {
  const texts = taskInput.value.split(/\r?\n/).map((text) => text.trim()).filter(Boolean);
  state.tasks = texts.map((text, index) => ({ id: state.tasks[index]?.id || makeId(), text }));
  saveState(state); renderTaskList();
  return state.tasks;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function showEmpty(message = 'Ask SchoolScheduler to sort your tasks. You’ll see the order and the reason behind every choice.') {
  resultArea.innerHTML = `<div class="result-empty"><div class="empty-orbit"><span>✦</span></div><h3>Your plan will show up here</h3><p>${escapeHtml(message)}</p></div>`;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.querySelector('span:first-child').textContent = busy ? 'Thinking…' : (button.id === 'talkButton' ? 'Ask SchoolScheduler' : 'Organize my tasks');
}

async function askAI(payload, button) {
  setBusy(button, true);
  resultArea.innerHTML = '<div class="thinking"><div class="thinking-spinner"></div><strong>Thinking…</strong><span>Finding a helpful next step for you.</span></div>';
  try {
    const response = await fetch(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'I could not answer right now. Please check your internet connection and try again.');
    return data;
  } catch (error) {
    resultArea.innerHTML = `<div class="error-box"><span class="error-icon">!</span><div><strong>That didn’t work this time.</strong><p>${escapeHtml(error.message)}</p></div></div>`;
    return null;
  } finally { setBusy(button, false); }
}

function renderPlan(plan) {
  const plannedTasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  resultArea.innerHTML = `<div class="result-header"><div><div class="section-label">Your suggested order</div><h3>${escapeHtml(plan.summary || 'A clear next step for your schoolwork.')}</h3></div><span class="ai-badge">AI plan</span></div><div class="plan-list">${plannedTasks.map((task, index) => `<article class="plan-card"><div class="plan-number">${index + 1}</div><div class="plan-content"><div class="plan-title-row"><h4>${escapeHtml(task.title || 'Untitled task')}</h4><span class="category ${String(task.category || '').toLowerCase()}">${escapeHtml(task.category || 'Next')}</span></div><p>${escapeHtml(task.reason || 'This is a good next step based on your list.')}</p></div></article>`).join('')}</div><div class="plan-note"><span>✦</span>${escapeHtml(plan.safetyNote || 'Check the plan against your real deadlines and energy.')}</div>`;
}

function renderTalk(answer) {
  resultArea.innerHTML = `<div class="result-header"><div><div class="section-label">SchoolScheduler says</div><h3>A clear answer, with room to check</h3></div><span class="ai-badge">AI answer</span></div><div class="talk-answer">${formatAnswer(answer)}</div><div class="plan-note"><span>✦</span>For important facts, follow the source links and ask a trusted adult or teacher if you are unsure.</div>`;
}

function formatAnswer(answer) {
  return escapeHtml(answer || 'I do not have an answer yet.').split(/\n\n|\n/).filter(Boolean).map((paragraph) => `<p>${paragraph}</p>`).join('');
}

document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => {
  currentMode = button.dataset.mode;
  document.querySelectorAll('.mode').forEach((item) => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', item === button ? 'true' : 'false'); });
  document.querySelector('#organizeView').classList.toggle('hidden', currentMode !== 'organize');
  document.querySelector('#talkView').classList.toggle('hidden', currentMode !== 'talk');
  modeHeading.textContent = currentMode === 'organize' ? 'Organize your tasks' : 'Talk it through';
}));

document.querySelector('#organizeButton').addEventListener('click', async () => {
  const tasks = syncTasksFromInput();
  if (!tasks.length) return showEmpty('Add at least one task before you organize.');
  const data = await askAI({ mode: 'organize', tasks }, document.querySelector('#organizeButton'));
  if (data?.plan) { state.plan = data.plan; saveState(state); renderPlan(data.plan); }
});

document.querySelector('#talkButton').addEventListener('click', async () => {
  const message = document.querySelector('#questionInput').value.trim();
  if (!message) return showEmpty('Type a question before you ask SchoolScheduler.');
  const data = await askAI({ mode: 'talk', message }, document.querySelector('#talkButton'));
  if (data?.answer) renderTalk(data.answer);
});

async function addTask() {
  const text = newTask.value.trim();
  if (!text) return;
  state.tasks.push({ id: makeId(), text }); newTask.value = ''; saveState(state); renderTaskList(); syncInputFromTasks();
  if (state.plan) {
    const data = await askAI({ mode: 'organize', tasks: state.tasks }, document.querySelector('#organizeButton'));
    if (data?.plan) { state.plan = data.plan; saveState(state); renderPlan(data.plan); }
  } else showEmpty('New task added. Organize your list to see the best order.');
}

document.querySelector('#addTask').addEventListener('click', addTask);
newTask.addEventListener('keydown', (event) => { if (event.key === 'Enter') addTask(); });
document.querySelector('#sampleTasks').addEventListener('click', () => { state = getDefaultState(); saveState(state); renderTaskList(); syncInputFromTasks(); showEmpty('Sample tasks loaded. Organize them to see the AI plan.'); });

renderTaskList(); syncInputFromTasks();
if (state.plan) renderPlan(state.plan);

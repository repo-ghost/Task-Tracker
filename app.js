(() => {
  'use strict';
  const STORAGE_KEY = 'daylist.tasks.v1';
  const $ = (selector) => document.querySelector(selector);
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dateOffset = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date); };
  const id = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const starterTasks = () => [
    { id: id(), title: 'Plan the week ahead', notes: 'A fresh week, a fresh start. Make a little plan for what matters.', label: 'Work', date: dateOffset(0), color: 'peach', completed: false, createdAt: Date.now() - 3000 },
    { id: id(), title: 'Take a moment for yourself', notes: 'A little reminder to slow down and do something just for you.', label: 'Personal', date: dateOffset(1), color: 'green', completed: false, createdAt: Date.now() - 2000 },
    { id: id(), title: 'Write down that idea', notes: 'The good ideas deserve a place to land. This is an example task.', label: 'Ideas', date: '', color: 'purple', completed: false, createdAt: Date.now() - 1000 }
  ];
  let tasks = [];
  let storageAvailable = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      tasks = starterTasks();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } else {
      const parsed = JSON.parse(stored);
      tasks = Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    storageAvailable = false;
    tasks = [];
  }
  let currentView = 'all';
  let layout = 'grid';
  let editingId = null;
  let toastTimer;
  const dialog = $('#task-dialog');
  const form = $('#task-form');
  const descriptions = {
    all: ['All tasks', 'Everything on your plate, all in one place.'],
    today: ['Today', 'A little focus for the day ahead.'],
    upcoming: ['Upcoming', 'A look at what’s coming up next.'],
    completed: ['Completed', 'Look at all the little wins you’ve made.'],
    Work: ['Work', 'Making space for your best work.'],
    Personal: ['Personal', 'The things that matter to you.'],
    Ideas: ['Ideas', 'A little home for your bright ideas.']
  };
  function notify(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      storageAvailable = true;
      return true;
    } catch (error) {
      storageAvailable = false;
      notify('Could not save on this device. Please check browser storage settings.');
      return false;
    }
  }
  function formattedDate(value) {
    if (!value) return 'No due date';
    if (value === localDate()) return 'Today';
    if (value === dateOffset(1)) return 'Tomorrow';
    const parts = value.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  }
  function filteredTasks() {
    const today = localDate();
    const query = $('#search').value.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      let matchesView = true;
      if (currentView === 'today') matchesView = !task.completed && task.date === today;
      else if (currentView === 'upcoming') matchesView = !task.completed && task.date && task.date > today;
      else if (currentView === 'completed') matchesView = task.completed;
      else if (['Work', 'Personal', 'Ideas'].includes(currentView)) matchesView = task.label === currentView;
      return matchesView && `${task.title} ${task.notes || ''} ${task.label || ''}`.toLowerCase().includes(query);
    });
    const sort = $('#sort').value;
    return filtered.sort((a, b) => {
      if (sort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sort === 'az') return a.title.localeCompare(b.title);
      if (sort === 'due') return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || (b.createdAt || 0) - (a.createdAt || 0);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
  function cardMarkup(task) {
    const color = ['peach', 'yellow', 'green', 'purple', 'blue'].includes(task.color) ? task.color : 'green';
    const overdue = task.date && task.date < localDate() && !task.completed;
    return `<article class="task-card ${color}${task.completed ? ' completed' : ''}" data-id="${escapeHTML(task.id)}">
      <div class="card-top"><span class="card-label">${escapeHTML(task.label)}</span><div class="card-actions"><button type="button" data-action="edit" aria-label="Edit ${escapeHTML(task.title)}" title="Edit task">${icon('edit')}</button><button type="button" data-action="delete" aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">${icon('trash')}</button></div></div>
      <h3>${escapeHTML(task.title)}</h3><p>${escapeHTML(task.notes || '')}</p>
      <div class="card-bottom"><span class="due${overdue ? ' overdue' : ''}">${icon('calendar')} ${escapeHTML(formattedDate(task.date))}${overdue ? ' · Overdue' : ''}</span><button class="complete-button" type="button" data-action="toggle" aria-label="${task.completed ? 'Mark as not completed' : 'Mark as completed'}: ${escapeHTML(task.title)}"><span class="check-box">${task.completed ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>' : ''}</span>${task.completed ? 'Done' : 'Mark done'}</button></div>
    </article>`;
  }
  function render() {
    const done = tasks.filter((task) => task.completed).length;
    const todayCount = tasks.filter((task) => !task.completed && task.date === localDate()).length;
    $('#stat-total').textContent = tasks.length;
    $('#stat-open').textContent = tasks.length - done;
    $('#stat-done').textContent = done;
    $('#count-all').textContent = tasks.length;
    $('#count-today').textContent = todayCount;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    $('#progress-text').textContent = `${percent}%`;
    $('#progress-bar').style.width = `${percent}%`;
    const [title, description] = descriptions[currentView];
    $('#breadcrumb-current').textContent = title;
    $('#view-title').firstChild.textContent = `${title} `;
    $('#view-description').textContent = description;
    document.querySelectorAll('.nav-item').forEach((button) => {
      const active = button.dataset.view === currentView;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    const visible = filteredTasks();
    $('#title-count').textContent = visible.length;
    const grid = $('#task-grid');
    grid.classList.toggle('list-layout', layout === 'list');
    grid.innerHTML = visible.map(cardMarkup).join('');
    const searching = Boolean($('#search').value.trim());
    const empty = $('#empty-state');
    empty.hidden = visible.length > 0;
    if (!visible.length) {
      $('#empty-title').textContent = searching ? 'No tasks found.' : currentView === 'completed' ? 'Little wins go here.' : 'A fresh start looks good on you.';
      $('#empty-description').textContent = searching ? 'Try a different search to find what you’re looking for.' : currentView === 'completed' ? 'Complete a task and celebrate your progress.' : 'Nothing here right now. Add a task and make a little progress today.';
      $('#empty-add').hidden = searching || currentView === 'completed';
    } else if (!searching && currentView !== 'completed') {
      grid.insertAdjacentHTML('beforeend', `<button type="button" class="add-card" data-action="add"><span>${icon('plus')}</span> Add a new task</button>`);
    }
  }
  function openDialog(task = null) {
    editingId = task ? task.id : null;
    form.reset();
    $('#task-name').setCustomValidity('');
    $('#dialog-title').textContent = task ? 'Edit task' : 'New task';
    $('#save-task').innerHTML = `${task ? 'Save changes' : 'Create task'} ${icon('arrow')}`;
    if (task) {
      $('#task-name').value = task.title;
      $('#task-notes').value = task.notes || '';
      $('#task-label').value = task.label;
      $('#task-date').value = task.date || '';
      const radio = document.querySelector(`input[name="color"][value="${CSS.escape(task.color)}"]`);
      if (radio) radio.checked = true;
    } else if (['Work', 'Personal', 'Ideas'].includes(currentView)) {
      $('#task-label').value = currentView;
    } else if (currentView === 'today') {
      $('#task-date').value = localDate();
    }
    dialog.showModal();
    $('#task-name').focus();
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('#task-name').value.trim();
    if (!title) { $('#task-name').setCustomValidity('Please enter a task name.'); $('#task-name').reportValidity(); return; }
    const details = { title, notes: $('#task-notes').value.trim(), label: $('#task-label').value, date: $('#task-date').value, color: form.elements.color.value };
    const existing = tasks.find((task) => task.id === editingId);
    if (existing) Object.assign(existing, details);
    else tasks.push({ id: id(), ...details, completed: false, createdAt: Date.now() });
    const saved = save();
    dialog.close();
    render();
    if (saved) notify(existing ? 'Task updated.' : 'Task added. You’ve got this!');
  });
  $('#task-name').addEventListener('input', () => $('#task-name').setCustomValidity(''));
  $('#close-dialog').addEventListener('click', () => dialog.close());
  $('#cancel-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  ['#new-task-top', '#new-task-section', '#empty-add'].forEach((selector) => $(selector).addEventListener('click', () => openDialog()));
  $('#task-grid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'add') { openDialog(); return; }
    const task = tasks.find((item) => item.id === button.closest('.task-card')?.dataset.id);
    if (!task) return;
    if (button.dataset.action === 'edit') openDialog(task);
    if (button.dataset.action === 'toggle') {
      task.completed = !task.completed;
      const saved = save(); render();
      if (saved) notify(task.completed ? 'A little win! Task completed.' : 'Task moved back to your list.');
    }
    if (button.dataset.action === 'delete' && window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
      tasks = tasks.filter((item) => item.id !== task.id);
      const saved = save(); render();
      if (saved) notify('Task deleted.');
    }
  });
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => { currentView = button.dataset.view; $('#search').value = ''; render(); }));
  $('#search').addEventListener('input', render);
  $('#sort').addEventListener('change', render);
  ['grid', 'list'].forEach((type) => $(`#${type}-view`).addEventListener('click', () => {
    layout = type;
    ['grid', 'list'].forEach((item) => { const button = $(`#${item}-view`); button.classList.toggle('selected', item === type); button.setAttribute('aria-pressed', String(item === type)); });
    render();
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    try { tasks = event.newValue ? JSON.parse(event.newValue) : []; if (!Array.isArray(tasks)) tasks = []; render(); } catch (_) { /* Ignore malformed updates. */ }
  });
  $('#top-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  render();
  if (!storageAvailable) notify('Browser storage is unavailable. Changes may not be saved.');
})();

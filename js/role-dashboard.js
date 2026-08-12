const roleApp = document.querySelector('#roleApp');
const storedProfile = JSON.parse(sessionStorage.getItem('eventflowUser') || 'null');
const role = storedProfile?.role || sessionStorage.getItem('eventflowDemoRole') || 'participant';
if (role === 'admin') window.location.replace('admin.html');
const volunteerProfile = {
  uid: storedProfile?.uid || sessionStorage.getItem('eventflowDemoEmail') || 'demo-volunteer',
  name: storedProfile?.name || 'Rahul',
  email: storedProfile?.email || 'volunteer@eventflow.demo',
  role: 'volunteer',
  department: storedProfile?.department || 'Marketing',
  eventId: storedProfile?.eventId || 'pulzion',
  eventName: storedProfile?.eventName || 'Pulzion 2027',
  eventMeta: storedProfile?.eventMeta || 'Pulzion 2027 · 28 Aug — 30 Aug 2027'
};
const participant = { name: storedProfile?.name || 'Rahul Kadam', email: storedProfile?.email || 'rahul.participant@eventflow.demo', initials: 'RK', label: '' };
const progressStorageKey = `eventflowProgress:${volunteerProfile.uid}:${volunteerProfile.eventId}`;
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let tasks = [];
const savedProgress = readJson(progressStorageKey, null);
let departmentProgress = savedProgress?.progressPercentage ?? 0;
let participantEvents = [];
let participantEventsLoading = false;
let participantEventsError = '';
let firestoreServices;
let taskUnsubscribe;
const participantRegistrationKey = `eventflowParticipantRegistrations:${participant.email}`;
let participantRegisteredIds = readJson(participantRegistrationKey, []);
let participantTab = 'events';
let participantScreen = 'workspace';
let participantEventId = null;
let participantSearch = '';
const today = new Date();
let participantCalendarDate = { year: today.getFullYear(), month: today.getMonth() };
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

// ─── QR / Scanner State ────────────────────────────────────────────────────
let volunteerScreen = 'dashboard'; // 'dashboard' | 'scanner'
let qrScannerInstance = null;
let scannerPaused = false;
let sessionScanLog = []; // { token, name, event, action, time }[]
const qrTokenKey = (eventId) => `eventflowQrToken:${participant.email}:${eventId}`;
const feedbackStorageKey = `eventflowFeedbackSubmitted:${storedProfile?.uid || participant.email}`;
let feedbackSubmittedIds = new Set(readJson(feedbackStorageKey, []));
let feedbackPromptedIds = new Set();
let checkoutFeedbackUnsubscribe;

const initials = (name) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const volunteerCompletedCount = () => tasks.filter((task) => task.completed).length;
const volunteerProgress = () => tasks.length ? Math.round((volunteerCompletedCount() / tasks.length) * 100) : 0;
const volunteerReports = () => readJson('eventflowProgressReports', []).filter((report) => report.eventId === volunteerProfile.eventId && report.volunteerId === volunteerProfile.uid).sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

const user = role === 'volunteer'
  ? { name: volunteerProfile.name, initials: initials(volunteerProfile.name), label: 'Volunteer workspace', heading: 'Your event, in motion.', subheading: 'Keep your assignments moving and share progress with the team.' }
  : participant;
document.querySelector('#userAvatar').textContent = user.initials;
document.querySelector('#userName').textContent = user.name;
document.querySelector('#userRole').textContent = user.label;
document.title = `${user.label} — EventFlow`;

const showToast = (message) => { const toast = document.createElement('div'); toast.className = 'role-toast'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2600); };

const getFirestoreServices = async () => {
  if (firestoreServices) return firestoreServices;
  const config = window.EVENTFLOW_FIREBASE_CONFIG || {};
  if (!config.apiKey) return null;
  const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  const app = initializeApp(config);
  firestoreServices = { auth: authSdk.getAuth(app), db: firestoreSdk.getFirestore(app), ...authSdk, ...firestoreSdk };
  return firestoreServices;
};

const getInitialAuthUser = (services) => new Promise((resolve) => {
  const unsubscribe = services.onAuthStateChanged(services.auth, (user) => {
    unsubscribe();
    resolve(user);
  });
});

const bootstrapVolunteerSession = async () => {
  if (role === 'participant') return true;
  if (role !== 'volunteer') return false;
  try {
    const services = await getFirestoreServices();
    if (!services) return true;
    const user = await getInitialAuthUser(services);
    if (!user || user.uid !== storedProfile?.uid) throw new Error('Your session has expired.');
    const profile = await services.getDoc(services.doc(services.db, 'users', user.uid));
    if (!profile.exists() || profile.data().role !== role) throw new Error('Workspace access is not assigned.');
    return true;
  } catch { window.location.replace('team-login.html'); return false; }
};

const subscribeToFirestoreTasks = async () => {
  let services;
  try { services = await getFirestoreServices(); } catch { return; }
  if (!services) return;
  try {
    const assignmentQuery = services.query(services.collection(services.db, `events/${volunteerProfile.eventId}/volunteers`), services.where('email', '==', volunteerProfile.email));
    const assignmentSnapshot = await services.getDocs(assignmentQuery);
    const assignment = assignmentSnapshot.docs[0]?.data();
    if (assignment) {
      volunteerProfile.name = assignment.name || volunteerProfile.name;
      volunteerProfile.department = assignment.department || volunteerProfile.department;
      volunteerProfile.email = assignment.email || volunteerProfile.email;
      render();
    }
    taskUnsubscribe?.();
    const taskQuery = services.query(services.collection(services.db, 'tasks'), services.where('assignedEmail', '==', String(volunteerProfile.email).trim().toLowerCase()));
    taskUnsubscribe = services.onSnapshot(taskQuery, (snapshot) => {
      tasks = snapshot.docs.map((item) => ({ id:item.id, eventId:item.data().eventId, title:item.data().title || 'Assigned task', due:item.data().dueDate || 'Date to be decided', department:item.data().department || volunteerProfile.department, completed:Boolean(item.data().completed) })).filter((task) => task.eventId === volunteerProfile.eventId);
      render();
    });
  } catch { }
};

const mapParticipantEvent = (id, data) => ({
  id,
  name: data.eventName || data.name || '',
  visibility: data.visibility || 'private',
  cardTheme: data.cardTheme || 'harbor',
  coverImage: data.coverImage || data.imageUrl || data.bannerUrl || data.posterUrl || '',
  category: data.eventCategory || data.type || 'Event',
  date: data.date || [data.startDate, data.endDate].filter(Boolean).join(' – ') || 'Date to be announced',
  time: data.time || [data.startTime, data.endTime].filter(Boolean).join(' – ') || 'Time to be announced',
  timezone: data.timezone || 'Timezone to be announced',
  location: data.venue || 'Venue to be announced',
  address: data.address || data.venue || 'Address to be announced',
  organizer: data.organizer || 'EventFlow organizer',
  contact: [data.contactEmail, data.contactPhone].filter(Boolean).join(' · ') || 'Contact details to be announced',
  website: data.website || '—',
  description: data.shortDescription || data.description || 'Details will be shared by the organizer.',
  detailedDescription: data.detailedDescription || data.shortDescription || data.description || 'Details will be shared by the organizer.',
  schedule: Array.isArray(data.schedule) ? data.schedule : [],
  feedback: data.feedback || { enabled: false, categories: [], questions: {} }
});
const isDisplayableParticipantEvent = (event) => event.id
  && event.name
  && event.name.trim().toLowerCase() !== 'untitled event'
  && event.visibility === 'public';

const getStoredLocalEvents = () => {
  try {
    const list = JSON.parse(localStorage.getItem('eventflowEvents') || '[]');
    return Array.isArray(list) ? list.map((item) => mapParticipantEvent(item.id, item)) : [];
  } catch {
    return [];
  }
};

const loadParticipantEvents = async () => {
  participantEventsError = '';
  participantEventsLoading = true;

  const localEvents = getStoredLocalEvents();
  const eventsMap = new Map();
  localEvents.forEach((event) => {
    if (isDisplayableParticipantEvent(event)) eventsMap.set(String(event.id), event);
  });

  participantEvents = Array.from(eventsMap.values());
  render();

  try {
    const services = await getFirestoreServices();
    if (services) {
      let docs = [];
      try {
        const publicQuery = services.query(
          services.collection(services.db, 'events'),
          services.where('visibility', '==', 'public')
        );
        const snapshot = await services.getDocs(publicQuery);
        docs = snapshot.docs;
      } catch {
        const snapshot = await services.getDocs(services.collection(services.db, 'events'));
        docs = snapshot.docs;
      }

      const remotePublicEvents = docs
        .map((item) => mapParticipantEvent(item.id, item.data()))
        .filter(isDisplayableParticipantEvent);

      remotePublicEvents.forEach((event) => {
        eventsMap.set(String(event.id), event);
      });

      participantEvents = Array.from(eventsMap.values());

      if (storedProfile?.uid) {
        try {
          const registrationsSnapshot = await services.getDocs(
            services.query(
              services.collection(services.db, 'participantRegistrations'),
              services.where('participantId', '==', storedProfile.uid)
            )
          );
          const remoteRegs = registrationsSnapshot.docs.map((item) => item.data().eventId).filter(Boolean);
          participantRegisteredIds = [...new Set([...participantRegisteredIds, ...remoteRegs])];
          saveJson(participantRegistrationKey, participantRegisteredIds);
        } catch { }
      }
    }
  } catch (error) {
    participantEventsError = error?.message || 'Please check your connection and try again.';
  } finally {
    participantEventsLoading = false;
    render();
    subscribeToCheckoutFeedback();
  }
};

const cloneTemplate = (id) => document.getElementById(id).content.cloneNode(true);
const firstTemplateElement = (id) => cloneTemplate(id).firstElementChild;
const setText = (root, selector, value) => {
  const element = root.querySelector(selector);
  if (element) element.textContent = value ?? '';
  return element;
};
const appendEmptyState = (container, title, text, action = null) => {
  const emptyState = firstTemplateElement('participantEmptyTemplate');
  setText(emptyState, '[data-empty-field="title"]', title);
  setText(emptyState, '[data-empty-field="text"]', text);
  const actionButton = emptyState.querySelector('[data-empty-action]');
  if (action) {
    actionButton.hidden = false;
    actionButton.textContent = action.label;
    Object.entries(action.dataset || {}).forEach(([key, value]) => { actionButton.dataset[key] = value; });
  }
  container.append(emptyState);
};

const openProgressModal = () => {
  document.body.append(cloneTemplate('progressReportTemplate'));
  document.querySelector('#progressPercentage').value = departmentProgress;
  document.querySelector('#progressReportText').focus();
};
const closeProgressModal = () => document.querySelector('.role-modal-backdrop')?.remove();
const feedbackResponseId = (eventId) => `${eventId}_${storedProfile?.uid || participant.email}`.replace(/[^a-zA-Z0-9_-]/g, '_');
const closeFeedbackModal = () => document.querySelector('.feedback-modal-backdrop')?.remove();
const feedbackRatingMarkup = (category, index) => `<fieldset class="feedback-rating"><legend>${escapeHtml(category)}</legend><div class="feedback-rating__choices">${[1, 2, 3, 4, 5].map((rating) => `<label><input type="radio" name="feedback-rating-${index}" value="${rating}" required><span>${rating}</span></label>`).join('')}</div><small>1 = poor · 5 = excellent</small></fieldset>`;
const openFeedbackModal = (event) => {
  if (document.querySelector('.feedback-modal-backdrop')) return;
  const config = event.feedback || {};
  const categories = Array.isArray(config.categories) ? config.categories.filter(Boolean) : [];
  if (!categories.length) return;
  const mostLiked = config.questions?.mostLiked || 'What did you like most about this event?';
  const improvement = config.questions?.improvement || 'What could we improve for next time?';
  const modal = document.createElement('div');
  modal.className = 'feedback-modal-backdrop';
  modal.innerHTML = `<section class="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedbackModalTitle"><button type="button" class="feedback-modal__close" data-close-feedback aria-label="Close feedback form">×</button><div class="feedback-modal__head"><p class="eyebrow">Your event feedback</p><h2 id="feedbackModalTitle">How was ${escapeHtml(event.name)}?</h2><p>You’ve checked out—your feedback helps the organizers make the next event even better.</p></div><form id="participantFeedbackForm" data-event-id="${escapeHtml(event.id)}"><div class="feedback-ratings">${categories.map(feedbackRatingMarkup).join('')}</div><label class="feedback-text-question"><span>${escapeHtml(mostLiked)}</span><textarea name="mostLiked" rows="3" maxlength="1000" required></textarea></label><label class="feedback-text-question"><span>${escapeHtml(improvement)}</span><textarea name="improvement" rows="3" maxlength="1000" required></textarea></label><div class="feedback-modal__actions"><button type="button" class="button button--ghost" data-close-feedback>Maybe later</button><button type="submit" class="button button--teal">Submit feedback →</button></div></form></section>`;
  document.body.append(modal);
  modal.querySelector('input')?.focus();
};
const maybePromptFeedback = async (registration) => {
  if (registration.status !== 'CHECKED_OUT') return;
  const event = participantEvents.find((item) => item.id === registration.eventId);
  const config = event?.feedback;
  if (!config?.enabled || !Array.isArray(config.categories) || !config.categories.length) return;
  const key = String(registration.eventId);
  if (feedbackSubmittedIds.has(key) || feedbackPromptedIds.has(key)) return;
  feedbackPromptedIds.add(key);
  try {
    const services = await getFirestoreServices();
    if (services) {
      const priorResponse = await services.getDoc(services.doc(services.db, 'eventFeedback', feedbackResponseId(registration.eventId)));
      if (priorResponse.exists()) {
        feedbackSubmittedIds.add(key);
        saveJson(feedbackStorageKey, [...feedbackSubmittedIds]);
        return;
      }
    }
  } catch { /* Let the participant submit when the connection recovers. */ }
  openFeedbackModal(event);
};
const subscribeToCheckoutFeedback = async () => {
  if (role !== 'participant' || !storedProfile?.uid || checkoutFeedbackUnsubscribe) return;
  try {
    const services = await getFirestoreServices();
    if (!services) return;
    const registrationsQuery = services.query(
      services.collection(services.db, 'registrations'),
      services.where('participantId', '==', storedProfile.uid)
    );
    checkoutFeedbackUnsubscribe = services.onSnapshot(registrationsQuery, (snapshot) => {
      snapshot.docs.forEach((item) => maybePromptFeedback(item.data()));
    }, (error) => console.warn('Feedback checkout listener note:', error.message));
  } catch (error) {
    console.warn('Could not subscribe to checkout feedback:', error.message);
  }
};
const saveProgressReport = async (progressPercentage, reportText) => {
  const report = { eventId: volunteerProfile.eventId, eventName: volunteerProfile.eventName, department: volunteerProfile.department, volunteerId: volunteerProfile.uid, volunteerName: volunteerProfile.name, volunteerEmail: volunteerProfile.email, progressPercentage, reportText, createdAt: new Date().toISOString() };
  const reports = readJson('eventflowProgressReports', []);
  reports.unshift(report);
  saveJson('eventflowProgressReports', reports);
  saveJson(progressStorageKey, { ...report, updatedAt: new Date().toISOString() });
  try {
    const services = await getFirestoreServices();
    if (services) await services.addDoc(services.collection(services.db, 'progressReports'), { ...report, createdAt: services.serverTimestamp() });
  } catch { }
  departmentProgress = progressPercentage;
};

const createVolunteerTask = (task) => {
  const taskElement = firstTemplateElement('volunteerTaskTemplate');
  const input = taskElement.querySelector('input');
  input.dataset.taskId = task.id;
  input.checked = task.completed;
  taskElement.classList.toggle('is-completed', task.completed);
  setText(taskElement, '[data-task-field="title"]', task.title);
  setText(taskElement, '[data-task-field="meta"]', `Due ${task.due} · ${task.department}`);
  setText(taskElement, '[data-task-field="status"]', task.completed ? 'Completed' : 'Pending');
  return taskElement;
};
const createProgressReport = (report) => {
  const reportElement = firstTemplateElement('progressReportItemTemplate');
  setText(reportElement, '[data-report-field="progress"]', `${report.progressPercentage}% progress`);
  setText(reportElement, '[data-report-field="date"]', new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }));
  setText(reportElement, '[data-report-field="department"]', report.department);
  setText(reportElement, '[data-report-field="text"]', `“${report.reportText}”`);
  return reportElement;
};
const volunteerView = () => {
  const completed = volunteerCompletedCount();
  const progress = volunteerProgress();
  const reports = volunteerReports();
  const view = firstTemplateElement('volunteerTemplate');
  const remaining = Math.max(tasks.length - completed, 0);
  setText(view, '[data-volunteer-field="task-count"]', tasks.length);
  setText(view, '[data-volunteer-field="completed-count"]', completed);
  setText(view, '[data-volunteer-field="progress"]', `${progress}%`);
  setText(view, '[data-volunteer-field="event-name"]', volunteerProfile.eventName);
  setText(view, '[data-volunteer-field="department"]', `${volunteerProfile.department} Department`);
  setText(view, '[data-volunteer-field="event-meta"]', volunteerProfile.eventMeta);
  setText(view, '[data-volunteer-field="department-progress"]', `${departmentProgress}%`);
  setText(view, '[data-volunteer-field="task-remaining"]', remaining ? `${remaining} to go` : 'All done');
  setText(view, '[data-volunteer-field="report-count"]', `${reports.length} ${reports.length === 1 ? 'update' : 'updates'}`);
  view.querySelector('[data-volunteer-field="personal-progress-track"]').style.width = `${progress}%`;
  view.querySelector('[data-volunteer-field="progress-track"]').style.width = `${departmentProgress}%`;
  const taskList = view.querySelector('[data-volunteer-tasks]');
  if (tasks.length) tasks.forEach((task) => taskList.append(createVolunteerTask(task)));
  else { const emptyTasks = document.createElement('p'); emptyTasks.className = 'volunteer-task-empty'; emptyTasks.textContent = 'No tasks assigned yet. Your admin will add your next task here.'; taskList.append(emptyTasks); }
  const reportList = view.querySelector('[data-volunteer-reports]');
  if (reports.length) reports.forEach((report) => reportList.append(createProgressReport(report)));
  else {
    const emptyHistory = document.createElement('p');
    emptyHistory.className = 'history-empty';
    emptyHistory.textContent = 'Your submitted progress updates will appear here.';
    reportList.append(emptyHistory);
  }
  return view;
};

const getParticipantEvent = () => participantEvents.find((event) => event.id === participantEventId) || participantEvents[0] || null;
const participantIsRegistered = (eventId) => participantRegisteredIds.includes(eventId);
const formatEventDate = (value = '') => String(value).split(' – ').map((part) => {
  const parsed = new Date(`${part}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? part : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}).join(' – ');
const parseEventDatePart = (value, fallbackYear = new Date().getFullYear()) => {
  const dateValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const parsedIso = new Date(`${dateValue}T00:00:00`);
    return Number.isNaN(parsedIso.getTime()) ? null : parsedIso;
  }
  const match = dateValue.match(/(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?/);
  if (!match) return null;
  const parsed = new Date(`${match[2]} ${match[1]}, ${match[3] || fallbackYear}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const parseEventDates = (event) => {
  const parts = String(event.date || '').split(/\s+–\s+|\s+-\s+/).filter(Boolean);
  const firstDate = parseEventDatePart(parts[0]);
  const fallbackYear = firstDate?.getFullYear() || new Date().getFullYear();
  const lastDate = parts[1] ? parseEventDatePart(parts[1], fallbackYear) : null;
  return [firstDate, lastDate].filter(Boolean);
};
const parseEventStartDate = (event) => {
  const dates = parseEventDates(event);
  return dates[0] || null;
};
const calendarMonthLabel = (date) => new Date(date.year, date.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const calendarDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const registeredCalendarDates = () => participantEvents
  .filter((event) => participantIsRegistered(event.id))
  .flatMap(parseEventDates)
  .map((date) => calendarDateKey(date.getFullYear(), date.getMonth(), date.getDate()));
const renderParticipantCalendar = (container) => {
  const { year, month } = participantCalendarDate;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const registeredDates = registeredCalendarDates();
  const currentDate = new Date();
  const currentDateKey = calendarDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const calendar = firstTemplateElement('participantCalendarTemplate');
  setText(calendar, '[data-calendar-field="month"]', calendarMonthLabel(participantCalendarDate));
  const grid = calendar.querySelector('[data-calendar-grid]');
  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - firstDay;
    const day = dayOffset < 0 ? previousMonthDays + dayOffset + 1 : dayOffset >= daysInMonth ? dayOffset - daysInMonth + 1 : dayOffset + 1;
    const cellDate = new Date(year, month, dayOffset + 1);
    const isCurrentMonth = cellDate.getMonth() === month;
    const dateKey = calendarDateKey(year, month, day);
    const isRegistered = isCurrentMonth && registeredDates.includes(dateKey);
    const isToday = isCurrentMonth && dateKey === currentDateKey;
    const dayElement = firstTemplateElement('participantCalendarDayTemplate');
    dayElement.classList.toggle('is-muted', !isCurrentMonth);
    dayElement.classList.toggle('is-registered', isRegistered);
    dayElement.classList.toggle('is-today', isToday);
    setText(dayElement, '[data-calendar-day]', day);
    dayElement.querySelector('i').hidden = !isRegistered;
    grid.append(dayElement);
  }
  container.replaceChildren(calendar);
};
const createParticipantEventCard = (event) => {
  const card = firstTemplateElement('participantEventCardTemplate');
  card.dataset.eventId = event.id;
  card.dataset.theme = event.cardTheme || 'harbor';
  if (event.coverImage) {
    const banner = document.createElement('div');
    banner.className = 'participant-event-card__banner';
    banner.innerHTML = `<img src="${event.coverImage}" alt="${escapeHtml(event.name)} cover poster">`;
    card.prepend(banner);
  }
  setText(card, '[data-event-field="category"]', event.category);
  setText(card, '[data-event-field="name"]', event.name);
  setText(card, '[data-event-field="description"]', event.description);
  setText(card, '[data-event-field="date"]', formatEventDate(event.date));
  setText(card, '[data-event-field="time"]', event.time);
  setText(card, '[data-event-field="location"]', event.location);
  return card;
};
const createParticipantPassCard = (event) => {
  const card = firstTemplateElement('participantPassCardTemplate');
  card.dataset.eventId = event.id;
  setText(card, '[data-pass-field="participant"]', participant.name);
  setText(card, '[data-pass-field="event"]', event.name);
  setText(card, '[data-pass-field="location"]', event.location);
  setText(card, '[data-pass-field="category"]', event.category);
  return card;
};
const participantWorkspaceView = () => {
  const searchTerm = participantSearch.trim().toLowerCase();
  const matchesSearch = (event) => !searchTerm || [event.name, event.category, event.location, event.description].some((value) => String(value).toLowerCase().includes(searchTerm));
  const availableEvents = participantEvents.filter(matchesSearch);
  const registeredEvents = participantEvents.filter((event) => participantIsRegistered(event.id));
  const view = firstTemplateElement('participantWorkspaceTemplate');
  setText(view, '[data-participant-field="name"]', participant.name);
  renderParticipantCalendar(view.querySelector('[data-participant-calendar]'));
  view.querySelectorAll('[data-participant-action="participant-tab"]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === participantTab));
  const search = view.querySelector('.participant-search');
  search.hidden = participantTab !== 'events';
  const searchInput = view.querySelector('#participantSearch');
  searchInput.value = participantSearch;
  const eventList = view.querySelector('[data-participant-event-list]');
  const registeredList = view.querySelector('[data-participant-registered-list]');
  eventList.hidden = participantTab !== 'events';
  registeredList.hidden = participantTab !== 'registered';
  if (participantTab === 'events') {
    if (participantEventsLoading) appendEmptyState(eventList, 'Loading events…', 'Getting the latest events from EventFlow.');
    else if (participantEventsError) appendEmptyState(eventList, 'Events could not be loaded.', participantEventsError);
    else if (availableEvents.length) availableEvents.forEach((event) => eventList.append(createParticipantEventCard(event)));
    else appendEmptyState(eventList, 'No events match your search.', 'Try a different event name, category, or venue.');
  } else if (registeredEvents.length) registeredEvents.forEach((event) => registeredList.append(createParticipantPassCard(event)));
  else appendEmptyState(registeredList, 'You haven’t registered for any events yet.', '', { label: 'Explore Events →', dataset: { participantAction: 'participant-tab', tab: 'events' } });
  return view;
};
const participantPublicEventView = () => {
  const event = getParticipantEvent();
  if (!event) return firstTemplateElement('participantUnavailableTemplate');
  const registered = participantIsRegistered(event.id);
  const view = firstTemplateElement('participantPublicDetailTemplate');
  const shell = view.querySelector('.invitation-shell');
  if (shell) shell.dataset.theme = event.cardTheme || 'harbor';
  if (event.coverImage) {
    const banner = document.createElement('div');
    banner.className = 'invitation-hero__banner';
    banner.innerHTML = `<img src="${event.coverImage}" alt="${escapeHtml(event.name)} poster banner">`;
    const kicker = view.querySelector('.invitation-kicker');
    if (kicker) kicker.before(banner);
  }
  setText(view, '[data-detail-field="category"]', event.category);
  setText(view, '[data-detail-field="name"]', event.name);
  setText(view, '[data-detail-field="description"]', event.description);
  setText(view, '[data-detail-field="organizer"]', event.organizer);
  setText(view, '[data-detail-field="date"]', formatEventDate(event.date));
  setText(view, '[data-detail-field="time"]', event.time);
  setText(view, '[data-detail-field="location"]', event.location);
  setText(view, '[data-detail-field="timezone"]', event.timezone);
  setText(view, '[data-detail-field="detailed-description"]', event.detailedDescription || event.description);
  setText(view, '[data-detail-field="address"]', event.address || event.location);
  setText(view, '[data-detail-field="organizer-secondary"]', event.organizer);
  setText(view, '[data-detail-field="contact"]', event.contact);
  setText(view, '[data-detail-field="website"]', event.website);
  setText(view, '[data-detail-field="registration-message"]', registered ? 'You’re on the guest list.' : 'We’d love to have you there.');
  setText(view, '[data-detail-field="registration-note"]', registered ? 'Your registration has been confirmed.' : 'Register now to join this event.');
  const registerButton = view.querySelector('[data-detail-action="register"]');
  registerButton.dataset.eventId = event.id;
  registerButton.textContent = registered ? 'Registered ✓' : 'Register for Event →';
  registerButton.disabled = registered;
  registerButton.classList.toggle('registered-button', registered);
  return view;
};
const participantRegisteredDetailView = () => {
  const event = getParticipantEvent();
  if (!event) return firstTemplateElement('participantUnavailableTemplate');
  const view = firstTemplateElement('participantRegisteredDetailTemplate');
  if (event.coverImage) {
    const banner = document.createElement('div');
    banner.className = 'invitation-hero__banner';
    banner.style.margin = '20px 0 0';
    banner.innerHTML = `<img src="${event.coverImage}" alt="${escapeHtml(event.name)} poster banner">`;
    const welcome = view.querySelector('.registered-welcome');
    if (welcome) welcome.append(banner);
  }
  setText(view, '[data-detail-field="name"]', event.name);

  setText(view, '[data-detail-field="date"]', formatEventDate(event.date));
  setText(view, '[data-detail-field="venue-short"]', event.location.split(',')[0]);
  const publicDetailsButton = view.querySelector('[data-participant-action="view-public-details"]');
  publicDetailsButton.dataset.eventId = event.id;
  setText(view, '[data-pass-field="participant"]', participant.name);
  setText(view, '[data-pass-field="event"]', event.name);
  setText(view, '[data-pass-field="category"]', event.category);
  setText(view, '[data-pass-field="location"]', event.location);
  const schedule = view.querySelector('[data-detail-schedule]');
  if (event.schedule.length) event.schedule.forEach((item) => {
    const scheduleItem = firstTemplateElement('scheduleItemTemplate');
    setText(scheduleItem, '[data-schedule-field="title"]', item[0]);
    setText(scheduleItem, '[data-schedule-field="meta"]', item[1]);
    schedule.append(scheduleItem);
  });
  else {
    const emptySchedule = document.createElement('p');
    emptySchedule.className = 'schedule-empty';
    emptySchedule.textContent = 'The organizer will share the event schedule soon.';
    schedule.append(emptySchedule);
  }
  // QR code is rendered post-DOM in renderParticipantQr() — do NOT call QRCode here.
  // The container #participantQrContainer will be found in the live DOM after render().

  return view;
};
const participantView = () => participantScreen === 'public-detail' ? participantPublicEventView() : participantScreen === 'registered-detail' ? participantRegisteredDetailView() : participantWorkspaceView();

// ─── Volunteer Scanner View ─────────────────────────────────────────────────
const volunteerScannerView = () => {
  const view = firstTemplateElement('volunteerScannerTemplate');
  return view;
};

// ─── Post-DOM QR Rendering ──────────────────────────────────────────────────
// MUST be called after roleApp.replaceChildren() so the canvas renders correctly.
const getOrCreateQrToken = async (eventId) => {
  // 1. Check localStorage first (fast path)
  const cached = readJson(qrTokenKey(eventId), null);
  if (cached) return cached;

  // 2. Check Firestore for an existing registration that already has a qrToken
  try {
    const services = await getFirestoreServices();
    if (services && storedProfile?.uid) {
      const pid = storedProfile.uid;
      const legacySnap = await services.getDoc(
        services.doc(services.db, 'participantRegistrations', `${pid}_${eventId}`)
      );
      if (legacySnap.exists() && legacySnap.data().qrToken) {
        const token = legacySnap.data().qrToken;
        saveJson(qrTokenKey(eventId), token);
        return token;
      }

      // 3. No token anywhere — create one now and backfill Firestore
      const newToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${pid}-${eventId}-${Date.now()}`;
      saveJson(qrTokenKey(eventId), newToken);

      const selectedEvent = participantEvents.find((e) => e.id === eventId);
      // Write canonical registrations doc
      await services.setDoc(services.doc(services.db, 'registrations', newToken), {
        qrToken: newToken,
        status: 'REGISTERED',
        checkInTime: null,
        checkOutTime: null,
        eventId,
        eventName: selectedEvent?.name || '',
        participantId: pid,
        participantName: participant.name,
        email: participant.email,
        volunteerId: null,
        timestamp: services.serverTimestamp()
      });
      // Backfill legacy collections
      try {
        await services.updateDoc(
          services.doc(services.db, 'participantRegistrations', `${pid}_${eventId}`),
          { qrToken: newToken }
        );
      } catch { /* doc may not exist yet, ignore */ }
      return newToken;
    }
  } catch (err) {
    console.warn('getOrCreateQrToken error:', err);
  }

  // 4. Offline fallback — generate local token
  const fallback = `local-${storedProfile?.uid || 'anon'}-${eventId}-${Date.now()}`;
  saveJson(qrTokenKey(eventId), fallback);
  return fallback;
};

const renderParticipantQr = async () => {
  const event = getParticipantEvent();
  if (!event) return;

  // These elements now exist in the live DOM
  const container = document.getElementById('participantQrContainer');
  const tokenLabel = document.querySelector('[data-qr-token-display]');
  if (!container) return;

  container.innerHTML = '<p class="qr-generating">Generating your QR code…</p>';

  try {
    const token = await getOrCreateQrToken(event.id);
    if (!token) throw new Error('No token available.');

    if (typeof QRCode === 'undefined') {
      container.innerHTML = '<p class="qr-generating">QR library not loaded. Refresh and try again.</p>';
      return;
    }

    // Clear placeholder and render real QR
    container.innerHTML = '';
    new QRCode(container, {
      text: token,
      width: 300,
      height: 300,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M  // M = 15% redundancy, much easier to scan than H (30%)
    });

    // qrcodejs renders BOTH a <canvas> and an <img>.
    // The <img> is a crisp PNG — better for screen display and scanning.
    // The canvas can have DPI issues on high-res screens.
    const canvas = container.querySelector('canvas');
    if (canvas) canvas.style.display = 'none'; // hide canvas
    const img = container.querySelector('img');
    if (img) {
      img.style.display = 'block';
      img.style.width = '280px';
      img.style.height = '280px';
      img.style.borderRadius = '8px';
    }

    if (tokenLabel) tokenLabel.textContent = `ID: ${token.slice(0, 8)}…`;
  } catch (err) {
    container.innerHTML = '<p class="qr-generating">QR code could not be generated.</p>';
    console.error('renderParticipantQr error:', err);
  }
};

const render = () => {
  if (role === 'volunteer' && volunteerScreen === 'scanner') {
    roleApp.replaceChildren(volunteerScannerView());
    // Mount scanner after DOM is ready
    requestAnimationFrame(() => mountQrScanner());
  } else {
    roleApp.replaceChildren(role === 'volunteer' ? volunteerView() : participantView());
    // QR code MUST be generated after the node is in the live DOM
    if (role === 'participant' && participantScreen === 'registered-detail') {
      requestAnimationFrame(() => renderParticipantQr());
    }
  }
};
render();
bootstrapVolunteerSession().then((allowed) => { if (!allowed) return; if (role === 'volunteer') subscribeToFirestoreTasks(); if (role === 'participant') loadParticipantEvents(); });

document.querySelector('#roleLogout')?.addEventListener('click', async (event) => {
  event.preventDefault();
  try { const services = await getFirestoreServices(); if (services) await services.signOut(services.auth); } catch { }
  sessionStorage.clear(); window.location.href = 'team-login.html';
});

// ─── QR Scanner Logic ───────────────────────────────────────────────────────
const destroyQrScanner = () => {
  if (qrScannerInstance) {
    try { qrScannerInstance.clear(); } catch { }
    qrScannerInstance = null;
  }
  scannerPaused = false;
};

const showScanResult = (type, title, sub) => {
  const result = document.getElementById('scannerResult');
  const icon = document.getElementById('scannerResultIcon');
  const titleEl = document.getElementById('scannerResultTitle');
  const subEl = document.getElementById('scannerResultSub');
  if (!result) return;
  result.hidden = false;
  result.className = `scanner-result scanner-result--${type}`;
  icon.textContent = type === 'success' ? '✓' : type === 'checkout' ? '↩' : '✕';
  titleEl.textContent = title;
  subEl.textContent = sub;
};

const addScanLogEntry = (action, name, eventName) => {
  const logList = document.getElementById('scannerLogList');
  if (!logList) return;
  const emptyMsg = logList.querySelector('.scanner-log-empty');
  if (emptyMsg) emptyMsg.remove();
  const entry = document.createElement('div');
  entry.className = `scan-log-entry scan-log-entry--${action}`;
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const icon = action === 'checked-in' ? '✓' : action === 'checked-out' ? '↩' : '✕';
  entry.innerHTML = `<span class="scan-log-icon">${icon}</span><div><strong>${name || 'Unknown'}</strong><small>${eventName || '—'} · ${timeStr}</small></div><span class="scan-log-badge scan-log-badge--${action}">${action === 'checked-in' ? 'Checked In' : action === 'checked-out' ? 'Checked Out' : 'Invalid'}</span>`;
  logList.prepend(entry);
};

const handleQrScan = async (qrToken) => {
  if (scannerPaused) return;
  scannerPaused = true;

  try {
    const services = await getFirestoreServices();
    if (!services) throw new Error('Firebase not configured.');

    const regRef = services.doc(services.db, 'registrations', qrToken);
    const regSnap = await services.getDoc(regRef);

    if (!regSnap.exists()) {
      showScanResult('error', 'Invalid QR Code', 'This token was not found in the system.');
      addScanLogEntry('invalid', 'Unknown Token', '—');
      setTimeout(() => { const r = document.getElementById('scannerResult'); if (r) r.hidden = true; scannerPaused = false; }, 3000);
      return;
    }

    const data = regSnap.data();
    const { status, participantName, eventId } = data;

    if (status === 'REGISTERED') {
      // First scan → Check In
      await services.updateDoc(regRef, {
        status: 'CHECKED_IN',
        checkInTime: services.serverTimestamp(),
        volunteerId: volunteerProfile.uid,
        volunteerName: volunteerProfile.name
      });
      // Also update the legacy participantRegistrations collection for admin compatibility
      try {
        const pid = data.participantId || '';
        const legacyRef = services.doc(services.db, 'participantRegistrations', `${pid}_${eventId}`);
        await services.updateDoc(legacyRef, { status: 'Checked In', attendance: 'Checked In', checkedInAt: new Date().toISOString() });
      } catch { /* legacy update is best-effort */ }
      showScanResult('success', `✓ Checked In — ${participantName}`, `Event: ${data.eventName || eventId}`);
      addScanLogEntry('checked-in', participantName, data.eventName || eventId);

    } else if (status === 'CHECKED_IN') {
      // Second scan → Check Out
      await services.updateDoc(regRef, {
        status: 'CHECKED_OUT',
        checkOutTime: services.serverTimestamp()
      });
      showScanResult('checkout', `↩ Checked Out — ${participantName}`, `Event: ${data.eventName || eventId}`);
      addScanLogEntry('checked-out', participantName, data.eventName || eventId);

    } else {
      // CHECKED_OUT or unknown
      showScanResult('error', 'Already Processed', `${participantName} has already checked out.`);
      addScanLogEntry('invalid', participantName, data.eventName || eventId);
    }
  } catch (err) {
    // Give a meaningful message for common Firebase errors
    let title = 'Scan Error';
    let message = err.message || 'Could not process this QR code.';
    if (err.code === 'permission-denied' || (err.message || '').toLowerCase().includes('permission')) {
      title = 'Permission Error';
      message = 'Your account does not have check-in access. Please log out and sign in again as a volunteer.';
    } else if (err.code === 'unavailable' || err.code === 'network-request-failed') {
      title = 'Network Error';
      message = 'No internet connection. Check your network and try again.';
    }
    showScanResult('error', title, message);
    addScanLogEntry('invalid', '—', '—');
  }

  // Auto-resume after 3 seconds
  setTimeout(() => {
    const r = document.getElementById('scannerResult');
    if (r) r.hidden = true;
    scannerPaused = false;
  }, 3000);
};

const mountQrScanner = (attempt = 0) => {
  const readerEl = document.getElementById('qr-reader');
  if (!readerEl) return; // Scanner view was closed before library loaded

  // Retry up to 10 times (5 seconds total) waiting for CDN library to arrive
  if (typeof Html5QrcodeScanner === 'undefined') {
    if (attempt < 10) {
      setTimeout(() => mountQrScanner(attempt + 1), 500);
    } else {
      readerEl.innerHTML = '<p style="color:#f87171;padding:20px;text-align:center">QR scanner library failed to load. Check your internet connection and refresh.</p>';
    }
    return;
  }

  destroyQrScanner();

  try {
    qrScannerInstance = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    qrScannerInstance.render(
      (decodedText) => {
        // Prevent duplicate rapid fires
        const trimmed = decodedText.trim();
        if (trimmed) handleQrScan(trimmed);
      },
      (_errorMessage) => { /* Per-frame decode errors are expected — ignore */ }
    );
  } catch (err) {
    console.error('mountQrScanner error:', err);
    if (readerEl) readerEl.innerHTML = `<p style="color:#f87171;padding:20px;text-align:center">Could not start camera: ${err.message}</p>`;
  }
};

roleApp.addEventListener('click', async (event) => {
  // ── Volunteer: open scanner ──────────────────────────────────────────────
  const actionTarget = event.target.closest('[data-action]');
  if (role === 'volunteer' && actionTarget?.dataset.action === 'open-scanner') {
    volunteerScreen = 'scanner';
    render();
    return;
  }
  if (role === 'volunteer' && actionTarget?.dataset.action === 'close-scanner') {
    destroyQrScanner();
    volunteerScreen = 'dashboard';
    render();
    return;
  }

  const participantTarget = event.target.closest('[data-participant-action]');
  if (role === 'participant' && participantTarget) {
    const participantAction = participantTarget.dataset.participantAction;
    if (participantAction === 'participant-tab') { participantTab = participantTarget.dataset.tab; participantScreen = 'workspace'; render(); return; }
    if (participantAction === 'calendar-month') { const nextMonth = participantCalendarDate.month + Number(participantTarget.dataset.direction); const nextDate = new Date(participantCalendarDate.year, nextMonth, 1); participantCalendarDate = { year: nextDate.getFullYear(), month: nextDate.getMonth() }; render(); return; }
    if (participantAction === 'calendar-today') { const today = new Date(); participantCalendarDate = { year: today.getFullYear(), month: today.getMonth() }; render(); return; }
    if (participantAction === 'view-event') { participantEventId = participantTarget.dataset.eventId; participantScreen = 'public-detail'; render(); return; }
    if (participantAction === 'open-registered') { participantEventId = participantTarget.dataset.eventId; participantScreen = 'registered-detail'; render(); return; }
    if (participantAction === 'back-workspace') { participantScreen = 'workspace'; participantTab = 'events'; render(); return; }
    if (participantAction === 'view-public-details') { participantEventId = participantTarget.dataset.eventId; participantScreen = 'public-detail'; render(); return; }
    if (participantAction === 'register-event') {
      participantEventId = participantTarget.dataset.eventId;
      if (!participantIsRegistered(participantEventId)) {
        participantRegisteredIds = [...new Set([...participantRegisteredIds, participantEventId])];
        saveJson(participantRegistrationKey, participantRegisteredIds);
        const registeredDate = parseEventStartDate(getParticipantEvent());
        if (registeredDate) participantCalendarDate = { year: registeredDate.getFullYear(), month: registeredDate.getMonth() };

        const pid = storedProfile?.uid || `participant-${Date.now()}`;
        const selectedEvent = getParticipantEvent();
        const participantInfo = {
          id: pid,
          name: participant.name || 'Participant User',
          email: participant.email || 'participant@eventflow.demo',
          college: 'PICT Pune',
          registration: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          attendance: 'Not Checked In',
          checkedInAt: null,
          registeredAt: new Date().toISOString()
        };

        try {
          const adminParticipantsKey = `eventflowParticipants:${participantEventId}`;
          const existingList = JSON.parse(localStorage.getItem(adminParticipantsKey) || '[]');
          const alreadyListed = existingList.some((item) => item.email === participantInfo.email || item.id === participantInfo.id);
          if (!alreadyListed) {
            existingList.unshift(participantInfo);
            localStorage.setItem(adminParticipantsKey, JSON.stringify(existingList));
          }
        } catch (e) { }

        // ── PHASE 2: Write registrations doc + generate qrToken ─────────
        (async () => {
          try {
            const services = await getFirestoreServices();
            if (services) {
              // Generate a unique QR token
              const qrToken = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${pid}-${participantEventId}-${Date.now()}`;

              // Persist token locally so the QR can be rendered offline too
              saveJson(qrTokenKey(participantEventId), qrToken);

              // Write to canonical `registrations` collection (doc ID = qrToken)
              const registrationDocRef = services.doc(services.db, 'registrations', qrToken);
              await services.setDoc(registrationDocRef, {
                qrToken,
                status: 'REGISTERED',
                checkInTime: null,
                checkOutTime: null,
                eventId: participantEventId,
                eventName: selectedEvent?.name || '',
                participantId: pid,
                participantName: participant.name,
                email: participant.email,
                volunteerId: null,
                timestamp: services.serverTimestamp()
              });

              // Also keep the legacy collections in sync
              const registrationRef = services.doc(services.db, 'participantRegistrations', `${pid}_${participantEventId}`);
              const eventParticipantRef = services.doc(services.db, `events/${participantEventId}/participants`, pid);
              const registration = {
                participantId: pid,
                eventId: participantEventId,
                participantName: participant.name,
                participantEmail: participant.email,
                eventName: selectedEvent?.name || '',
                registeredAt: services.serverTimestamp(),
                status: 'Registered',
                attendance: 'Not Checked In',
                qrToken
              };
              await services.setDoc(registrationRef, registration, { merge: true });
              await services.setDoc(eventParticipantRef, registration, { merge: true });
            }
          } catch (err) {
            console.warn('Firestore registration sync note:', err);
          }
        })();
      }
      participantScreen = 'public-detail';
      render();
      showToast('You are registered for this event.');
      return;
    }
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'update-progress') openProgressModal();
});

roleApp.addEventListener('input', (event) => {
  if (role !== 'participant' || event.target.id !== 'participantSearch') return;
  participantSearch = event.target.value;
  render();
  const input = document.querySelector('#participantSearch');
  input?.focus();
  input?.setSelectionRange(participantSearch.length, participantSearch.length);
});

roleApp.addEventListener('change', (event) => {
  const input = event.target.closest('[data-task-id]');
  if (!input) return;
  const task = tasks.find((item) => item.id === input.dataset.taskId);
  if (!task) return;
  const previousState = task.completed;
  const completed = input.checked;
  task.completed = completed;
  render();
  getFirestoreServices().then(async (services) => {
    if (!services) throw new Error('Firebase is not configured.');
    await services.updateDoc(services.doc(services.db, 'tasks', task.id), { completed, completedAt: completed ? services.serverTimestamp() : null, updatedAt: services.serverTimestamp() });
  }).catch(() => { task.completed = previousState; render(); showToast('Could not update this task. Please try again.'); });
});

document.addEventListener('click', (event) => {
  if (event.target.matches('[data-close-progress], [data-progress-backdrop]')) closeProgressModal();
  if (event.target.matches('[data-close-feedback], .feedback-modal-backdrop')) closeFeedbackModal();
});

document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'progressReportForm') return;
  event.preventDefault();
  const progressPercentage = Math.max(0, Math.min(100, Number(document.querySelector('#progressPercentage').value)));
  const reportText = document.querySelector('#progressReportText').value.trim();
  if (!reportText) return;
  await saveProgressReport(progressPercentage, reportText);
  closeProgressModal();
  render();
  showToast('Progress report submitted successfully.');
});

document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'participantFeedbackForm') return;
  event.preventDefault();
  const form = event.target;
  const eventId = form.dataset.eventId;
  const feedbackEvent = participantEvents.find((item) => item.id === eventId);
  const categories = feedbackEvent?.feedback?.categories || [];
  const ratings = Object.fromEntries(categories.map((category, index) => [category, Number(form.querySelector(`[name="feedback-rating-${index}"]:checked`)?.value)]));
  if (Object.values(ratings).some((rating) => !rating)) return;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting…';
  const response = {
    eventId,
    eventName: feedbackEvent?.name || '',
    participantId: storedProfile?.uid || '',
    participantName: participant.name,
    participantEmail: participant.email,
    categories,
    ratings,
    mostLiked: form.elements.mostLiked.value.trim(),
    improvement: form.elements.improvement.value.trim(),
    questions: feedbackEvent?.feedback?.questions || {},
    submittedAt: new Date().toISOString()
  };
  try {
    const services = await getFirestoreServices();
    if (!services || !storedProfile?.uid) throw new Error('Please sign in to submit feedback.');
    await services.setDoc(services.doc(services.db, 'eventFeedback', feedbackResponseId(eventId)), {
      ...response,
      submittedAt: services.serverTimestamp()
    });
    feedbackSubmittedIds.add(String(eventId));
    saveJson(feedbackStorageKey, [...feedbackSubmittedIds]);
    closeFeedbackModal();
    showToast('Thank you—your feedback has been shared.');
  } catch (error) {
    submitButton.disabled = false;
    submitButton.textContent = 'Submit feedback →';
    showToast(error.message || 'Feedback could not be submitted. Please try again.');
  }
});

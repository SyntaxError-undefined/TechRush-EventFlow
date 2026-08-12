const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modalRoot');

const state = {
  view: 'events',
  eventId: null,
  editingEventId: null,
  organizationId: null,
  adminUid: null,
  adminEmail: null,
  eventsLoading: true,
  departmentId: 'marketing',
  departmentTab: 'progress',
  participantFilter: 'all',
  participantSearch: '',
  nextTask: 10,
  events: [],
  departments: [
    { id: 'marketing', name: 'Marketing', volunteers: 12, progress: 78 },
    { id: 'outreach', name: 'Outreach', volunteers: 8, progress: 64 },
    { id: 'sponsorship', name: 'Sponsorship', volunteers: 10, progress: 91 },
    { id: 'social', name: 'Social Media', volunteers: 6, progress: 83 },
    { id: 'technical', name: 'Technical', volunteers: 7, progress: 72 },
    { id: 'content', name: 'Content', volunteers: 5, progress: 68 },
    { id: 'design', name: 'Design', volunteers: 4, progress: 70 },
    { id: 'logistics', name: 'Logistics', volunteers: 8, progress: 66 }
  ],
  reports: [
    { name: 'Rahul', time: 'Today — 10:32 AM', text: 'Contacted 12 colleges. 5 responded positively.' },
    { name: 'Priya', time: 'Today — 09:48 AM', text: 'Completed the Instagram campaign draft.' },
    { name: 'Aditya', time: 'Yesterday — 06:20 PM', text: 'Reached out to 8 sponsors.' }
  ],
  tasks: [],
  volunteers: [
    { name: 'Rahul', email: 'rahul@email.com', tasks: 8, progress: 78, status: 'Active' },
    { name: 'Priya', email: 'priya@email.com', tasks: 6, progress: 91, status: 'Active' },
    { name: 'Aditya', email: 'aditya@email.com', tasks: 4, progress: 62, status: 'Active' },
    { name: 'Neha', email: 'neha@email.com', tasks: 5, progress: 75, status: 'Active' }
  ],
  volunteerImportRows: [],
  volunteerImportInvalidRows: [],
  // Phase 4: live registrations from `registrations` collection
  registrations: []
};

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const departmentSlug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'department';
const DEFAULT_EVENT_DEPARTMENTS = ['Marketing', 'Outreach', 'Sponsorship', 'Social Media', 'Technical', 'Content', 'Design', 'Logistics', 'Photography', 'Hospitality'];
const getCreateDepartmentList = () => [...new Set([...DEFAULT_EVENT_DEPARTMENTS, ...(state.createDepartments || [])])];
const getSelectedCreateDepartments = (editingEvent) => {
  if (editingEvent?.departmentNames?.length) return editingEvent.departmentNames;
  if (state.createDepartments?.length) return state.createDepartments;
  return DEFAULT_EVENT_DEPARTMENTS.slice(0, 5);
};
const syncCreateDepartmentsFromDom = () => {
  const checked = Array.from(document.querySelectorAll('.create-dept-chip input:checked')).map((input) => input.value);
  if (checked.length) state.createDepartments = checked;
};
const mapEventDoc = (id, data) => {
  const departmentNames = Array.isArray(data.departments) ? data.departments : [];
  return {
    id,
    name: data.eventName || '',
    visibility: data.visibility || 'private',
    cardTheme: data.cardTheme || 'harbor',
    type: data.eventCategory || data.type || 'Event',
    date: data.date || '',
    time: data.time || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    location: data.venue || '',
    status: data.status || 'Upcoming',
    description: data.shortDescription || '',
    shortDescription: data.shortDescription || '',
    detailedDescription: data.detailedDescription || '',
    departmentNames,
    departments: departmentNames.length,
    departmentProgress: data.departmentProgress || {},
    participants: data.participants || 0,
    volunteers: data.volunteers || 0,
    checkedIn: data.checkedIn || 0,
    organizationId: data.organizationId || '',
    organizer: data.organizer || '',
    expectedParticipants: data.expectedParticipants || '',
    registrationMode: data.registrationMode || '',
    registrationLink: data.registrationLink || '',
    website: data.website || '',
    socialLink: data.socialLink || '',
    contactEmail: data.contactEmail || '',
    contactPhone: data.contactPhone || '',
    hashtag: data.hashtag || '',
    address: data.address || '',
    meetingLink: data.meetingLink || '',
    venueType: data.venueType || '',
    timezone: data.timezone || ''
  };
};
const getEvent = () => state.events.find((event) => event.id === state.eventId) || null;
const getDepartment = () => state.departments.find((department) => department.id === state.departmentId) || state.departments[0];
const syncDepartmentsFromEvent = () => {
  const event = getEvent();
  const names = event?.departmentNames || [];
  state.departments = names.map((name) => {
    const id = departmentSlug(name);
    const previous = state.departments.find((department) => department.name === name);
    return { id, name, volunteers: previous?.volunteers || 0, progress: previous?.progress ?? 0 };
  });
  if (state.departments.length && !state.departments.some((department) => department.id === state.departmentId)) {
    state.departmentId = state.departments[0].id;
  }
};
const saveEventDepartment = async (name) => {
  const event = getEvent();
  if (!event) {
    showToast('Open an event before adding departments.');
    return false;
  }
  const existingNames = event.departmentNames || [];
  const duplicate = existingNames.find((department) => department.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    showToast(`"${duplicate}" already exists for this event.`);
    return false;
  }
  const updatedDepartments = [...existingNames, name];
  const eventIndex = state.events.findIndex((item) => item.id === event.id);
  if (eventIndex >= 0) {
    state.events[eventIndex] = {
      ...state.events[eventIndex],
      departmentNames: updatedDepartments,
      departments: updatedDepartments.length
    };
  }
  syncDepartmentsFromEvent();
  try {
    const services = await getAdminFirebaseServices();
    if (!services) {
      showToast('Unable to save this department. Sign in again and retry.');
      await loadOrganizationEvents();
      syncDepartmentsFromEvent();
      return false;
    }
    await services.updateDoc(services.doc(services.db, 'events', event.id), {
      departments: updatedDepartments,
      updatedAt: services.serverTimestamp()
    });
  } catch {
    showToast('Could not save this department. Check your connection and try again.');
    await loadOrganizationEvents();
    syncDepartmentsFromEvent();
    return false;
  }
  return true;
};
const volunteerStorageKey = () => `eventflowVolunteers:${state.eventId}`;
const getEventVolunteers = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(volunteerStorageKey()) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch { }
  return [];
};
const saveEventVolunteers = (volunteers) => localStorage.setItem(volunteerStorageKey(), JSON.stringify(volunteers));
const participantStorageKey = () => `eventflowParticipants:${state.eventId}`;
const getEventParticipants = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(participantStorageKey()) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch { }
  return [];
};
const saveEventParticipants = (participants) => localStorage.setItem(participantStorageKey(), JSON.stringify(participants));
const getParticipantStats = () => {
  const participants = getEventParticipants();
  const checkedIn = participants.filter((participant) => participant.attendance === 'Checked In').length;
  return { registered: participants.length, checkedIn, notChecked: Math.max(participants.length - checkedIn, 0) };
};
const getRecentCheckins = () => getEventParticipants()
  .filter((participant) => participant.attendance === 'Checked In')
  .sort((left, right) => String(right.checkedInAt || '').localeCompare(String(left.checkedInAt || '')))
  .slice(0, 10)
  .map((participant) => ({
    name: participant.name,
    college: participant.college || '—',
    time: participant.checkedInAt
      ? new Date(participant.checkedInAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : '—'
  }));
let adminFirebaseServices;
let volunteerUnsubscribe;
let volunteerSubscriptionEventId;
let participantUnsubscribe;
let participantSubscriptionEventId;
let taskUnsubscribe;
let taskSubscriptionEventId;
// Phase 4: registrations live listener
let registrationsUnsubscribe;
let registrationsSubscriptionEventId;
const subscribeToParticipants = async () => {
  if (!state.eventId) return;
  if (participantSubscriptionEventId === state.eventId && participantUnsubscribe) return;
  if (participantUnsubscribe) { participantUnsubscribe(); participantUnsubscribe = null; }
  try {
    const services = await getAdminFirebaseServices();
    if (!services) return;
    participantSubscriptionEventId = state.eventId;

    // Fetch from participantRegistrations collection in case subcollection sync is pending
    try {
      const regQuery = services.query(
        services.collection(services.db, 'participantRegistrations'),
        services.where('eventId', '==', state.eventId)
      );
      const regSnap = await services.getDocs(regQuery);
      if (!regSnap.empty) {
        const remoteRegs = regSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          let regTime = 'Just now';
          if (data.registeredAt?.toDate) {
            regTime = data.registeredAt.toDate().toLocaleDateString();
          } else if (data.registeredAt) {
            regTime = String(data.registeredAt);
          }
          return {
            id: data.participantId || docSnap.id,
            name: data.participantName || data.name || 'Participant',
            email: data.participantEmail || data.email || '',
            college: data.college || 'PICT Pune',
            registration: regTime,
            attendance: data.status === 'Checked In' || data.attendance === 'Checked In' ? 'Checked In' : 'Not Checked In',
            checkedInAt: data.checkedInAt || null
          };
        });
        const current = getEventParticipants();
        const map = new Map();
        current.forEach((p) => map.set(String(p.email || p.id).toLowerCase(), p));
        remoteRegs.forEach((p) => map.set(String(p.email || p.id).toLowerCase(), p));
        saveEventParticipants(Array.from(map.values()));
      }
    } catch { }

    const participantsRef = services.collection(services.db, `events/${state.eventId}/participants`);
    participantUnsubscribe = services.onSnapshot(participantsRef, (snapshot) => {
      const liveParticipants = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        let regTime = 'Just now';
        if (data.registeredAt?.toDate) {
          regTime = data.registeredAt.toDate().toLocaleDateString();
        } else if (data.registeredAt) {
          regTime = String(data.registeredAt);
        }
        return {
          id: docSnap.id,
          name: data.participantName || data.name || 'Participant',
          email: data.participantEmail || data.email || '',
          college: data.college || data.organization || 'PICT Pune',
          registration: regTime,
          attendance: data.status === 'Checked In' || data.attendance === 'Checked In' ? 'Checked In' : 'Not Checked In',
          checkedInAt: data.checkedInAt || null
        };
      });
      const current = getEventParticipants();
      const map = new Map();
      current.forEach((p) => map.set(String(p.email || p.id).toLowerCase(), p));
      liveParticipants.forEach((p) => map.set(String(p.email || p.id).toLowerCase(), p));
      saveEventParticipants(Array.from(map.values()));

      if (state.view === 'workspace' && ['participants', 'overview', 'checkins'].includes(state.workspaceTab)) {
        render();
      }
    }, (error) => {
      console.warn('Participant subscription note:', error.message);
    });
  } catch (err) {
    console.error('Participant subscribe error:', err);
  }
};
const getAdminFirebaseServices = async () => {
  if (adminFirebaseServices) return adminFirebaseServices;
  const config = window.EVENTFLOW_FIREBASE_CONFIG || {};
  if (!config.apiKey) return null;
  const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  const app = initializeApp(config);
  adminFirebaseServices = { auth: authSdk.getAuth(app), db: firestoreSdk.getFirestore(app), ...authSdk, ...firestoreSdk };
  return adminFirebaseServices;
};
const getVolunteerFirestoreServices = getAdminFirebaseServices;
const getInitialAuthUser = (services) => new Promise((resolve) => {
  const unsubscribe = services.onAuthStateChanged(services.auth, (user) => {
    unsubscribe();
    resolve(user);
  });
});
const adminEventsStorageKey = () => `eventflowEvents:${state.organizationId || 'unassigned'}`;
const getLocalAdminEvents = () => {
  try {
    const scopedEvents = localStorage.getItem(adminEventsStorageKey());
    // Read older browser-only events once, but only when they carry the current
    // organization ID. This keeps an admin's legacy offline work visible without
    // exposing it to another admin using the same browser.
    const list = JSON.parse(scopedEvents ?? localStorage.getItem('eventflowEvents') ?? '[]');
    return Array.isArray(list)
      ? list.map((item) => mapEventDoc(item.id, item)).filter((event) => event.organizationId === state.organizationId)
      : [];
  } catch {
    return [];
  }
};

const loadOrganizationEvents = async () => {
  state.eventsLoading = true;
  const localEvents = getLocalAdminEvents();
  const eventsMap = new Map();
  localEvents.forEach((evt) => eventsMap.set(evt.id, evt));
  state.events = Array.from(eventsMap.values());
  if (state.view === 'events') renderEvents();

  try {
    const services = await getAdminFirebaseServices();
    if (services && state.organizationId) {
      const eventsQuery = services.query(
        services.collection(services.db, 'events'),
        services.where('organizationId', '==', state.organizationId)
      );
      const snapshot = await services.getDocs(eventsQuery);
      snapshot.docs.forEach((docSnap) => {
        const evt = mapEventDoc(docSnap.id, docSnap.data());
        eventsMap.set(evt.id, evt);
      });
      state.events = Array.from(eventsMap.values());
    }
  } catch {
    // Keep local events
  } finally {
    state.eventsLoading = false;
    if (state.view === 'events') renderEvents();
  }
};
const readStoredAdminProfile = () => {
  try {
    return JSON.parse(sessionStorage.getItem('eventflowUser') || 'null');
  } catch {
    return null;
  }
};
const applyAdminProfileToHeader = (profile) => {
  const name = profile?.name || 'EventFlow Admin';
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'EF';
  const trigger = document.querySelector('#profileTrigger');
  if (!trigger) return;
  trigger.querySelector('.avatar').textContent = initials;
  trigger.querySelector('.profile-copy strong').textContent = name;
};
const bootstrapAdminSession = async () => {
  const storedProfile = readStoredAdminProfile();
  if (!storedProfile?.uid) {
    window.location.replace('team-login.html');
    return false;
  }
  state.adminUid = storedProfile.uid;
  state.adminEmail = storedProfile.email || '';
  applyAdminProfileToHeader(storedProfile);
  const services = await getAdminFirebaseServices();
  if (!services) {
    showToast('Firebase is not configured.');
    window.location.replace('team-login.html');
    return false;
  }
  try {
    // Firebase restores persisted credentials asynchronously after a page load.
    // Waiting here prevents a valid, newly-created session from being redirected
    // to login before Firebase has finished restoring it.
    const authenticatedUser = await getInitialAuthUser(services);
    if (!authenticatedUser || authenticatedUser.uid !== storedProfile.uid) {
      window.location.replace('team-login.html');
      return false;
    }
    const userSnapshot = await services.getDoc(services.doc(services.db, 'users', storedProfile.uid));
    if (!userSnapshot.exists()) {
      window.location.replace('team-login.html');
      return false;
    }
    const userData = userSnapshot.data();
    if (userData.role !== 'admin') {
      window.location.replace('team-login.html');
      return false;
    }
    state.organizationId = userData.organizationId || storedProfile.organizationId || null;
    if (!state.organizationId) {
      showToast('Your admin account is missing an organization.');
      window.location.replace('team-login.html');
      return false;
    }
    applyAdminProfileToHeader({ ...storedProfile, name: userData.name || storedProfile.name });
    await loadOrganizationEvents();
    return true;
  } catch {
    showToast('Unable to load your admin profile.');
    window.location.replace('team-login.html');
    return false;
  }
};
const subscribeToEventVolunteers = async () => {
  if (volunteerSubscriptionEventId === state.eventId) return;
  let services;
  try { services = await getVolunteerFirestoreServices(); } catch { return; }
  if (!services) return;
  volunteerUnsubscribe?.();
  volunteerSubscriptionEventId = state.eventId;
  volunteerUnsubscribe = services.onSnapshot(services.collection(services.db, `events/${state.eventId}/volunteers`), (snapshot) => {
    const volunteers = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), status: item.data().status || 'Active' }));
    saveEventVolunteers(volunteers);
    if (state.view === 'workspace' && ['volunteers', 'departments'].includes(state.workspaceTab)) renderWorkspace();
  });
};
const subscribeToEventTasks = async () => {
  if (!state.eventId) return;
  if (taskSubscriptionEventId === state.eventId && taskUnsubscribe) return;
  taskUnsubscribe?.();
  try {
    const services = await getAdminFirebaseServices();
    if (!services) return;
    taskSubscriptionEventId = state.eventId;
    const taskQuery = services.query(services.collection(services.db, 'tasks'), services.where('eventId', '==', state.eventId));
    taskUnsubscribe = services.onSnapshot(taskQuery, (snapshot) => {
      state.tasks = snapshot.docs.map((item) => {
        const task = item.data();
        return { id: item.id, name: task.title || 'Assigned task', description: task.description || '', assignee: task.assigneeName || task.assignedEmail || 'Volunteer', assignedEmail: task.assignedEmail || '', department: task.department || '', due: task.dueDate || 'To be decided', status: task.completed ? 'Completed' : 'Pending', completed: Boolean(task.completed) };
      });
      if (state.view === 'department' && state.departmentTab === 'tasks') renderDepartmentWorkspace();
    });
  } catch { }
};
const volunteerDepartments = () => getEvent().departmentNames?.length ? getEvent().departmentNames : state.departments.map((department) => department.name);
const getStoredProgressReports = () => { try { return JSON.parse(localStorage.getItem('eventflowProgressReports') || '[]'); } catch { return []; } };
const departmentReports = (department) => [...state.reports, ...getStoredProgressReports().filter((report) => report.eventId === state.eventId && report.department === department.name).map((report) => ({ name: report.volunteerName, time: new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }), text: report.reportText, progressPercentage: report.progressPercentage }))];
const statusClass = (status) => status === 'Completed' ? 'status-pill status-pill--done' : status === 'Pending' ? 'status-pill status-pill--pending' : 'status-pill';
const iconForDepartment = (name) => ({ Marketing: '✦', Outreach: '◎', Sponsorship: '◌', 'Social Media': '◈', Technical: '×', Content: '▣', Design: '⌁', Logistics: '⌗' }[name] || '·');

function render() {
  if (state.view === 'events') renderEvents();
  if (state.view === 'create') renderSimpleCreateEvent();
  if (state.view === 'workspace') renderWorkspace();
  if (state.view === 'department') renderDepartmentWorkspace();
}

function renderEvents() {
  const filter = document.querySelector('.filter-button.is-active')?.dataset.filter || 'all';
  const events = state.events.filter((event) => filter === 'all' || event.status.toLowerCase() === filter);
  const adminName = escapeHtml(readStoredAdminProfile()?.name || 'Admin');
  const gridContent = state.eventsLoading
    ? '<p class="events-loading" style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px 0">Loading your events...</p>'
    : `${events.map(eventCard).join('')}<button class="create-card" data-action="create-event"><span class="create-card__inner"><span class="create-card__plus">+</span><strong>Create New Event</strong><small>Start by creating a new event</small></span></button>`;
  app.innerHTML = `<section class="view events-view">
    <section class="admin-welcome" aria-label="Admin welcome">
      <span class="admin-welcome__shape admin-welcome__shape--one" aria-hidden="true"></span><span class="admin-welcome__shape admin-welcome__shape--two" aria-hidden="true"></span><span class="admin-welcome__shape admin-welcome__shape--three" aria-hidden="true"></span>
      <div class="admin-welcome__copy"><p class="eyebrow">Admin workspace</p><h1>Welcome back,<br><span>${adminName}</span>.</h1><p>Everything you need to shape thoughtful events and keep every team in sync.</p></div>
      <div class="admin-welcome__note"><span aria-hidden="true">✦</span><p>Your event desk</p><strong>Plan clearly.<br>Lead confidently.</strong></div>
    </section>
    <div class="page-heading page-heading--events"><div><p class="eyebrow">Your workspace</p><h2>Your Events</h2><p>Select an event to manage its teams, attendees, and live activity.</p></div><button class="button" data-action="create-event">+ Create New Event</button></div>
    <div class="filter-bar" role="tablist" aria-label="Event filters">${['all', 'upcoming', 'ongoing', 'past'].map((item) => `<button class="filter-button ${filter === item ? 'is-active' : ''}" data-filter="${item}" role="tab">${item[0].toUpperCase() + item.slice(1)}</button>`).join('')}</div>
    <div class="event-grid">${gridContent}</div>
  </section>`;
}

function eventCardMark(eventId) {
  const marks = ['✦', '⌁', '◈', '◎', '▣'];
  let hash = 0;
  for (let index = 0; index < eventId.length; index += 1) hash = (hash + eventId.charCodeAt(index)) % marks.length;
  return marks[hash];
}

function eventCard(event) {
  const isPublic = event.visibility === 'public';
  const visibilityBadge = isPublic
    ? `<span class="event-card__visibility event-card__visibility--public">🌐 Public</span>`
    : `<span class="event-card__visibility event-card__visibility--private">◌ Unpublished</span>`;
  const publishButton = isPublic ? `<button class="event-card__publish" data-action="publish-event" data-event-id="${event.id}">Change theme</button>` : `<button class="event-card__publish" data-action="publish-event" data-event-id="${event.id}">Publish it →</button>`;
  return `<article class="event-card"><button class="event-card__open" data-event-id="${event.id}" aria-label="Open ${escapeHtml(event.name)}"><div class="event-card__header-row"><span class="event-card__mark">${eventCardMark(event.id)}</span>${visibilityBadge}</div><span class="event-card__status ${event.status === 'Past' ? 'event-card__status--past' : ''}">${escapeHtml(event.status)}</span><h2>${escapeHtml(event.name)}</h2><p>${escapeHtml(event.type)}</p><span class="event-card__meta"><span>${escapeHtml(event.date)}</span><span>${escapeHtml(event.location)}</span></span></button>${publishButton}</article>`;
}

function workspaceHeader(tab) {
  const event = getEvent();
  if (!event) return '<div class="workspace-top"><a href="#" class="back-link" data-action="all-events">← All Events</a><p style="color:var(--muted)">Event not found.</p></div>';
  const statusLabel = event.status === 'Ongoing' ? 'HAPPENING NOW' : event.status.toUpperCase();
  const isPublic = event.visibility === 'public';
  const visibilityBadge = isPublic
    ? `<span class="event-card__visibility event-card__visibility--public">🌐 Public Event</span>`
    : `<span class="event-card__visibility event-card__visibility--private">🔒 Private Event</span>`;
  return `<div class="workspace-top"><a href="#" class="back-link" data-action="all-events">← All Events</a><div class="workspace-title"><div class="workspace-title__main"><span class="event-logo">✦</span><div><div class="workspace-name-row"><h1>${escapeHtml(event.name)}</h1><span class="event-status event-status--${event.status.toLowerCase()}">${escapeHtml(statusLabel)}</span>${visibilityBadge}</div><p>${escapeHtml(event.date)} · ${escapeHtml(event.time || 'Time to be announced')} · ${escapeHtml(event.location)}</p></div></div><div class="workspace-title__actions"><button class="button button--ghost button--small" data-action="edit-event">✎ Edit Event</button><button class="button button--small" data-action="publish-event">${isPublic ? 'Change invitation theme' : 'Publish it →'}</button></div></div><nav class="workspace-nav" aria-label="Event navigation">${['overview', 'departments', 'volunteers', 'participants', 'checkins'].map((item) => `<button class="${tab === item ? 'is-active' : ''}" data-workspace-tab="${item}">${item === 'checkins' ? 'Check-ins' : item[0].toUpperCase() + item.slice(1)}</button>`).join('')}</nav></div>`;
}

function renderWorkspace() {
  syncDepartmentsFromEvent();
  const tab = state.workspaceTab || 'overview';
  const content = tab === 'overview' ? overviewView() : tab === 'departments' ? departmentsView() : tab === 'volunteers' ? eventVolunteersView() : tab === 'participants' ? participantsView() : checkinsView();
  app.innerHTML = `<section class="view workspace-view workspace-view--${tab}">${workspaceHeader(tab)}${content}</section>`;
  if (tab === 'volunteers' || tab === 'departments') subscribeToEventVolunteers();
  if (['participants', 'overview', 'checkins'].includes(tab)) subscribeToParticipants();
  if (tab === 'checkins') subscribeToRegistrations();
}

function overviewView() {
  const event = getEvent();
  if (!event) return '';
  const departmentNames = event.departmentNames || [];
  const progress = departmentNames.map((name) => ({ name, value: typeof event.departmentProgress?.[name] === 'number' ? event.departmentProgress[name] : 0 }));
  const participantStats = getParticipantStats();
  const detailedDescription = event.detailedDescription ? `<p class="overview-detail-copy">${escapeHtml(event.detailedDescription)}</p>` : '';
  return `<section class="tab-panel tab-panel--overview"><div class="tab-panel__heading"><div><p class="eyebrow">Event snapshot</p><h2>Everything at a glance.</h2><p>Track your event’s setup, team activity, and attendee progress from one clear view.</p></div><span class="tab-panel__marker" aria-hidden="true">✦</span></div><div class="stats-row stats-row--overview"><div class="stat"><label>Participants</label><strong>${participantStats.registered}</strong><small>Registered attendees</small></div><div class="stat"><label>Volunteers</label><strong>${event.volunteers || 0}</strong><small>People on your team</small></div><div class="stat"><label>Checked In</label><strong>${participantStats.checkedIn}</strong><small>Arrived at the event</small></div><div class="stat"><label>Departments</label><strong>${departmentNames.length || event.departments || 0}</strong><small>Teams in motion</small></div></div><div class="overview-grid"><section class="overview-about"><p class="eyebrow">The event</p><h2>About ${escapeHtml(event.name)}</h2><p class="overview-lead">${escapeHtml(event.description || 'No short description has been added yet.')}</p>${detailedDescription}<div class="overview-progress"><div class="overview-section-heading"><div><p class="eyebrow">Team momentum</p><h2>Department progress</h2></div><span>${progress.length} team${progress.length === 1 ? '' : 's'}</span></div><div class="progress-list">${progress.length ? progress.map((department) => progressItem(department.name, department.value)).join('') : '<p class="overview-empty">No departments have been assigned yet.</p>'}</div></div></section><aside class="overview-details"><p class="eyebrow">At a glance</p><h2>Event details</h2><dl class="event-detail-list"><div><dt>Date</dt><dd>${escapeHtml(event.date || 'Date to be announced')}</dd></div><div><dt>Time</dt><dd>${escapeHtml(event.time || 'Time to be announced')}</dd></div><div><dt>Venue</dt><dd>${escapeHtml(event.location || 'Venue to be announced')}</dd></div></dl></aside></div></section>`;
}

function progressItem(name, value) { const label = value === 0 ? 'Not started' : `${value}%`; return `<div class="progress-item"><div class="progress-item__head"><span>${escapeHtml(name)}</span><span>${label}</span></div><div class="progress-track"><span style="width:${value}%"></span></div></div>`; }

function departmentsView() {
  const volunteers = getEventVolunteers();
  const departments = state.departments.length ? state.departments : (getEvent()?.departmentNames || []).map((name) => ({ id: departmentSlug(name), name, progress: 0 }));
  return `<section class="tab-panel departments-tab"><div class="section-toolbar tab-panel-toolbar"><div><p class="eyebrow">Team directory</p><h2>Departments</h2><p>Open a department to review its people, tasks, and current progress.</p></div><button class="button button--small" data-action="add-department">+ Add Department</button></div><div class="department-grid">${departments.map((department) => { const count = volunteers.filter((volunteer) => volunteer.department === department.name).length; return `<button class="department-card" data-department-id="${department.id}"><span class="department-card__icon">${iconForDepartment(department.name)}</span><span class="department-card__open" aria-hidden="true">↗</span><h3>${escapeHtml(department.name)}</h3><p>${count} ${count === 1 ? 'volunteer' : 'volunteers'} assigned</p><div class="department-card__head"><span>Progress</span><strong>${department.progress}%</strong></div><div class="department-card__progress"><span style="width:${department.progress}%"></span></div></button>`; }).join('')}</div></section>`;
}

function eventVolunteersView() {
  const volunteers = getEventVolunteers();
  return `<section class="tab-panel event-volunteers-tab"><div class="section-toolbar volunteers-toolbar tab-panel-toolbar"><div><p class="eyebrow">Your event crew</p><h2>Volunteers</h2><p>Manage assignments and keep everyone connected to the right department.</p></div><div class="toolbar-actions"><button class="button button--ghost button--small" data-action="invite-volunteers">Invite Volunteers</button><button class="button button--ghost button--small" data-action="import-volunteers">Import Excel</button><button class="button button--small" data-action="add-volunteer">+ Add Volunteer</button></div></div>${volunteers.length ? `<div class="table-wrap table-scroll volunteers-table"><table><thead><tr><th>Volunteer Name</th><th>Email</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead><tbody>${volunteers.map((volunteer) => `<tr><td><strong>${escapeHtml(volunteer.name)}</strong></td><td>${escapeHtml(volunteer.email)}</td><td>${escapeHtml(volunteer.department)}</td><td><span class="status-pill status-pill--done">${escapeHtml(volunteer.status || 'Active')}</span></td><td><div class="inline-actions"><button class="icon-button" data-action="edit-event-volunteer" data-volunteer-id="${volunteer.id}">Edit</button><button class="icon-button" data-action="remove-event-volunteer" data-volunteer-id="${volunteer.id}">Remove</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="volunteers-empty"><h3>No volunteers added yet.</h3><p>Add or import your roster, then share an invitation link with eligible volunteers.</p><div><button class="button button--ghost button--small" data-action="invite-volunteers">Invite Volunteers</button><button class="button button--ghost button--small" data-action="import-volunteers">Import Excel</button><button class="button button--small" data-action="add-volunteer">+ Add Volunteer</button></div></div>'}</section>`;
}

function renderDepartmentWorkspace() {
  const department = getDepartment();
  if (!department || !getEvent()) { state.view = 'events'; render(); return; }
  const tab = state.departmentTab;
  subscribeToEventVolunteers();
  if (tab === 'tasks') subscribeToEventTasks();
  const assignedVolunteers = getEventVolunteers().filter((volunteer) => volunteer.department === department.name);
  app.innerHTML = `<section class="view department-view"><a href="#" class="back-link" data-action="departments">← Departments</a><div class="dept-head"><div><h1>${escapeHtml(department.name)} Department</h1><p>${assignedVolunteers.length} Volunteers · ${escapeHtml(getEvent().name)}</p></div>${tab === 'progress' ? '<button class="button button--ghost button--small" data-action="add-remark">+ Add Remark</button>' : tab === 'tasks' ? '<button class="button button--small" data-action="assign-task">+ Assign Task</button>' : '<button class="button button--small" data-action="add-volunteer">+ Add Volunteer</button>'}</div><div class="subtabs">${['progress', 'tasks', 'volunteers'].map((item) => `<button class="${tab === item ? 'is-active' : ''}" data-dept-tab="${item}">${item[0].toUpperCase() + item.slice(1)}</button>`).join('')}</div>${tab === 'progress' ? progressDepartmentView(department) : tab === 'tasks' ? tasksView() : volunteersView()}</section>`;
}

function progressDepartmentView(department) {
  const reports = departmentReports(department);
  const latestProgress = reports.find((report) => typeof report.progressPercentage === 'number')?.progressPercentage ?? department.progress;
  return `<div class="progress-hero"><h2>${escapeHtml(department.name)} Progress</h2><strong>${latestProgress}%</strong></div><div class="section-toolbar" style="margin-top:28px"><h2>Volunteer Progress Reports</h2></div><div class="report-list">${reports.map((report) => `<article class="report"><div><strong>${escapeHtml(report.name)}</strong><small>${escapeHtml(report.time)}</small></div><p>“${escapeHtml(report.text)}”</p></article>`).join('')}</div>`;
}

function tasksView() {
  const departmentTasks = state.tasks.filter((task) => task.department === getDepartment().name);
  return departmentTasks.length ? `<div class="task-list">${departmentTasks.map((task) => `<div class="task-row"><div><strong>${escapeHtml(task.name)}</strong><small>Assigned to ${escapeHtml(task.assignee)}${task.description ? ` · ${escapeHtml(task.description)}` : ''}</small></div><span class="assigned">${escapeHtml(task.assignee)}</span><span class="due">Due: ${escapeHtml(task.due)}</span><span class="${statusClass(task.status)}">${escapeHtml(task.status)}</span></div>`).join('')}</div>` : '<div class="volunteers-empty"><h3>No tasks assigned yet.</h3><p>Assign a task to a volunteer in this department to see its live status here.</p></div>';
}

function volunteersView() {
  const volunteers = getEventVolunteers().filter((volunteer) => volunteer.department === getDepartment().name);
  return `<div class="table-wrap table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Tasks</th><th>Progress</th><th>Status</th><th></th></tr></thead><tbody>${volunteers.length ? volunteers.map((volunteer) => `<tr><td><strong>${escapeHtml(volunteer.name)}</strong></td><td>${escapeHtml(volunteer.email)}</td><td>${volunteer.tasks || 0} Tasks</td><td>${volunteer.progress || 0}%</td><td><span class="status-pill status-pill--done">${escapeHtml(volunteer.status || 'Active')}</span></td><td><button class="icon-button" data-volunteer-id="${volunteer.id}" data-action="volunteer-detail">View</button></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">No volunteers assigned to this department.</td></tr>'}</tbody></table></div>`;
}

function participantsView() {
  const participants = getEventParticipants();
  const filtered = participants.filter((participant) => {
    const query = state.participantSearch.toLowerCase();
    const matchesSearch = !query || `${participant.name} ${participant.email} ${participant.college}`.toLowerCase().includes(query);
    const matchesFilter = state.participantFilter === 'all' || (state.participantFilter === 'checked' ? participant.attendance === 'Checked In' : participant.attendance === 'Not Checked In');
    return matchesSearch && matchesFilter;
  });
  const emptyMessage = participants.length === 0 ? 'No participants registered yet.' : 'No participants found.';
  return `<section class="tab-panel participants-tab"><div class="section-toolbar tab-panel-toolbar"><div><p class="eyebrow">Registration desk</p><h2>Participants</h2><p>${participants.length} registered ${participants.length === 1 ? 'participant' : 'participants'} for this event.</p></div><div class="toolbar-actions"><button class="button button--ghost button--small" data-action="add-participant">+ Add Participant</button></div></div><div class="participants-controls"><input class="search-input" id="participantSearch" value="${escapeHtml(state.participantSearch)}" placeholder="Search participants..." aria-label="Search participants"><div class="filter-bar"><button class="filter-button ${state.participantFilter === 'all' ? 'is-active' : ''}" data-participant-filter="all">All</button><button class="filter-button ${state.participantFilter === 'checked' ? 'is-active' : ''}" data-participant-filter="checked">Checked In</button><button class="filter-button ${state.participantFilter === 'not-checked' ? 'is-active' : ''}" data-participant-filter="not-checked">Not Checked In</button></div></div><div class="table-wrap table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>College</th><th>Registration</th><th>Attendance</th><th>Actions</th></tr></thead><tbody>${filtered.length ? filtered.map(participantRow).join('') : `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">${emptyMessage}</td></tr>`}</tbody></table></div></section>`;
}

function participantRow(participant) {
  const attendanceClass = participant.attendance === 'Checked In' ? 'status-pill status-pill--done' : 'status-pill status-pill--pending';
  return `<tr><td><strong>${escapeHtml(participant.name)}</strong></td><td>${escapeHtml(participant.email)}</td><td>${escapeHtml(participant.college)}</td><td>${escapeHtml(participant.registration)}</td><td><span class="${attendanceClass}">${escapeHtml(participant.attendance)}</span></td><td><div class="inline-actions"><button class="icon-button" data-participant-id="${participant.id}" data-action="edit-participant">Edit</button><button class="icon-button" data-participant-id="${participant.id}" data-action="delete-participant">Delete</button></div></td></tr>`;
}

// ─── Phase 4: Live Registrations Listener ─────────────────────────────────────────
const subscribeToRegistrations = async () => {
  if (!state.eventId) return;
  if (registrationsSubscriptionEventId === state.eventId && registrationsUnsubscribe) return;
  if (registrationsUnsubscribe) { registrationsUnsubscribe(); registrationsUnsubscribe = null; }
  try {
    const services = await getAdminFirebaseServices();
    if (!services) return;
    registrationsSubscriptionEventId = state.eventId;
    const q = services.query(
      services.collection(services.db, 'registrations'),
      services.where('eventId', '==', state.eventId)
    );
    registrationsUnsubscribe = services.onSnapshot(q, (snapshot) => {
      state.registrations = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      if (state.view === 'workspace' && state.workspaceTab === 'checkins') renderWorkspace();
    }, (err) => {
      console.warn('Registrations listener note:', err.message);
    });
  } catch (err) {
    console.error('subscribeToRegistrations error:', err);
  }
};

const getLiveRegistrationStats = () => {
  const regs = state.registrations;
  const total = regs.length;
  const checkedIn = regs.filter((r) => r.status === 'CHECKED_IN').length;
  const checkedOut = regs.filter((r) => r.status === 'CHECKED_OUT').length;
  const attended = checkedIn + checkedOut; // total who have physically been present
  const attendancePct = total > 0 ? Math.round((attended / total) * 100) : 0;
  return { total, checkedIn, checkedOut, attended, attendancePct };
};

const getLiveScanFeed = () => state.registrations
  .filter((r) => r.status === 'CHECKED_IN' || r.status === 'CHECKED_OUT')
  .sort((a, b) => {
    const ta = (b.checkOutTime?.seconds || b.checkInTime?.seconds || 0);
    const tb = (a.checkOutTime?.seconds || a.checkInTime?.seconds || 0);
    return ta - tb;
  })
  .slice(0, 20);

function checkinsView() {
  const event = getEvent();
  if (!event) return '';

  // Use live registrations if available, fall back to localStorage stats
  const hasLiveData = state.registrations.length > 0;
  const legacyStats = getParticipantStats();
  const liveStats = getLiveRegistrationStats();
  const total = hasLiveData ? liveStats.total : legacyStats.registered;
  const checkedIn = hasLiveData ? liveStats.checkedIn : legacyStats.checkedIn;
  const checkedOut = hasLiveData ? liveStats.checkedOut : 0;
  const notChecked = hasLiveData ? (total - liveStats.attended) : legacyStats.notChecked;
  const attendancePct = hasLiveData ? liveStats.attendancePct : (total > 0 ? Math.round((checkedIn / total) * 100) : 0);

  const liveFeed = hasLiveData ? getLiveScanFeed() : getRecentCheckins().map((item) => ({
    participantName: item.name,
    eventName: event.name,
    status: 'CHECKED_IN',
    checkInTime: null,
    checkInTimeDisplay: item.time
  }));

  const feedRows = liveFeed.length
    ? liveFeed.map((reg) => {
      const isOut = reg.status === 'CHECKED_OUT';
      const timeVal = isOut
        ? (reg.checkOutTime?.toDate ? reg.checkOutTime.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : reg.checkInTimeDisplay || '—')
        : (reg.checkInTime?.toDate ? reg.checkInTime.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : reg.checkInTimeDisplay || '—');
      const statusBadge = isOut
        ? `<span class="status-pill" style="background:rgba(99,102,241,.15);color:#6366f1">Checked Out</span>`
        : `<span class="status-pill status-pill--done">Checked In</span>`;
      return `<tr><td><strong>${escapeHtml(reg.participantName || '—')}</strong></td><td>${escapeHtml(reg.email || '—')}</td><td>${statusBadge}</td><td>${escapeHtml(timeVal)}</td></tr>`;
    }).join('')
    : `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted)">No scans yet. Volunteers will scan participants using the QR Scanner.</td></tr>`;

  return `
    <div class="checkin-live-header">
      <div class="checkin-live-dot" title="Real-time listener active"></div>
      <span>Live attendance tracking &mdash; updates instantly as volunteers scan QR codes</span>
    </div>
    <div class="checkin-summary">
      <div class="stat stat--live">
        <label>Total Registered</label>
        <strong id="liveStatTotal">${total}</strong>
      </div>
      <div class="stat stat--live stat--success">
        <label>Checked In</label>
        <strong id="liveStatCheckedIn">${checkedIn}</strong>
      </div>
      <div class="stat stat--live stat--info">
        <label>Checked Out</label>
        <strong id="liveStatCheckedOut">${checkedOut}</strong>
      </div>
      <div class="stat stat--live stat--warn">
        <label>Not Arrived</label>
        <strong id="liveStatNotArrived">${notChecked}</strong>
      </div>
      <div class="stat stat--live stat--accent">
        <label>Attendance %</label>
        <strong id="liveStatPct">${attendancePct}%</strong>
        <div class="attendance-track"><span style="width:${attendancePct}%"></span></div>
      </div>
    </div>
    <div class="section-toolbar" style="margin-top:28px">
      <h2>📹 Live Scan Feed</h2>
      <span style="font-size:11px;color:var(--muted)">${liveFeed.length} scan${liveFeed.length !== 1 ? 's' : ''} recorded</span>
    </div>
    <div class="table-wrap table-scroll">
      <table>
        <thead><tr><th>Participant</th><th>Email</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>${feedRows}</tbody>
      </table>
    </div>`;
}

function renderCreateEvent() {
  const suggestions = ['Marketing', 'Outreach', 'Sponsorship', 'Technical', 'Social Media', 'Content', 'Design', 'Logistics'];
  const slots = state.createSlots || [
    { name: 'CodeSprint 2.0', type: 'Competition', date: '28 Aug 2027', time: '10:00 AM – 01:00 PM', venue: 'Main Auditorium' },
    { name: 'Robowars', type: 'Competition', date: '28 Aug 2027', time: '02:00 PM – 05:00 PM', venue: 'Tech Ground' },
    { name: 'Workshop: AI in Action', type: 'Workshop', date: '29 Aug 2027', time: '10:00 AM – 01:00 PM', venue: 'Seminar Hall 1' },
    { name: 'Guest Talk: Future of Tech', type: 'Session', date: '29 Aug 2027', time: '02:00 PM – 04:00 PM', venue: 'Main Auditorium' },
    { name: 'Project Expo', type: 'Exhibition', date: '30 Aug 2027', time: '10:00 AM – 03:00 PM', venue: 'Open Area' }
  ];
  state.createSlots = slots;
  const selectedDepartments = state.createDepartments || suggestions.slice(0, 5);
  const departmentChip = (name) => `<label class="create-dept-chip ${selectedDepartments.includes(name) ? 'is-selected' : ''}"><input type="checkbox" value="${escapeHtml(name)}" ${selectedDepartments.includes(name) ? 'checked' : ''}>${escapeHtml(name)}</label>`;
  app.innerHTML = `<section class="view create-view create-builder">
    <a href="#" class="back-link" data-action="all-events">← Back to Events</a>
    <div class="create-heading"><div><h1>Create New Event</h1><p>Fill in the details to create a new event. These details will be visible to all participants.</p></div><div class="stepper" aria-label="Event creation steps"><button class="step is-active" data-create-step="details"><b>1</b><span>Details</span></button><button class="step" data-create-step="slots"><b>2</b><span>Slots (Optional)</span></button><button class="step" data-create-step="departments"><b>3</b><span>Departments</span></button><button class="step" data-create-step="review"><b>4</b><span>Review</span></button></div></div>
    <form id="createEventForm">
      <div class="create-columns">
        <div class="create-main-column">
          <section class="builder-card" id="basicInfo"><div class="builder-card__title"><span>1. BASIC INFORMATION</span></div><div class="builder-grid builder-grid--basic"><div><div class="field"><label for="eventName">Event Name <em>*</em></label><input id="eventName" name="eventName" required value="TechRush 2026"></div><div class="field"><label>Event Logo / Cover Image</label><small class="field-note">This will be shown to participants.</small><label class="cover-upload" for="eventLogo"><span class="upload-icon">⇧</span><strong>Drag &amp; drop an image here</strong><span>or</span><button type="button" class="button button--ghost button--small">Upload Image</button><small>PNG, JPG or SVG (Max. 5MB)</small><input id="eventLogo" type="file" accept="image/png,image/jpeg,image/svg+xml"></label><span class="upload-name" id="uploadName"></span></div></div><div><div class="field"><label for="eventCategory">Event Category <em>*</em></label><select id="eventCategory"><option>Technical Festival</option><option>Hackathon</option><option>Sports Festival</option><option>Cultural Event</option></select></div><div class="field"><label for="eventDescription">Short Description <em>*</em></label><textarea id="eventDescription" name="description" maxlength="250">Pulzion is the annual technical festival of PICT where innovation meets creativity. Join us for workshops, competitions, guest talks and much more!</textarea><small class="char-count"><span id="descriptionCount">142</span>/250</small></div><div class="field"><label for="detailedDescription">Detailed Description</label><div class="rich-editor"><div class="rich-toolbar"><button type="button"><b>B</b></button><button type="button"><i>I</i></button><button type="button"><u>U</u></button><span></span><button type="button">☷</button><button type="button">≡</button><button type="button">↗</button></div><textarea id="detailedDescription" placeholder="Tell participants more about your event, its purpose, highlights, what to expect, rules, etc."></textarea></div></div></div></div></section>
          <section class="builder-card" id="dateVenue"><div class="builder-card__title"><span>2. DATE, TIME &amp; VENUE</span><label class="toggle-label"><input id="singleDay" type="checkbox"><span class="toggle"></span>Single Day Event</label></div><div class="builder-grid builder-grid--three"><div class="field"><label for="startDate">Event Start Date <em>*</em></label><input id="startDate" type="date" value="2027-08-28"></div><div class="field"><label for="endDate">Event End Date <em>*</em></label><input id="endDate" type="date" value="2027-08-30"></div><div></div><div class="field"><label for="startTime">Start Time <em>*</em></label><input id="startTime" value="10:00 AM"></div><div class="field"><label for="endTime">End Time <em>*</em></label><input id="endTime" value="06:00 PM"></div><div class="field"><label for="timezone">Timezone <em>*</em></label><select id="timezone"><option>(UTC+05:30) Asia/Kolkata</option><option>(UTC+00:00) Europe/London</option></select></div><div class="field span-two"><label for="venue">Venue / Location <em>*</em></label><input id="venue" value="PICT Campus, Pune"></div><div class="field venue-type"><label for="venueType">Venue Type</label><select id="venueType"><option>Offline</option><option>Online</option><option>Hybrid</option></select></div><div class="field span-two"><label for="address">Full Address</label><input id="address" value="Survey No. 27, Pune-Satara Road, Dhankawadi, Pune, Maharashtra 411043"></div><button type="button" class="button button--ghost button--small map-button" data-action="use-map">⌖ Use map</button></div></section>
          <section class="builder-card" id="eventInfo"><div class="builder-card__title"><span>3. EVENT INFORMATION</span></div><div class="builder-grid builder-grid--three"><div class="field"><label for="expectedParticipants">Expected Participants</label><input id="expectedParticipants" type="number" value="1000"></div><div class="field"><label for="registrationMode">Registration Mode</label><select id="registrationMode"><option>Google Form / External</option><option>EventFlow Registration</option><option>Invite Only</option></select></div><div class="field"><label for="registrationLink">Registration Link (if any)</label><input id="registrationLink" value="https://forms.gle/pulzion2027"></div><div class="field"><label for="website">Event Website</label><input id="website" value="https://pulzion.pict.edu"></div><div class="field"><label for="socialLink">Social Media Link (Optional)</label><input id="socialLink" value="https://instagram.com/pulzion"></div><div class="field"><label for="contactEmail">Contact Email</label><input id="contactEmail" value="pulzion@pict.edu"></div><div class="field"><label for="contactPhone">Contact Phone</label><input id="contactPhone" value="+91 98765 43210"></div><div class="field"><label for="organizer">Event Organiser / Club</label><input id="organizer" value="PICT ACM Student Chapter"></div><div class="field"><label for="hashtag">Event Hashtag (Optional)</label><input id="hashtag" value="#Pulzion2027"></div></div></section>
          <section class="builder-card additional-card" id="additionalDetails"><div class="builder-card__title"><span>4. ADDITIONAL DETAILS</span></div><div class="option-grid"><label class="option-card"><span class="option-icon">♜</span><span><strong>QR Check-in</strong><small>Enable event check-in</small></span><input type="checkbox" checked></label><label class="option-card"><span class="option-icon">♧</span><span><strong>Seat Limit</strong><small>Limited seats</small></span><input type="checkbox"></label><label class="option-card"><span class="option-icon">♧</span><span><strong>Event Kit</strong><small>Includes event kit</small></span><input type="checkbox"></label><label class="option-card"><span class="option-icon">₹</span><span><strong>Payment Required</strong><small>Paid event</small></span><input type="checkbox"></label></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="all-events">Cancel</button><button type="submit" class="button">Save &amp; Continue →</button></div></section>
        </div>
        <aside class="create-side-column">
          <section class="builder-card slots-card" id="eventSlots"><div class="builder-card__title"><span>5. EVENT SLOTS / SUB-EVENTS (OPTIONAL)</span><button type="button" class="button button--ghost button--small" data-action="add-slot">+ Add Slot</button></div><p class="card-description">Add multiple slots or sub-events if applicable. These will be visible to participants.</p><div class="slot-list">${slots.map((slot, index) => slotCard(slot, index)).join('')}</div><div class="info-note">ⓘ Slots are optional. Add them if your event has multiple sessions, competitions, workshops or time-based activities.</div></section>
          <section class="builder-card" id="createDepartments"><div class="builder-card__title"><span>6. DEPARTMENTS</span></div><p class="card-description">Choose the teams that will help run this event.</p><div class="create-dept-grid">${[...new Set([...suggestions, ...(state.createDepartments || [])])].map(departmentChip).join('')}<button type="button" class="create-dept-chip add-custom" data-action="add-custom-department">+ Add Custom Department</button></div></section>
          <section class="builder-card preview-card" id="eventPreview"><div class="builder-card__title"><span>7. PREVIEW</span></div><p class="card-description">This is how the event will appear to participants.</p><div class="event-preview"><div class="preview-cover"><span>✦</span><strong id="previewInitials">TechRush<br>2026</strong></div><div class="preview-content"><h2 id="previewName">Pulzion 2027</h2><p id="previewMeta">28 Aug 2027 – 30 Aug 2027　·　10:00 AM – 06:00 PM</p><p id="previewVenue">⌖ PICT Campus, Pune</p><p id="previewDescription">Pulzion is the annual technical festival of PICT where innovation meets creativity. Join us for workshops, competitions, guest talks and much more!</p><div class="preview-stats"><span>♧ <b>1000</b><small>Expected</small></span><span>⌘ <b id="previewSlotCount">5</b><small>Slots</small></span><span>♧ <b id="previewDeptCount">5</b><small>Departments</small></span><span>⌗ <b>QR</b><small>Check-in</small></span></div></div></div><div class="info-note">ⓘ You can edit all the details later from the event dashboard.</div></section>
        </aside>
      </div>
    </form>
  </section>`;
  syncCreatePreview();
}

function slotCard(slot, index) {
  const tone = slot.type === 'Workshop' ? 'workshop' : slot.type === 'Session' ? 'session' : slot.type === 'Exhibition' ? 'exhibition' : 'competition';
  return `<article class="slot-card"><span class="drag-handle">⠿</span><div class="slot-copy"><h3>${escapeHtml(slot.name)} <span class="slot-type slot-type--${tone}">${escapeHtml(slot.type)}</span></h3><p>▣　${escapeHtml(slot.date)}　　◷　${escapeHtml(slot.time)}　　⌖　${escapeHtml(slot.venue)}</p></div><div class="slot-actions"><button type="button" data-action="edit-slot" data-slot-index="${index}" aria-label="Edit slot">⌑</button><button type="button" data-action="delete-slot" data-slot-index="${index}" aria-label="Delete slot">♧</button></div></article>`;
}

function syncCreatePreview() {
  const name = document.querySelector('#eventName')?.value || 'Pulzion 2027';
  const description = document.querySelector('#eventDescription')?.value || '';
  const venue = document.querySelector('#venue')?.value || 'PICT Campus, Pune';
  const start = document.querySelector('#startDate')?.value || '28 Aug 2027';
  const end = document.querySelector('#endDate')?.value || '30 Aug 2027';
  const nameNode = document.querySelector('#previewName');
  if (!nameNode) return;
  nameNode.textContent = name;
  document.querySelector('#previewDescription').textContent = description;
  document.querySelector('#previewVenue').textContent = `⌖ ${venue}`;
  document.querySelector('#previewMeta').textContent = `${start} – ${end}　·　10:00 AM – 06:00 PM`;
  document.querySelector('#previewSlotCount').textContent = state.createSlots?.length || 0;
  document.querySelector('#previewDeptCount').textContent = document.querySelectorAll('.create-dept-chip input:checked').length;
  document.querySelector('#descriptionCount').textContent = description.length;
}

function renderSimpleCreateEvent() {
  const editingEvent = state.editingEventId ? state.events.find((event) => event.id === state.editingEventId) : null;
  const isEditing = Boolean(editingEvent);
  const eventDateParts = String(editingEvent?.date || '').split(' — ');
  const eventTimeParts = String(editingEvent?.time || '').split(' – ');
  const selectedDepartments = getSelectedCreateDepartments(editingEvent);
  const allDepartments = getCreateDepartmentList();
  const departmentChip = (name) => `<label class="create-dept-chip ${selectedDepartments.includes(name) ? 'is-selected' : ''}"><input type="checkbox" value="${escapeHtml(name)}" ${selectedDepartments.includes(name) ? 'checked' : ''}>${escapeHtml(name)}</label>`;
  app.innerHTML = `<section class="view create-builder simple-create">
    <a href="#" class="back-link" data-action="all-events">← Back to Events</a>
    <div class="create-heading"><div><h1>${isEditing ? 'Edit Event' : 'Create New Event'}</h1><p>${isEditing ? 'Update the details for this event and keep everything in one place.' : 'Add the essential details for your event. You can manage teams, participants and check-ins after creating the event.'}</p></div></div>
    <form id="createEventForm">
      <div class="create-columns">
        <div class="create-main-column">
          <section class="builder-card" id="eventEssentials"><div class="builder-card__title"><span>1. BASIC INFORMATION + DATE, TIME &amp; VENUE</span></div><div class="builder-grid builder-grid--basic"><div class="field"><label for="eventName">Event Name <em>*</em></label><input id="eventName" name="eventName" required value="Pulzion 2027" placeholder="Pulzion 2027"></div><div class="field"><label for="eventCategory">Event Category <em>*</em></label><select id="eventCategory" required><option value="Technical Fest">Technical Fest</option><option>Cultural Fest</option><option>Hackathon</option><option>Workshop</option><option>Competition</option><option>Seminar</option><option>Sports</option><option>Other</option></select></div><div class="field"><label for="eventVisibility">Event Visibility <em>*</em></label><select id="eventVisibility" required><option value="public">🌐 Public (Searchable &amp; Joinable by Participants)</option><option value="private">🔒 Private (Hidden from Participants)</option></select></div><div class="field"><label>Event Logo / Cover Image</label><label class="compact-upload" for="eventLogo"><span class="upload-icon">⇧</span><span>Upload image or drag and drop</span><small>PNG, JPG or SVG · Max. 5MB</small><input id="eventLogo" type="file" accept="image/png,image/jpeg,image/svg+xml"></label><span class="upload-name" id="uploadName"></span></div><div class="field"><label for="eventDescription">Short Description <em>*</em></label><textarea id="eventDescription" name="description" required maxlength="250" placeholder="A short 1–2 sentence description.">Pulzion is the annual technical festival of PICT where innovation meets creativity.</textarea><small class="char-count"><span id="descriptionCount">79</span>/250</small></div><div class="field span-two"><label for="detailedDescription">Detailed Description <span class="optional">(optional)</span></label><textarea id="detailedDescription" placeholder="Explain what the event is about, what participants can expect, and other useful details."></textarea></div><div class="field"><label for="startDate">Event Start Date <em>*</em></label><input id="startDate" type="date" required></div><div class="field"><label for="endDate">Event End Date <em>*</em></label><input id="endDate" type="date" required></div><div class="field"><label for="startTime">Start Time <em>*</em></label><input id="startTime" required value="10:00 AM"></div><div class="field"><label for="endTime">End Time <em>*</em></label><input id="endTime" required value="06:00 PM"></div><div class="field"><label for="timezone">Timezone <em>*</em></label><select id="timezone" required><option>(UTC+05:30) Asia/Kolkata</option><option>(UTC+00:00) Europe/London</option><option>(UTC-05:00) America/New_York</option></select></div><div class="field"><label for="venueType">Venue Type</label><select id="venueType"><option>Offline</option><option>Online</option><option>Hybrid</option></select></div><div class="field span-two"><label for="venue">Venue / Location <em>*</em></label><input id="venue" required value="PICT Campus, Pune" placeholder="PICT Campus, Pune"></div><div class="field"><label for="address">Full Address <span class="optional">(offline / hybrid)</span></label><input id="address" value="PICT Campus, Pune"></div><div class="field"><label for="meetingLink">Meeting / Event Link <span class="optional">(online / hybrid)</span></label><input id="meetingLink" type="url" placeholder="https://meet.google.com/..."></div></div></section>
          <section class="builder-card" id="eventFormation"><div class="builder-card__title"><span>2. EVENT FORMATION</span></div><div class="builder-grid builder-grid--three"><div class="field span-two"><label for="organizer">Event Organizer / Club <em>*</em></label><input id="organizer" required value="PICT ACM Student Chapter" placeholder="PICT ACM Student Chapter"></div><div class="field"><label for="expectedParticipants">Expected Participants</label><input id="expectedParticipants" type="number" min="0" value="1000" placeholder="1000"></div><div class="field"><label for="registrationMode">Registration Mode <em>*</em></label><select id="registrationMode" required><option>External Registration</option><option>Google Form</option><option>Website Registration</option><option>Other</option></select></div><div class="field"><label for="registrationLink">Registration Link <span class="optional">(optional)</span></label><input id="registrationLink" type="url" placeholder="https://forms.gle/..."></div><div class="field"><label for="website">Event Website <span class="optional">(optional)</span></label><input id="website" type="url" placeholder="https://event-website.com"></div><div class="field"><label for="socialLink">Social Media Link <span class="optional">(optional)</span></label><input id="socialLink" type="url" placeholder="https://instagram.com/..."></div><div class="field"><label for="contactEmail">Contact Email <em>*</em></label><input id="contactEmail" type="email" required value="pulzion@pict.edu" placeholder="pulzion@pict.edu"></div><div class="field"><label for="contactPhone">Contact Phone <span class="optional">(optional)</span></label><input id="contactPhone" type="tel" placeholder="+91 98765 43210"></div><div class="field"><label for="hashtag">Event Hashtag <span class="optional">(optional)</span></label><input id="hashtag" value="#Pulzion2027" placeholder="#Pulzion2027"></div></div></section>
        </div>
        <aside class="create-side-column"><section class="builder-card departments-builder" id="eventDepartments"><div class="builder-card__title"><span>3. DEPARTMENTS</span></div><p class="card-description">Choose the teams that will help run this event.</p><div class="create-dept-grid">${allDepartments.map(departmentChip).join('')}<button type="button" class="create-dept-chip add-custom" data-action="add-custom-department">+ Add Custom Department</button></div><div class="info-note">Selected departments will appear inside the event dashboard.</div></section></aside>
      </div>
      <div class="form-actions create-actions"><button type="button" class="button button--ghost" data-action="all-events">Cancel</button><button type="submit" class="button">${isEditing ? 'Save Changes' : 'Create Event'} →</button></div>
    </form>
  </section>`;
  const placeholders = {
    eventName: 'Pulzion 2027', eventDescription: 'A short 1–2 sentence description.', detailedDescription: 'Explain what the event is about and what participants can expect.',
    startDate: '28 Aug 2027', endDate: '30 Aug 2027', startTime: '10:00 AM', endTime: '06:00 PM', venue: 'PICT Campus, Pune', address: 'Full address', meetingLink: 'https://meet.google.com/...',
    organizer: 'PICT ACM Student Chapter', expectedParticipants: '1000', registrationLink: 'https://forms.gle/...', website: 'https://event-website.com', socialLink: 'https://instagram.com/...', contactEmail: 'pulzion@pict.edu', contactPhone: '+91 98765 43210', hashtag: '#Pulzion2027'
  };
  const editValues = editingEvent ? {
    eventName: editingEvent.name || '',
    eventDescription: editingEvent.description || '',
    detailedDescription: editingEvent.detailedDescription || '',
    startDate: editingEvent.startDate || eventDateParts[0] || '',
    endDate: editingEvent.endDate || eventDateParts[1] || eventDateParts[0] || '',
    startTime: editingEvent.startTime || eventTimeParts[0] || '',
    endTime: editingEvent.endTime || eventTimeParts[1] || eventTimeParts[0] || '',
    venue: editingEvent.location || '',
    address: editingEvent.address || '',
    meetingLink: editingEvent.meetingLink || '',
    organizer: editingEvent.organizer || 'PICT ACM Student Chapter',
    expectedParticipants: editingEvent.expectedParticipants ?? '',
    registrationLink: editingEvent.registrationLink || '',
    website: editingEvent.website || '',
    socialLink: editingEvent.socialLink || '',
    contactEmail: editingEvent.contactEmail || 'events@eventflow.com',
    contactPhone: editingEvent.contactPhone || '',
    hashtag: editingEvent.hashtag || ''
  } : {};
  Object.entries(placeholders).forEach(([id, placeholder]) => { const field = document.querySelector(`#${id}`); if (field) { field.value = editValues[id] ?? ''; field.placeholder = placeholder; } });
  const category = document.querySelector('#eventCategory');
  if (category && editingEvent?.type) {
    const option = Array.from(category.options).find((item) => item.value === editingEvent.type || item.textContent === editingEvent.type || (editingEvent.type === 'Technical Festival' && item.value === 'Technical Fest'));
    if (option) category.value = option.value;
  }
  const visibility = document.querySelector('#eventVisibility');
  if (visibility) {
    visibility.innerHTML = editingEvent?.visibility === 'public'
      ? '<option value="public">🌐 Published — use Publish it to change the invitation theme</option>'
      : '<option value="private">◌ Unpublished — choose a theme and use Publish it when ready</option>';
    visibility.value = editingEvent?.visibility === 'public' ? 'public' : 'private';
    visibility.disabled = true;
  }
  const registrationMode = document.querySelector('#registrationMode');
  if (registrationMode && editingEvent?.registrationMode) registrationMode.value = editingEvent.registrationMode;
  const timezone = document.querySelector('#timezone');
  if (timezone && editingEvent?.timezone) timezone.value = editingEvent.timezone;
  const venueType = document.querySelector('#venueType');
  if (venueType && editingEvent?.venueType) venueType.value = editingEvent.venueType;
  const description = document.querySelector('#eventDescription');
  document.querySelector('#descriptionCount').textContent = description.value.length;
}

function showModal(content) { modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><div class="modal">${content}</div></div>`; }
function showWideModal(content) { modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><div class="modal modal--wide">${content}</div></div>`; }
function closeModal() { modalRoot.innerHTML = ''; }
function showToast(message) { const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2600); }

const EVENT_CARD_THEMES = [
  { id: 'harbor', name: 'Harbor', note: 'Calm teal waves with a golden seal.' },
  { id: 'sunset', name: 'Sunset', note: 'Warm coral curves for energetic events.' },
  { id: 'citrus', name: 'Golden Hour', note: 'A bright, celebratory saffron letter.' },
  { id: 'night', name: 'Night Bloom', note: 'A dramatic navy invitation with coral accents.' }
];
const invitationCardPreview = (event, theme) => `<article class="theme-invitation-preview theme-invitation-preview--${theme}"><span class="theme-preview-shape theme-preview-shape--one" aria-hidden="true"></span><span class="theme-preview-shape theme-preview-shape--two" aria-hidden="true"></span><div><p>${escapeHtml(event.type || 'Event')}</p><h3>${escapeHtml(event.name)}</h3><span>${escapeHtml(event.date || 'Date to be announced')}</span><small>${escapeHtml(event.location || 'Venue to be announced')}</small></div></article>`;
function publishEventModal(eventId = state.eventId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  state.publishThemeId = event.cardTheme || 'harbor';
  const themes = EVENT_CARD_THEMES.map((theme) => `<article class="theme-picker ${theme.id === state.publishThemeId ? 'is-selected' : ''}" data-action="select-event-theme" data-theme-id="${theme.id}" role="button" tabindex="0">${invitationCardPreview(event, theme.id)}<strong>${theme.name}</strong><small>${theme.note}</small></article>`).join('');
  showWideModal(`<div class="modal__head"><div><p class="eyebrow">Participant event card</p><h2>${event.visibility === 'public' ? 'Refresh your invitation.' : 'Publish your invitation.'}</h2><p>Choose a visual theme, preview it below, then publish when it feels right.</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="theme-picker-grid">${themes}</div><section class="publish-preview"><div><p class="eyebrow">Live preview</p><h3>How participants will discover this event</h3><p>This card becomes visible in the participant Events tab only after you publish it.</p></div><div data-theme-preview>${invitationCardPreview(event, state.publishThemeId)}</div></section><div class="form-actions"><button class="button button--ghost" data-action="close-modal">Keep private</button><button class="button" data-action="confirm-publish-event" data-event-id="${event.id}">${event.visibility === 'public' ? 'Save theme' : 'Publish Event'} →</button></div>`);
}
function refreshThemePreview() {
  const event = state.events.find((item) => item.id === modalRoot.querySelector('[data-event-id]')?.dataset.eventId);
  const preview = modalRoot.querySelector('[data-theme-preview]');
  if (event && preview) preview.innerHTML = invitationCardPreview(event, state.publishThemeId);
  modalRoot.querySelectorAll('[data-action="select-event-theme"]').forEach((item) => item.classList.toggle('is-selected', item.dataset.themeId === state.publishThemeId));
}
async function publishEvent(eventId, themeId = state.publishThemeId || 'harbor') {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  try {
    const services = await getAdminFirebaseServices();
    if (!services) throw new Error('Firebase is not configured.');
    await services.updateDoc(services.doc(services.db, 'events', event.id), { visibility: 'public', cardTheme: themeId, publishedAt: services.serverTimestamp(), updatedAt: services.serverTimestamp() });
    const index = state.events.findIndex((item) => item.id === event.id);
    if (index >= 0) state.events[index] = { ...state.events[index], visibility: 'public', cardTheme: themeId };
    const localEvents = JSON.parse(localStorage.getItem('eventflowEvents') || '[]');
    localStorage.setItem('eventflowEvents', JSON.stringify(localEvents.map((item) => item.id === event.id ? { ...item, visibility: 'public', cardTheme: themeId } : item)));
    closeModal();
    render();
    showToast('Event published. Participants can see it now.');
  } catch (error) { showToast(error.message || 'Could not publish this event. Please try again.'); }
}

function slotModal(index = -1) {
  const slot = index >= 0 ? state.createSlots[index] : { name: '', type: 'Competition', date: '', time: '', venue: '' };
  showModal(`<div class="modal__head"><div><h2>${index >= 0 ? 'Edit Event Slot' : 'Add Event Slot'}</h2><p>Make a session visible to participants.</p></div><button class="modal-close" data-action="close-modal">×</button></div><form id="slotForm" data-slot-index="${index}"><div class="field"><label for="slotName">Slot Name</label><input id="slotName" required value="${escapeHtml(slot.name)}" placeholder="CodeSprint 2.0"></div><div class="field-grid"><div class="field"><label for="slotType">Type</label><select id="slotType"><option ${slot.type === 'Competition' ? 'selected' : ''}>Competition</option><option ${slot.type === 'Workshop' ? 'selected' : ''}>Workshop</option><option ${slot.type === 'Session' ? 'selected' : ''}>Session</option><option ${slot.type === 'Exhibition' ? 'selected' : ''}>Exhibition</option></select></div><div class="field"><label for="slotDate">Date</label><input id="slotDate" value="${escapeHtml(slot.date)}" placeholder="28 Aug 2027"></div><div class="field"><label for="slotTime">Time</label><input id="slotTime" value="${escapeHtml(slot.time)}" placeholder="10:00 AM – 01:00 PM"></div><div class="field"><label for="slotVenue">Venue</label><input id="slotVenue" value="${escapeHtml(slot.venue)}" placeholder="Main Auditorium"></div></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button class="button" type="submit">${index >= 0 ? 'Save Slot' : 'Add Slot'}</button></div></form>`);
}

function customDepartmentModal() {
  showModal(`<div class="modal__head"><div><h2>Add Custom Department</h2><p>Create a team specific to this event.</p></div><button class="modal-close" data-action="close-modal">×</button></div><form id="customDepartmentForm"><div class="field"><label for="customDepartmentName">Department Name</label><input id="customDepartmentName" required placeholder="Registration Desk"></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button class="button" type="submit">Add Department</button></div></form>`);
}

function addEventDepartmentModal() {
  const event = getEvent();
  if (!event) {
    showToast('Open an event before adding departments.');
    return;
  }
  showModal(`<div class="modal__head"><div><h2>Add Department</h2><p>Add a new team to ${escapeHtml(event.name)}.</p></div><button class="modal-close" data-action="close-modal">×</button></div><form id="eventDepartmentForm"><div class="field"><label for="eventDepartmentName">Department Name</label><input id="eventDepartmentName" required placeholder="Registration Desk"></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button class="button" type="submit">Add Department</button></div></form>`);
}

function volunteerModal(volunteer = {}) {
  const departments = volunteerDepartments();
  showModal(`<div class="modal__head"><div><h2>${volunteer.id ? 'Edit Volunteer' : 'Add Volunteer'}</h2><p>Assign a volunteer to a department for ${escapeHtml(getEvent().name)}.</p></div><button class="modal-close" data-action="close-modal">×</button></div><form id="eventVolunteerForm" data-volunteer-id="${escapeHtml(volunteer.id || '')}"><div class="field"><label for="volunteerName">Full Name <em>*</em></label><input id="volunteerName" required value="${escapeHtml(volunteer.name || '')}" placeholder="Rahul Kadam"></div><div class="field"><label for="volunteerEmail">Email <em>*</em></label><input id="volunteerEmail" type="email" required value="${escapeHtml(volunteer.email || '')}" placeholder="rahul@email.com"></div><div class="field"><label for="volunteerDepartment">Department <em>*</em></label><select id="volunteerDepartment" required>${departments.map((department) => `<option ${department === volunteer.department ? 'selected' : ''}>${escapeHtml(department)}</option>`).join('')}</select></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button class="button" type="submit">${volunteer.id ? 'Save Changes' : 'Add Volunteer'}</button></div></form>`);
}

function removeVolunteerModal(volunteer) {
  showModal(`<div class="modal__head"><div><h2>Remove this volunteer?</h2><p>Are you sure you want to remove ${escapeHtml(volunteer.name)} from this event?</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button type="button" class="button" data-action="confirm-remove-volunteer" data-volunteer-id="${escapeHtml(volunteer.id)}">Remove Volunteer</button></div>`);
}

function volunteerImportModal() {
  state.volunteerImportRows = [];
  state.volunteerImportInvalidRows = [];
  showWideModal(`<div class="modal__head"><div><h2>Import Volunteers</h2><p>Upload an .xlsx roster with Name, Email and Department columns.</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="field"><label for="volunteerExcelFile">Volunteer Excel File</label><input id="volunteerExcelFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div><p class="import-status" id="volunteerImportStatus">Choose an Excel file to preview the roster.</p><div id="volunteerImportPreview"></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button type="button" class="button" data-action="import-volunteer-rows" disabled>Import Volunteers</button></div>`);
}

async function saveVolunteerInvite() {
  const volunteers = getEventVolunteers()
    .map((item) => ({ name: String(item.name || '').trim(), email: normalizeEmail(item.email), department: String(item.department || '').trim() }))
    .filter((item) => item.email);
  const event = getEvent();
  if (!event || !volunteers.length) throw new Error('Add at least one volunteer before creating an invitation link.');
  const invite = { eventId: state.eventId, organizationId: state.organizationId, eventName: event.name, status: 'pending', emails: volunteers.map((item) => item.email), volunteers };
  localStorage.setItem(`eventflowVolunteerInvite:${state.eventId}`, JSON.stringify(invite));
  const services = await getVolunteerFirestoreServices();
  if (!services) return invite;
  await services.setDoc(services.doc(services.db, 'volunteerInvites', state.eventId), { ...invite, updatedAt: services.serverTimestamp() }, { merge: true });
  return invite;
}

async function volunteerInviteModal() {
  const inviteUrl = `${window.location.origin}${window.location.pathname.replace(/admin\.html$/, '')}volunteer-signup.html?eventId=${encodeURIComponent(state.eventId)}&organizationId=${encodeURIComponent(state.organizationId || '')}`;
  try { await saveVolunteerInvite(); } catch (error) { showToast(error.message || 'We could not sync this invitation. Please check your connection and try again.'); return; }
  showModal(`<div class="modal__head"><div><h2>Invite Volunteers</h2><p>Share this link with the volunteer group for ${escapeHtml(getEvent().name)}.</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="invite-context"><strong>${getEventVolunteers().length} eligible volunteer${getEventVolunteers().length === 1 ? '' : 's'}</strong><br>Only emails already added to this event can create a volunteer account.</div><div class="invite-link-box"><input id="volunteerInviteLink" readonly value="${escapeHtml(inviteUrl)}"><button type="button" data-action="copy-volunteer-invite">Copy link</button></div><p class="modal-help">Volunteers can access their workspace immediately after signing up.</p><div class="form-actions"><button class="button" data-action="close-modal">Done</button></div>`);
}

async function parseVolunteerExcel(file) {
  const status = document.querySelector('#volunteerImportStatus');
  const preview = document.querySelector('#volunteerImportPreview');
  const importButton = modalRoot.querySelector('[data-action="import-volunteer-rows"]');
  status.textContent = 'Reading Excel file...';
  try {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const firstRow = rawRows[0] || {};
    const headers = Object.keys(firstRow).map((header) => header.trim().toLowerCase());
    const requiredColumns = ['name', 'email', 'department'];
    if (requiredColumns.some((column) => !headers.includes(column))) { state.volunteerImportRows = []; state.volunteerImportInvalidRows = []; status.textContent = 'Invalid Excel file. Required columns are Name, Email and Department.'; preview.innerHTML = ''; importButton.disabled = true; return; }
    const existingEmails = new Set(getEventVolunteers().map((volunteer) => volunteer.email.toLowerCase()));
    const seenEmails = new Set();
    const rows = rawRows.map((row, index) => {
      const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()]));
      const volunteer = { name: values.name || '', email: values.email || '', department: values.department || '', row: index + 2 };
      const invalid = !volunteer.name || !volunteer.email || !volunteer.department || existingEmails.has(volunteer.email.toLowerCase()) || seenEmails.has(volunteer.email.toLowerCase());
      if (!invalid) seenEmails.add(volunteer.email.toLowerCase());
      return { ...volunteer, invalid, reason: !volunteer.name || !volunteer.email || !volunteer.department ? 'Missing required field' : 'Duplicate email' };
    });
    state.volunteerImportRows = rows.filter((row) => !row.invalid);
    state.volunteerImportInvalidRows = rows.filter((row) => row.invalid);
    status.textContent = `${state.volunteerImportRows.length} valid volunteers · ${state.volunteerImportInvalidRows.length} rows need attention`;
    preview.innerHTML = `<div class="import-preview-summary"><strong>${state.volunteerImportRows.length} valid volunteers</strong><span>${state.volunteerImportInvalidRows.length} rows need attention</span></div><div class="table-wrap table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Validation</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.invalid ? 'import-row-invalid' : ''}"><td>${escapeHtml(row.name || '—')}</td><td>${escapeHtml(row.email || '—')}</td><td>${escapeHtml(row.department || '—')}</td><td>${row.invalid ? escapeHtml(row.reason) : 'Ready to import'}</td></tr>`).join('')}</tbody></table></div>`;
    importButton.disabled = state.volunteerImportRows.length === 0;
  } catch { status.textContent = 'Unable to read this Excel file. Please check the file and try again.'; preview.innerHTML = ''; importButton.disabled = true; }
}

async function saveVolunteerRecord(volunteer, existingId = '') {
  const volunteers = getEventVolunteers();
  const duplicate = volunteers.find((item) => item.email.toLowerCase() === volunteer.email.toLowerCase() && item.id !== existingId);
  if (duplicate) { showToast('A volunteer with this email already exists for this event.'); return false; }
  const record = { ...volunteer, id: existingId || `volunteer-${Date.now()}`, eventId: state.eventId, status: 'Active', updatedAt: new Date().toISOString() };
  const nextVolunteers = existingId ? volunteers.map((item) => item.id === existingId ? { ...item, ...record } : item) : [...volunteers, record];
  saveEventVolunteers(nextVolunteers);
  try {
    const services = await getVolunteerFirestoreServices();
    if (services) {
      const collectionRef = services.collection(services.db, `events/${state.eventId}/volunteers`);
      if (existingId) await services.updateDoc(services.doc(services.db, `events/${state.eventId}/volunteers/${existingId}`), { ...record, updatedAt: services.serverTimestamp() });
      else await services.setDoc(services.doc(collectionRef, record.id), { ...record, createdAt: services.serverTimestamp(), updatedAt: services.serverTimestamp() });
    }
  } catch { }
  try { await saveVolunteerInvite(); } catch (error) { showToast('Volunteer saved, but the invitation list could not be synced. Open Invite Volunteers and try again.'); return false; }
  return true;
}

async function removeVolunteerRecord(volunteerId) {
  const nextVolunteers = getEventVolunteers().filter((item) => item.id !== volunteerId);
  saveEventVolunteers(nextVolunteers);
  try {
    const services = await getVolunteerFirestoreServices();
    if (services) await services.deleteDoc(services.doc(services.db, `events/${state.eventId}/volunteers/${volunteerId}`));
    await saveVolunteerInvite();
    return true;
  } catch {
    showToast('Volunteer removed, but the invitation roster could not be synced. Open Invite Volunteers and try again.');
    return false;
  }
}

async function importVolunteerRows() {
  for (const row of state.volunteerImportRows) await saveVolunteerRecord({ name: row.name, email: row.email, department: row.department });
  const count = state.volunteerImportRows.length;
  closeModal();
  renderWorkspace();
  showToast(`${count} volunteers imported successfully.`);
}

function addParticipantModal(participant = {}) {
  const editing = Boolean(participant.id);
  showModal(`<div class="modal__head"><div><h2>${editing ? 'Edit Participant' : 'Add Participant'}</h2><p>Keep registration details ready for event check-in.</p></div><button class="modal-close" data-action="close-modal">×</button></div><form id="participantForm" data-edit-id="${participant.id || ''}"><div class="field-grid"><div class="field"><label for="participantName">Name</label><input id="participantName" required value="${escapeHtml(participant.name || '')}" placeholder="Rahul Kadam"></div><div class="field"><label for="participantEmailField">Email</label><input id="participantEmailField" type="email" required value="${escapeHtml(participant.email || '')}" placeholder="rahul@email.com"></div><div class="field"><label for="participantPhone">Phone</label><input id="participantPhone" value="${escapeHtml(participant.phone || '')}" placeholder="9876543210"></div><div class="field"><label for="participantCollege">College</label><input id="participantCollege" value="${escapeHtml(participant.college || '')}" placeholder="PICT"></div></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button class="button" type="submit">${editing ? 'Save Participant' : 'Add Participant'}</button></div></form>`);
}

function taskModal() { const volunteers = getEventVolunteers().filter((volunteer) => volunteer.department === getDepartment().name); if (!volunteers.length) { showToast('Add a volunteer to this department before assigning a task.'); return; } showModal(`<div class="modal__head"><div><h2>Assign Task</h2><p>Give a volunteer a clear next step.</p></div><button class="modal-close" data-action="close-modal">×</button></div><form id="taskForm"><div class="field"><label for="taskName">Task Name</label><input id="taskName" required placeholder="Contact 20 colleges"></div><div class="field"><label for="taskDescription">Description</label><textarea id="taskDescription" placeholder="Add task details"></textarea></div><div class="field-grid"><div class="field"><label for="taskAssignee">Assign To</label><select id="taskAssignee">${volunteers.map((volunteer) => `<option value="${escapeHtml(normalizeEmail(volunteer.email))}">${escapeHtml(volunteer.name)} · ${escapeHtml(volunteer.email)}</option>`).join('')}</select></div><div class="field"><label for="taskDeadline">Deadline</label><input id="taskDeadline" placeholder="25 Aug 2027"></div></div><div class="form-actions"><button type="button" class="button button--ghost" data-action="close-modal">Cancel</button><button class="button" type="submit">Assign Task</button></div></form>`); }
let adminQrScanner = null;
let adminScanPaused = false;

function closeScannerAndModal() {
  if (adminQrScanner) {
    try { adminQrScanner.clear(); } catch { }
    adminQrScanner = null;
  }
  adminScanPaused = false;
  closeModal();
}

async function adminHandleQrScan(qrToken) {
  if (adminScanPaused) return;
  adminScanPaused = true;

  const resultEl = document.getElementById('adminScanResult');
  const iconEl = document.getElementById('adminScanIcon');
  const titleEl = document.getElementById('adminScanTitle');
  const subEl = document.getElementById('adminScanSub');

  const show = (type, icon, title, sub) => {
    if (!resultEl) return;
    resultEl.hidden = false;
    resultEl.className = `admin-scan-result admin-scan-result--${type}`;
    iconEl.textContent = icon;
    titleEl.textContent = title;
    subEl.textContent = sub;
  };

  try {
    const services = await getAdminFirebaseServices();
    if (!services) throw new Error('Firebase not configured.');

    const regRef = services.doc(services.db, 'registrations', qrToken);
    const regSnap = await services.getDoc(regRef);

    if (!regSnap.exists()) {
      show('error', '✕', 'Invalid QR Code', 'This token was not found in the system.');
      setTimeout(() => { if (resultEl) resultEl.hidden = true; adminScanPaused = false; }, 3000);
      return;
    }

    const data = regSnap.data();
    const adminUser = state.adminUser || {};

    if (data.status === 'REGISTERED') {
      await services.updateDoc(regRef, {
        status: 'CHECKED_IN',
        checkInTime: services.serverTimestamp(),
        volunteerId: adminUser.uid || 'admin',
        volunteerName: adminUser.name || 'Admin'
      });
      // Sync legacy collection
      try {
        await services.updateDoc(
          services.doc(services.db, 'participantRegistrations', `${data.participantId}_${data.eventId}`),
          { status: 'Checked In', attendance: 'Checked In', checkedInAt: new Date().toISOString() }
        );
      } catch { }
      show('success', '✓', `Checked In — ${data.participantName}`, `Event: ${data.eventName || data.eventId}`);

    } else if (data.status === 'CHECKED_IN') {
      await services.updateDoc(regRef, {
        status: 'CHECKED_OUT',
        checkOutTime: services.serverTimestamp()
      });
      show('checkout', '↩', `Checked Out — ${data.participantName}`, `Event: ${data.eventName || data.eventId}`);

    } else {
      show('error', '!', 'Already Processed', `${data.participantName} has already checked out.`);
    }
  } catch (err) {
    show('error', '✕', 'Scan Error', err.message || 'Could not process this QR code.');
  }

  setTimeout(() => { if (resultEl) resultEl.hidden = true; adminScanPaused = false; }, 3500);
}

function scannerModal(retryCount = 0) {
  showWideModal(`
    <div class="modal__head">
      <div>
        <p class="eyebrow">Attendance tool</p>
        <h2>Scan Participant QR</h2>
        <p>Point the camera at the participant's QR code to check them in.</p>
      </div>
      <button class="modal-close" data-action="close-scanner-modal">×</button>
    </div>
    <div id="adminQrReader" style="width:100%;background:#0f172a;border-radius:12px;overflow:hidden;"></div>
    <div id="adminScanResult" class="admin-scan-result" hidden>
      <div class="scanner-result__icon" id="adminScanIcon">✓</div>
      <div class="scanner-result__body">
        <strong id="adminScanTitle"></strong>
        <span id="adminScanSub"></span>
      </div>
    </div>
    <div class="form-actions" style="margin-top:16px">
      <button class="button button--ghost" data-action="close-scanner-modal">Close Scanner</button>
    </div>
  `);

  // Mount after modal is in DOM
  requestAnimationFrame(() => {
    const readerEl = document.getElementById('adminQrReader');
    if (!readerEl) return;

    if (typeof Html5QrcodeScanner === 'undefined') {
      if (retryCount < 10) {
        setTimeout(() => scannerModal(retryCount + 1), 500);
      } else {
        readerEl.innerHTML = '<p style="color:#f87171;padding:20px;text-align:center">QR scanner library failed to load. Check your internet connection.</p>';
      }
      return;
    }

    if (adminQrScanner) { try { adminQrScanner.clear(); } catch { } }
    adminScanPaused = false;
    adminQrScanner = new Html5QrcodeScanner(
      'adminQrReader',
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true, showTorchButtonIfSupported: true, aspectRatio: 1.0 },
      false
    );
    adminQrScanner.render(
      (decodedText) => adminHandleQrScan(decodedText.trim()),
      (_err) => { /* ignore per-frame errors */ }
    );
  });
}

function resultModal(type) {
  const result = type === 'success' ? { cls: 'result-state--success', icon: '✓', title: 'Check-in Successful', text: 'Participant checked in.', action: 'Done' } : type === 'already' ? { cls: 'result-state--warning', icon: '!', title: 'Already Checked In', text: 'This participant was already checked in.', action: 'Scan Again' } : { cls: 'result-state--error', icon: '×', title: 'Invalid Participant', text: 'This participant is not registered for this event.', action: 'Scan Again' };
  showModal(`<div class="result-state ${result.cls}"><div class="result-icon">${result.icon}</div><h2>${result.title}</h2><p>${result.text}</p><button class="button" data-action="${type === 'success' ? 'close-modal' : 'scan-qr'}">${result.action}</button></div>`);
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action], [data-event-id], [data-department-id], [data-workspace-tab], [data-dept-tab], [data-participant-filter]');
  if (!target) return;
  if (target.dataset.eventId && !target.dataset.action) { state.eventId = target.dataset.eventId; state.workspaceTab = 'overview'; state.view = 'workspace'; render(); return; }
  if (target.dataset.departmentId) { state.departmentId = target.dataset.departmentId; state.departmentTab = 'progress'; state.view = 'department'; render(); return; }
  if (target.dataset.workspaceTab) { state.workspaceTab = target.dataset.workspaceTab; render(); return; }
  if (target.dataset.deptTab) { state.departmentTab = target.dataset.deptTab; render(); return; }
  if (target.dataset.participantFilter) { state.participantFilter = target.dataset.participantFilter; render(); return; }
  if (target.dataset.createStep) {
    const targetIds = { details: 'basicInfo', slots: 'eventSlots', departments: 'createDepartments', review: 'eventPreview' };
    document.querySelector(`#${targetIds[target.dataset.createStep]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.step').forEach((step) => step.classList.toggle('is-active', step.dataset.createStep === target.dataset.createStep));
    return;
  }
  const action = target.dataset.action;
  if (action === 'create-event') { state.editingEventId = null; state.createDepartments = null; state.view = 'create'; render(); }
  if (action === 'edit-event') { state.editingEventId = state.eventId; state.createDepartments = getEvent()?.departmentNames || null; state.view = 'create'; render(); }
  if (action === 'publish-event') { publishEventModal(target.dataset.eventId || state.eventId); }
  if (action === 'select-event-theme') { state.publishThemeId = target.dataset.themeId; refreshThemePreview(); }
  if (action === 'confirm-publish-event') { await publishEvent(target.dataset.eventId, state.publishThemeId); }
  if (action === 'add-slot') slotModal();
  if (action === 'edit-slot') slotModal(Number(target.dataset.slotIndex));
  if (action === 'delete-slot') { state.createSlots.splice(Number(target.dataset.slotIndex), 1); render(); showToast('Event slot removed.'); }
  if (action === 'add-custom-department') customDepartmentModal();
  if (action === 'use-map') showToast('Map picker is ready for a maps integration.');
  if (action === 'all-events') { state.editingEventId = null; state.view = 'events'; loadOrganizationEvents().then(() => render()); return; }
  if (action === 'departments') { state.view = 'workspace'; state.workspaceTab = 'departments'; render(); }
  if (action === 'add-department') addEventDepartmentModal();
  if (action === 'assign-task') taskModal();
  if (action === 'edit-task') taskModal();
  if (action === 'add-remark') showToast('Remark composer ready for Firebase integration.');
  if (action === 'add-volunteer') volunteerModal();
  if (action === 'invite-volunteers') await volunteerInviteModal();
  if (action === 'copy-volunteer-invite') { navigator.clipboard?.writeText(document.querySelector('#volunteerInviteLink')?.value || '').then(() => showToast('Invitation link copied.')); }
  if (action === 'import-volunteers') volunteerImportModal();
  if (action === 'import-volunteer-rows') importVolunteerRows();
  if (action === 'edit-event-volunteer') { const volunteer = getEventVolunteers().find((item) => item.id === target.dataset.volunteerId); if (volunteer) volunteerModal(volunteer); }
  if (action === 'remove-event-volunteer') { const volunteer = getEventVolunteers().find((item) => item.id === target.dataset.volunteerId); if (volunteer) removeVolunteerModal(volunteer); }
  if (action === 'confirm-remove-volunteer') {
    const removed = await removeVolunteerRecord(target.dataset.volunteerId);
    closeModal();
    renderWorkspace();
    if (removed) showToast('Volunteer removed from this event.');
  }
  if (action === 'add-participant') addParticipantModal();
  if (action === 'edit-participant') { const participant = getEventParticipants().find((item) => String(item.id) === target.dataset.participantId); addParticipantModal(participant); }
  if (action === 'delete-participant') {
    saveEventParticipants(getEventParticipants().filter((item) => String(item.id) !== target.dataset.participantId));
    render();
    showToast('Participant removed.');
  }
  if (action === 'scan-qr') scannerModal();
  if (action === 'close-scanner-modal') { closeScannerAndModal(); return; }
  if (action === 'close-modal') closeModal();
  if (action === 'volunteer-detail') { const volunteer = target.dataset.volunteerId ? getEventVolunteers().find((item) => item.id === target.dataset.volunteerId) : state.volunteers.find((item) => item.name === target.dataset.volunteer); if (volunteer) showModal(`<div class="modal__head"><div><h2>${escapeHtml(volunteer.name)}</h2><p>${escapeHtml(volunteer.department || 'Marketing')} Department · ${escapeHtml(volunteer.status || 'Active')}</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="stats-row"><div class="stat"><label>Assigned Tasks</label><strong>${volunteer.tasks || 0}</strong></div><div class="stat"><label>Progress</label><strong>${volunteer.progress || 0}%</strong></div></div><p style="color:var(--muted);font-size:11px;margin:20px 0 0">Volunteer assignment for ${escapeHtml(getEvent().name)}.</p>`); }
  if (action === 'profile' || action === 'settings') { document.querySelector('#profileMenu').hidden = true; showToast(`${action[0].toUpperCase() + action.slice(1)} is ready for Firebase integration.`); }
  if (action === 'logout') { getAdminFirebaseServices().then((services) => services?.signOut(services.auth)).catch(() => { }).finally(() => { sessionStorage.clear(); window.location.href = 'team-login.html'; }); }
});

app.addEventListener('input', (event) => {
  if (event.target.id === 'participantSearch') { state.participantSearch = event.target.value; const cursor = event.target.selectionStart; render(); const input = document.querySelector('#participantSearch'); input.focus(); input.setSelectionRange(cursor, cursor); }
  if (state.view === 'create' && ['eventName', 'eventDescription', 'venue', 'startDate', 'endDate'].includes(event.target.id)) syncCreatePreview();
});

app.addEventListener('change', (event) => {
  if (event.target.matches('.department-chip input')) event.target.closest('.department-chip').classList.toggle('is-selected', event.target.checked);
  if (event.target.matches('.create-dept-chip input')) { event.target.closest('.create-dept-chip').classList.toggle('is-selected', event.target.checked); state.createDepartments = Array.from(document.querySelectorAll('.create-dept-chip input:checked')).map((input) => input.value); syncCreatePreview(); }
  if (event.target.id === 'singleDay') { const endDate = document.querySelector('#endDate'); if (endDate) { endDate.disabled = event.target.checked; endDate.style.opacity = event.target.checked ? '.45' : '1'; } }
  if (event.target.id === 'eventLogo') { const file = event.target.files?.[0]; const name = document.querySelector('#uploadName'); if (name && file) name.textContent = `${file.name} selected`; }
});

modalRoot.addEventListener('click', (event) => { if (event.target.matches('[data-modal-backdrop]')) closeModal(); });
modalRoot.addEventListener('change', (event) => { if (event.target.id === 'volunteerExcelFile' && event.target.files?.[0]) parseVolunteerExcel(event.target.files[0]); });
modalRoot.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'close-modal') closeModal();
  if (action === 'select-event-theme') { state.publishThemeId = event.target.closest('[data-action]').dataset.themeId; refreshThemePreview(); }
  if (action === 'confirm-publish-event') await publishEvent(event.target.closest('[data-action]').dataset.eventId, state.publishThemeId);
  if (action === 'scan-qr') scannerModal();
  if (action === 'scan-result') resultModal(event.target.closest('[data-action]').dataset.result);
  if (action === 'import-volunteer-rows') importVolunteerRows();
  if (action === 'confirm-remove-volunteer') {
    const volunteerId = event.target.closest('[data-action]').dataset.volunteerId;
    const removed = await removeVolunteerRecord(volunteerId);
    closeModal();
    renderWorkspace();
    if (removed) showToast('Volunteer removed from this event.');
  }
});

app.addEventListener('submit', async (event) => {
  if (event.target.id !== 'createEventForm') return;
  event.preventDefault();
  const missingRequiredField = Array.from(event.target.querySelectorAll('[required]')).find((field) => !field.value.trim());
  if (missingRequiredField) {
    missingRequiredField.focus();
    showToast('Please complete all required event details.');
    return;
  }
  const eventName = document.querySelector('#eventName').value.trim();
  const departmentNames = Array.from(document.querySelectorAll('.create-dept-chip input:checked')).map((input) => input.value);
  const startDate = document.querySelector('#startDate')?.value.trim() || '';
  const endDate = document.querySelector('#endDate')?.value.trim() || startDate;
  const dateLabel = startDate && endDate && startDate !== endDate ? `${startDate} – ${endDate}` : (startDate || endDate);
  const shortDescription = document.querySelector('#eventDescription').value.trim();
  const venue = document.querySelector('#venue').value.trim() || 'Venue to be announced';
  const existingEvent = state.editingEventId ? state.events.find((item) => item.id === state.editingEventId) : null;
  const extendedFields = {
    visibility: existingEvent?.visibility || 'private',
    cardTheme: existingEvent?.cardTheme || 'harbor',
    eventCategory: document.querySelector('#eventCategory')?.value || 'Event',
    time: `${document.querySelector('#startTime')?.value || ''} – ${document.querySelector('#endTime')?.value || ''}`.trim(),
    startDate,
    endDate,
    startTime: document.querySelector('#startTime')?.value || '',
    endTime: document.querySelector('#endTime')?.value || '',
    detailedDescription: document.querySelector('#detailedDescription')?.value || '',
    organizer: document.querySelector('#organizer')?.value || '',
    expectedParticipants: document.querySelector('#expectedParticipants')?.value || '',
    registrationMode: document.querySelector('#registrationMode')?.value || '',
    registrationLink: document.querySelector('#registrationLink')?.value || '',
    website: document.querySelector('#website')?.value || '',
    socialLink: document.querySelector('#socialLink')?.value || '',
    contactEmail: document.querySelector('#contactEmail')?.value || '',
    contactPhone: document.querySelector('#contactPhone')?.value || '',
    hashtag: document.querySelector('#hashtag')?.value || '',
    address: document.querySelector('#address')?.value || '',
    meetingLink: document.querySelector('#meetingLink')?.value || '',
    venueType: document.querySelector('#venueType')?.value || '',
    timezone: document.querySelector('#timezone')?.value || ''
  };

  const saveLocalEvent = (newEvent) => {
    try {
      const storageKey = adminEventsStorageKey();
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const index = list.findIndex((item) => item.id === newEvent.id || String(item.eventName || item.name).toLowerCase() === String(newEvent.eventName || newEvent.name).toLowerCase());
      if (index >= 0) {
        list[index] = { ...list[index], ...newEvent };
      } else {
        list.unshift(newEvent);
      }
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch { }
  };

  const firestorePayload = {
    eventName,
    shortDescription,
    venue,
    date: dateLabel,
    departments: departmentNames,
    organizationId: state.organizationId || 'demo-org',
    ...extendedFields
  };

  const localPayload = {
    id: existingEvent ? existingEvent.id : `event-${Date.now()}`,
    name: eventName,
    eventName,
    shortDescription,
    description: shortDescription,
    venue,
    location: venue,
    date: dateLabel,
    departments: departmentNames,
    organizationId: state.organizationId || 'demo-org',
    status: 'Upcoming',
    visibility: extendedFields.visibility || 'private',
    ...extendedFields
  };
  saveLocalEvent(localPayload);

  try {
    const services = await getAdminFirebaseServices();
    if (services && state.organizationId && state.adminUid) {
      if (existingEvent) {
        await services.updateDoc(services.doc(services.db, 'events', existingEvent.id), {
          ...firestorePayload,
          status: existingEvent.status || 'Upcoming',
          updatedAt: services.serverTimestamp()
        });
      } else {
        const eventRef = await services.addDoc(services.collection(services.db, 'events'), {
          ...firestorePayload,
          createdBy: state.adminUid,
          createdAt: services.serverTimestamp(),
          status: 'Upcoming',
          participants: 0,
          volunteers: 0,
          checkedIn: 0
        });
        localPayload.id = eventRef.id;
        saveLocalEvent(localPayload);
      }
    }
  } catch (err) {
    console.warn('Firestore write failed, event saved locally:', err);
  }

  state.editingEventId = null;
  await loadOrganizationEvents();
  state.eventId = localPayload.id;
  state.view = 'events';
  render();
  showToast(existingEvent ? 'Event updated successfully.' : 'Event created successfully.');
});

modalRoot.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.target.id === 'eventVolunteerForm') {
    const volunteerId = event.target.dataset.volunteerId;
    const saved = await saveVolunteerRecord({ name: document.querySelector('#volunteerName').value.trim(), email: document.querySelector('#volunteerEmail').value.trim(), department: document.querySelector('#volunteerDepartment').value }, volunteerId);
    if (saved) { closeModal(); render(); showToast(volunteerId ? 'Volunteer updated successfully.' : 'Volunteer added successfully.'); }
  }
  if (event.target.id === 'participantForm') {
    const editId = event.target.dataset.editId;
    const participantName = document.querySelector('#participantName').value.trim();
    const participantEmail = document.querySelector('#participantEmailField').value.trim();
    const phone = document.querySelector('#participantPhone').value.trim();
    const college = document.querySelector('#participantCollege').value.trim();
    const details = {
      name: participantName,
      participantName,
      email: participantEmail,
      participantEmail,
      phone,
      college,
      registration: 'Registered',
      attendance: 'Not Checked In',
      status: 'Registered'
    };
    try {
      const services = await getAdminFirebaseServices();
      if (services && state.eventId) {
        const pid = editId || `manual-${Date.now()}`;
        await services.setDoc(services.doc(services.db, `events/${state.eventId}/participants`, pid), {
          ...details,
          registeredAt: services.serverTimestamp()
        }, { merge: true });
      }
    } catch (err) { console.error('Save participant error:', err); }
    closeModal();
    render();
    showToast(editId ? 'Participant updated.' : 'Participant added.');
  }
  if (event.target.id === 'taskForm') {
    const assignedEmail = normalizeEmail(document.querySelector('#taskAssignee').value);
    const volunteer = getEventVolunteers().find((item) => normalizeEmail(item.email) === assignedEmail);
    if (!volunteer) { showToast('Choose a volunteer from this event.'); return; }
    try {
      const services = await getAdminFirebaseServices();
      if (!services) throw new Error('Firebase is not configured.');
      await services.addDoc(services.collection(services.db, 'tasks'), { eventId: state.eventId, organizationId: state.organizationId, department: getDepartment().name, title: document.querySelector('#taskName').value.trim(), description: document.querySelector('#taskDescription').value.trim(), dueDate: document.querySelector('#taskDeadline').value.trim() || 'To be decided', assignedEmail, assigneeName: volunteer.name, completed: false, createdAt: services.serverTimestamp(), updatedAt: services.serverTimestamp() });
      closeModal();
      showToast('Task assigned successfully. The volunteer can see it now.');
    } catch (error) { showToast(error.message || 'Could not assign this task. Please try again.'); }
  }
  if (event.target.id === 'slotForm') { const index = Number(event.target.dataset.slotIndex); const slot = { name: document.querySelector('#slotName').value, type: document.querySelector('#slotType').value, date: document.querySelector('#slotDate').value, time: document.querySelector('#slotTime').value, venue: document.querySelector('#slotVenue').value }; if (index >= 0) state.createSlots[index] = slot; else state.createSlots.push(slot); closeModal(); render(); showToast(index >= 0 ? 'Event slot updated.' : 'Event slot added.'); }
  if (event.target.id === 'eventDepartmentForm') {
    const name = document.querySelector('#eventDepartmentName').value.trim();
    if (!name) return;
    const saved = await saveEventDepartment(name);
    if (saved) {
      closeModal();
      render();
      showToast(`${name} added to this event.`);
    }
  }
  if (event.target.id === 'customDepartmentForm') {
    const name = document.querySelector('#customDepartmentName').value.trim();
    if (!name) return;
    syncCreateDepartmentsFromDom();
    const duplicate = getCreateDepartmentList().find((department) => department.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      showToast(`"${duplicate}" is already in the department list.`);
      closeModal();
      render();
      return;
    }
    state.createDepartments = [...new Set([...(state.createDepartments || []), name])];
    closeModal();
    render();
    showToast(`${name} added to this event.`);
  }
});

document.querySelector('#profileTrigger').addEventListener('click', () => { const menu = document.querySelector('#profileMenu'); menu.hidden = !menu.hidden; document.querySelector('#profileTrigger').setAttribute('aria-expanded', String(!menu.hidden)); });
document.querySelector('#profileMenu').addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  document.querySelector('#profileMenu').hidden = true;
  if (action === 'logout') { try { const services = await getAdminFirebaseServices(); if (services) await services.signOut(services.auth); } catch { } sessionStorage.clear(); window.location.href = 'team-login.html'; }
  if (action === 'profile' || action === 'settings') showToast(`${action[0].toUpperCase() + action.slice(1)} is ready for Firebase integration.`);
});
document.addEventListener('click', (event) => { if (!event.target.closest('.profile-wrap')) { document.querySelector('#profileMenu').hidden = true; document.querySelector('#profileTrigger').setAttribute('aria-expanded', 'false'); } });

render();
bootstrapAdminSession().then((authenticated) => {
  if (authenticated) render();
});

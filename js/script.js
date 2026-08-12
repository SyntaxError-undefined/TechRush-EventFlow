if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const header = document.querySelector('.site-header');
const nav = document.querySelector('#nav');
const menuToggle = document.querySelector('#menu-toggle');
const openIcon = document.querySelector('.menu-toggle__icon--open');
const closeIcon = document.querySelector('.menu-toggle__icon--close');

const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 12);
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

menuToggle?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  openIcon?.style && (openIcon.style.display = isOpen ? 'none' : 'block');
  closeIcon?.style && (closeIcon.style.display = isOpen ? 'block' : 'none');
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (openIcon) openIcon.style.display = 'block';
    if (closeIcon) closeIcon.style.display = 'none';
  });
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}

const dashboardWrap = document.querySelector('.features__visual .dashboard-wrap');
const dashboard = document.querySelector('.features__visual .dashboard');

dashboardWrap?.addEventListener('pointermove', (event) => {
  if (window.matchMedia('(hover: none)').matches) return;
  const bounds = dashboardWrap.getBoundingClientRect();
  const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 3;
  const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -3;
  dashboard.style.transform = `perspective(1100px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

dashboardWrap?.addEventListener('pointerleave', () => {
  dashboard.style.transform = '';
});

const roleContent = {
  admin: {
    eyebrow: 'EVENT MANAGEMENT, REIMAGINED',
    title: 'Plan Smarter.<br>Collaborate Better.<br><span>Create Impact.</span>',
    description: 'Bring your events, teams, registrations, and tasks together in one calm, collaborative workspace.',
    secondaryAction: 'See how it works',
    artTitle: 'LIVE<br><small>EVENT</small>', artName: 'TechRush 2026', artDate: 'August 2026', artLocation: 'PICT Campus, Pune',
    stats: [['500+', 'Events Managed'], ['10K+', 'Participants'], ['200+', 'Teams'], ['99.9%', 'Successful Check-ins'], ['24/7', 'Support']],
    featureCards: [['Bring your team together', 'Keep departments, volunteers, and responsibilities aligned from one shared workspace.'], ['Make every detail count', 'Plan schedules, manage registrations, and keep your event moving without the busywork.'], ['See your impact clearly', 'Real-time progress and check-ins help your team make better decisions, faster.']],
    workflowSteps: [['Create your event', 'Set the details and get your event moving in minutes.'], ['Build your team', 'Bring the right people together around a shared goal.'], ['Track the work', 'Keep tasks, progress, and check-ins in one place.'], ['Make an impact', 'Learn from the event and make the next one better.']],
    journeyEyebrow: 'BUILT FOR EVERYONE', featureEyebrow: 'MADE FOR EVENT TEAMS', featureTitle: 'Everything you need<br><span>to make it happen.</span>', featureDescription: 'From the first idea to the final check-in, EventFlow brings every moving piece into one clear, collaborative workspace.', workflowEyebrow: 'SIMPLE BY DESIGN', workflowTitle: 'From idea to impact.', ctaEyebrow: 'READY WHEN YOU ARE', ctaTitle: 'Make your next event unforgettable.', ctaDescription: 'Start planning smarter with EventFlow today.'
  },
  participant: {
    eyebrow: 'YOUR NEXT EXPERIENCE STARTS HERE',
    title: 'Find your next<br><span>something unforgettable.</span>',
    description: 'Discover events you’ll love, register in seconds, and keep every pass, schedule, and certificate in one place.',
    secondaryAction: 'Explore events',
    artTitle: 'YOUR<br><small>PASS</small>', artName: 'TechRush 2026', artDate: 'August 2026', artLocation: 'Pune · 2,400 attending',
    stats: [['120+', 'Events to Explore'], ['2.4K+', 'Passes Issued'], ['1 place', 'For Every Pass'], ['98%', 'Happy Participants'], ['Always', 'Up to Date']],
    featureCards: [['Find events you’ll love', 'Browse experiences that match your interests, campus, and the moments you want to make.'], ['Keep every detail close', 'See schedules, venues, updates, and event information without hunting through messages.'], ['Make every pass count', 'Register with confidence, check in easily, and keep your certificates ready whenever you need them.']],
    workflowSteps: [['Discover an event', 'Explore experiences that match your interests and plans.'], ['Save your spot', 'Register in a few taps and get your event pass instantly.'], ['Show up ready', 'Keep your schedule, venue, and QR pass close at hand.'], ['Enjoy the moment', 'Take part, collect memories, and access your certificate after.']],
    journeyEyebrow: 'MADE FOR YOUR MOMENT', featureEyebrow: 'EVERYTHING IN ONE PLACE', featureTitle: 'Show up for<br><span>what matters to you.</span>', featureDescription: 'Your event life, without the scattered links and last-minute searching. Find, join, and enjoy the experience.', workflowEyebrow: 'YOUR EVENT, SIMPLIFIED', workflowTitle: 'Discover. Join. Experience.', ctaEyebrow: 'YOUR NEXT ADVENTURE', ctaTitle: 'There’s something waiting for you.', ctaDescription: 'Find an event, save your pass, and make your next memory with EventFlow.'
  }
};

const roleButtons = document.querySelectorAll('.toggle-btn[data-role]');
const rolePageLinks = document.querySelectorAll('[data-role-link]');
const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.innerHTML = value; };
const setRole = (role, announce = false) => {
  const content = roleContent[role] || roleContent.admin;
  document.body.dataset.role = role;
  document.body.classList.toggle('participant-mode', role === 'participant');
  roleButtons.forEach((button) => { const active = button.dataset.role === role; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  setText('[data-copy="eyebrow"]', content.eyebrow); setText('[data-copy="title"]', content.title); setText('[data-copy="description"]', content.description); setText('[data-copy="secondaryAction"]', content.secondaryAction);
  setText('[data-copy="journeyEyebrow"]', content.journeyEyebrow); setText('[data-copy="featureEyebrow"]', content.featureEyebrow); setText('[data-copy="featureTitle"]', content.featureTitle); setText('[data-copy="featureDescription"]', content.featureDescription); setText('[data-copy="workflowEyebrow"]', content.workflowEyebrow); setText('[data-copy="workflowTitle"]', content.workflowTitle); setText('[data-copy="ctaEyebrow"]', content.ctaEyebrow); setText('[data-copy="ctaTitle"]', content.ctaTitle); setText('[data-copy="ctaDescription"]', content.ctaDescription);
  setText('[data-art="title"]', content.artTitle); setText('[data-art="name"]', content.artName); setText('[data-art="date"]', content.artDate); setText('[data-art="location"]', content.artLocation);
  content.stats.forEach(([value, label], index) => { setText(`[data-stat="${['one','two','three','four','five'][index]}"]`, value); setText(`[data-stat-label="${['one','two','three','four','five'][index]}"]`, label); });
  content.featureCards.forEach(([title, description], index) => { const number = ['one', 'two', 'three'][index]; setText(`[data-feature="${number}-title"]`, title); setText(`[data-feature="${number}-description"]`, description); });
  content.workflowSteps.forEach(([title, description], index) => { const number = ['one', 'two', 'three', 'four'][index]; setText(`[data-workflow="${number}-title"]`, title); setText(`[data-workflow="${number}-description"]`, description); });
  rolePageLinks.forEach((link) => { link.href = link.dataset.roleLink === 'login' ? (role === 'admin' ? 'team-login.html' : 'participant-login.html') : role === 'admin' ? 'register-admin.html' : 'participant-signup.html'; });
  if (announce) document.querySelector('.role-switch')?.animate([{ transform:'scale(.98)' }, { transform:'scale(1)' }], { duration:280, easing:'ease-out' });
};

roleButtons.forEach((button) => button.addEventListener('click', () => setRole(button.dataset.role, true)));
setRole('participant');

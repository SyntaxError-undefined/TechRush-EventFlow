const query = new URLSearchParams(window.location.search);
const eventId = query.get('eventId') || '';
const organizationId = query.get('organizationId') || '';
const inviteContext = document.querySelector('#inviteContext');
const signupForm = document.querySelector('#volunteerSignupForm');
const signupStatus = document.querySelector('#signupStatus');
const emailInput = document.querySelector('#volunteerEmail');
const nameInput = document.querySelector('#volunteerName');
const passwordInput = document.querySelector('#volunteerPassword');
const confirmInput = document.querySelector('#volunteerConfirmPassword');
const googleButton = document.querySelector('#volunteerGoogleButton');
let firebaseServices;
let invite;
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const setStatus = (element, message, type = '') => { element.textContent = message; element.className = `auth-status${type ? ` is-${type}` : ''}`; };
const error = (input, message) => { const group = input.closest('.field-group'); group.classList.add('has-error'); group.querySelector('.field-error').textContent = message; };
const clear = (input) => { const group = input.closest('.field-group'); group.classList.remove('has-error'); group.querySelector('.field-error').textContent = ''; };
// ── Password strength ────────────────────────────────────────────────────────
const PW_RULES = [
  { id: 'rule-len',     test: (pw) => pw.length >= 8,           label: '8+ characters' },
  { id: 'rule-upper',   test: (pw) => /[A-Z]/.test(pw),         label: 'Uppercase letter' },
  { id: 'rule-lower',   test: (pw) => /[a-z]/.test(pw),         label: 'Lowercase letter' },
  { id: 'rule-num',     test: (pw) => /[0-9]/.test(pw),         label: 'Number' },
  { id: 'rule-special', test: (pw) => /[^A-Za-z0-9]/.test(pw), label: 'Special character (!@#$…)' }
];
const validatePassword = (pw) => PW_RULES.map((rule) => ({ ...rule, met: rule.test(pw) }));
const countMet = (pw) => validatePassword(pw).filter((r) => r.met).length;

const strengthWidget = document.getElementById('pwStrength');
const strengthSegs = [1, 2, 3, 4].map((n) => document.getElementById(`pwSeg${n}`));
const SEG_CLASSES = ['is-weak', 'is-fair', 'is-good', 'is-strong'];

const updateStrengthMeter = (pw) => {
  if (!pw) { strengthWidget?.classList.remove('is-visible'); return; }
  strengthWidget?.classList.add('is-visible');
  const met = countMet(pw);
  const level = met <= 1 ? 0 : met <= 2 ? 1 : met <= 3 ? 2 : met <= 4 ? 3 : 4;
  strengthSegs.forEach((seg, i) => {
    SEG_CLASSES.forEach((cls) => seg.classList.remove(cls));
    if (i < level) seg.classList.add(SEG_CLASSES[Math.min(level - 1, 3)]);
  });
  validatePassword(pw).forEach(({ id, met: isMet }) => {
    document.getElementById(id)?.classList.toggle('is-met', isMet);
  });
};

document.querySelectorAll('.field-group input').forEach((input) => input.addEventListener('input', () => clear(input)));
passwordInput.addEventListener('input', () => updateStrengthMeter(passwordInput.value));
document.querySelector('#passwordToggle')?.addEventListener('click', () => { const visible = passwordInput.type === 'text'; passwordInput.type = visible ? 'password' : 'text'; document.querySelector('#passwordToggle').setAttribute('aria-label', visible ? 'Show password' : 'Hide password'); });

const getFirebaseServices = async () => {
  if (firebaseServices) return firebaseServices;
  const config = window.EVENTFLOW_FIREBASE_CONFIG || {};
  if (!config.apiKey) return null;
  const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'), import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'), import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')]);
  const app = initializeApp(config);
  firebaseServices = { auth: authSdk.getAuth(app), db: firestoreSdk.getFirestore(app), ...authSdk, ...firestoreSdk };
  await authSdk.setPersistence(firebaseServices.auth, authSdk.browserLocalPersistence);
  return firebaseServices;
};
const prepareInvite = (data, id = eventId) => {
  if (!data) return null;
  const volunteers = Array.isArray(data.volunteers) ? data.volunteers.map((item) => ({ ...item, email: normalizeEmail(item.email) })).filter((item) => item.email) : [];
  const emails = [...new Set([...(Array.isArray(data.emails) ? data.emails : []), ...volunteers.map((item) => item.email)].map(normalizeEmail).filter(Boolean))];
  return { ...data, id, volunteers, emails };
};
const localInvite = () => { try { return prepareInvite(JSON.parse(localStorage.getItem(`eventflowVolunteerInvite:${eventId}`) || 'null')); } catch { return null; } };
const loadInvite = async () => {
  if (!eventId) throw new Error('This invitation link is incomplete. Ask your admin for a new link.');
  const services = await getFirebaseServices();
  if (services) { const snapshot = await services.getDoc(services.doc(services.db, 'volunteerInvites', eventId)); if (snapshot.exists()) return prepareInvite(snapshot.data(), snapshot.id); }
  return localInvite();
};
const eligibleVolunteer = (email) => {
  const normalizedEmail = normalizeEmail(email);
  return invite?.volunteers?.find((item) => normalizeEmail(item.email) === normalizedEmail)
    || (invite?.emails || []).includes(normalizedEmail) && { email: normalizedEmail };
};
const saveProfile = (user, assignment) => { const profile = { name: assignment.name || user.displayName || user.email.split('@')[0], email: user.email, role: 'volunteer', organizationId: invite.organizationId || organizationId, eventId, eventName: invite.eventName || 'Event workspace', department: assignment.department || 'Volunteer team' }; sessionStorage.setItem('eventflowUser', JSON.stringify({ uid: user.uid, ...profile })); sessionStorage.setItem('eventflowDemoRole', 'volunteer'); sessionStorage.setItem('eventflowDemoEmail', user.email); return profile; };
const authMessage = (e) => ({ 'auth/email-already-in-use': 'An account with this email already exists. Use Team Login.', 'auth/weak-password': 'Password is too weak. Use at least 6 characters.', 'auth/popup-closed-by-user': 'Google sign-in was cancelled.', 'auth/network-request-failed': 'Network error. Check your connection and try again.' }[e?.code] || e?.message || 'Unable to create your volunteer account.');
const saveUserDocument = async (services, user, assignment) => { const profile = saveProfile(user, assignment); await services.setDoc(services.doc(services.db, 'users', user.uid), { ...profile, inviteId: eventId, createdAt: services.serverTimestamp() }, { merge: true }); return profile; };

(async () => { try { invite = await loadInvite(); if (!invite) throw new Error('This invitation is no longer active. Ask your admin to create a new link.'); if (!invite.emails?.length) throw new Error('This invitation does not include a volunteer roster yet. Ask your admin to open Invite Volunteers again.'); inviteContext.innerHTML = `<strong>${invite.eventName || 'Your EventFlow event'}</strong><br>Your invitation and volunteer roster are ready. Use the email your admin added to the list.`; } catch (e) { inviteContext.textContent = e.message; signupForm.querySelectorAll('input,button').forEach((item) => { item.disabled = true; }); setStatus(signupStatus, e.message, 'error'); } })();

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault(); [nameInput, emailInput, passwordInput, confirmInput].forEach(clear); const email = normalizeEmail(emailInput.value); let valid = true; if (!nameInput.value.trim()) { error(nameInput, 'Enter your full name.'); valid = false; } if (!validEmail(email) || !eligibleVolunteer(email)) { error(emailInput, 'This email is not on the roster for this invitation. Ask your admin to refresh and resend the invitation link.'); valid = false; } const pwFailed = validatePassword(passwordInput.value).filter((r) => !r.met); if (pwFailed.length > 0) { error(passwordInput, `Password needs: ${pwFailed.map((r) => r.label).join(' · ')}`); valid = false; } if (passwordInput.value !== confirmInput.value) { error(confirmInput, 'Passwords do not match.'); valid = false; } if (!valid) return; setStatus(signupStatus, 'Creating your volunteer account…');
  try { const services = await getFirebaseServices(); if (!services) throw new Error('Firebase is not configured yet.'); const credential = await services.createUserWithEmailAndPassword(services.auth, email, passwordInput.value); const assignment = eligibleVolunteer(email); await saveUserDocument(services, credential.user, assignment); setStatus(signupStatus, 'Your workspace is ready. Opening it now…', 'success'); window.location.href = 'role-dashboard.html'; } catch (e) { setStatus(signupStatus, authMessage(e), 'error'); }
});
googleButton.addEventListener('click', async () => { setStatus(signupStatus, 'Opening Google sign-in…'); try { const services = await getFirebaseServices(); if (!services) throw new Error('Firebase is not configured yet.'); const credential = await services.signInWithPopup(services.auth, new services.GoogleAuthProvider()); const assignment = eligibleVolunteer(credential.user.email || ''); if (!assignment) { await services.signOut(services.auth); throw new Error('This Google email is not on the invited volunteer list. Ask your admin to add it first.'); } await saveUserDocument(services, credential.user, assignment); window.location.href = 'role-dashboard.html'; } catch (e) { setStatus(signupStatus, authMessage(e), 'error'); } });

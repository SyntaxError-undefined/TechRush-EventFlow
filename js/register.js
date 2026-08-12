const registerForm = document.querySelector('#registerForm');
const adminNameInput = document.querySelector('#adminName');
const collegeNameInput = document.querySelector('#collegeName');
const organizationNameInput = document.querySelector('#organizationName');
const registerEmailInput = document.querySelector('#registerEmail');
const registerPasswordInput = document.querySelector('#registerPassword');
const confirmPasswordInput = document.querySelector('#confirmPassword');
const passwordToggle = document.querySelector('#passwordToggle');
const registerButton = document.querySelector('#registerButton');
const googleButton = document.querySelector('#registerGoogleButton');
const registerStatus = document.querySelector('#registerStatus');
let firebaseServices;

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const fields = [adminNameInput, collegeNameInput, organizationNameInput, registerEmailInput, registerPasswordInput, confirmPasswordInput];
const clearFieldError = (input) => { const group = input.closest('.field-group'); group.classList.remove('has-error'); group.querySelector('.field-error').textContent = ''; };
const showError = (input, message) => { const group = input.closest('.field-group'); group.classList.add('has-error'); group.querySelector('.field-error').textContent = message; };
fields.forEach((input) => input.addEventListener('input', () => clearFieldError(input)));
passwordToggle?.addEventListener('click', () => { const visible = registerPasswordInput.type === 'text'; registerPasswordInput.type = visible ? 'password' : 'text'; passwordToggle.setAttribute('aria-label', visible ? 'Show password' : 'Hide password'); });

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
registerPasswordInput.addEventListener('input', () => updateStrengthMeter(registerPasswordInput.value));

const getFirebaseServices = async () => {
  if (firebaseServices) return firebaseServices;
  const config = window.EVENTFLOW_FIREBASE_CONFIG || {};
  if (!config.apiKey) return null;
  const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  const app = initializeApp(config);
  firebaseServices = { auth: authSdk.getAuth(app), db: firestoreSdk.getFirestore(app), ...authSdk, ...firestoreSdk };
  await authSdk.setPersistence(firebaseServices.auth, authSdk.browserLocalPersistence);
  return firebaseServices;
};
const authErrorMessage = (error) => ({
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.'
}[error?.code] || 'Unable to create your account right now. Please try again.');
const saveProfile = (uid, email, profile) => { sessionStorage.setItem('eventflowUser', JSON.stringify({ uid, email, ...profile })); sessionStorage.setItem('eventflowDemoRole', profile.role); sessionStorage.setItem('eventflowDemoEmail', email); };
const organizationId = () => `org_${crypto.randomUUID?.() || Date.now()}`;

const createOrganizationProfile = async (services, user, details, existing = null) => {
  const id = existing?.organizationId || organizationId();
  const profile = { name: details.adminName || user.displayName || user.email.split('@')[0], email: user.email, role: 'admin', organizationId: id, collegeName: details.collegeName, organizationName: details.organizationName };
  const batch = services.writeBatch(services.db);
  batch.set(services.doc(services.db, 'users', user.uid), { ...profile, createdAt: existing ? (existing.createdAt || services.serverTimestamp()) : services.serverTimestamp() }, { merge: true });
  if (!existing) batch.set(services.doc(services.db, 'organizations', id), { collegeName: details.collegeName, organizationName: details.organizationName, ownerUid: user.uid, ownerName: profile.name, ownerEmail: user.email, createdAt: services.serverTimestamp() });
  await batch.commit();
  saveProfile(user.uid, user.email, profile);
  window.location.href = 'admin.html';
};
const readDetails = () => ({ adminName: adminNameInput.value.trim(), collegeName: collegeNameInput.value.trim(), organizationName: organizationNameInput.value.trim(), email: registerEmailInput.value.trim(), password: registerPasswordInput.value, confirmPassword: confirmPasswordInput.value });
const validate = (details) => { fields.forEach(clearFieldError); let valid = true; if (!details.adminName) { showError(adminNameInput, 'Enter your name.'); valid = false; } if (!details.collegeName) { showError(collegeNameInput, 'Enter your college or organization.'); valid = false; } if (!details.organizationName) { showError(organizationNameInput, 'Enter your club or event organization.'); valid = false; } if (!details.email || !validEmail(details.email)) { showError(registerEmailInput, 'Enter a valid email address.'); valid = false; } const pwFailed = validatePassword(details.password || '').filter((r) => !r.met); if (pwFailed.length > 0) { showError(registerPasswordInput, `Password needs: ${pwFailed.map((r) => r.label).join(' · ')}`); valid = false; } if (details.password !== details.confirmPassword) { showError(confirmPasswordInput, 'Passwords do not match.'); valid = false; } return valid; };
const setBusy = (busy, message = '') => { registerButton.disabled = busy; googleButton.disabled = busy; registerStatus.textContent = message; registerStatus.className = `auth-status${busy ? '' : ' is-error'}`; };

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const details = readDetails(); if (!validate(details)) return; setBusy(true, 'Creating your organization…');
  try { const services = await getFirebaseServices(); if (!services) throw new Error('Firebase is not configured.'); const credential = await services.createUserWithEmailAndPassword(services.auth, details.email, details.password); await createOrganizationProfile(services, credential.user, details); }
  catch (error) { setBusy(false, error.message === 'Firebase is not configured.' ? error.message : authErrorMessage(error)); }
});
googleButton?.addEventListener('click', async () => {
  const details = readDetails(); if (!details.adminName || !details.collegeName || !details.organizationName) { [adminNameInput, collegeNameInput, organizationNameInput].forEach((input) => { if (!input.value.trim()) showError(input, 'Required for Google signup.'); }); return; }
  setBusy(true, 'Connecting to Google…');
  try { const services = await getFirebaseServices(); if (!services) throw new Error('Firebase is not configured.'); const credential = await services.signInWithPopup(services.auth, new services.GoogleAuthProvider()); const snapshot = await services.getDoc(services.doc(services.db, 'users', credential.user.uid)); if (snapshot.exists() && snapshot.data().role !== 'admin') throw new Error('This account is already linked to another EventFlow role.'); await createOrganizationProfile(services, credential.user, { ...details, email: credential.user.email }, snapshot.exists() ? snapshot.data() : null); }
  catch (error) { setBusy(false, error.message || authErrorMessage(error)); }
});

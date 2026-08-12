const loginForm = document.querySelector('#loginForm');
const resetPanel = document.querySelector('#resetPanel');
const loginStatus = document.querySelector('#loginStatus');
const resetStatus = document.querySelector('#resetStatus');
const loginPassword = document.querySelector('#loginPassword');
const loginScope = document.body.dataset.loginScope || (new URLSearchParams(window.location.search).get('role') === 'participant' ? 'participant' : 'team');
const participantLogin = loginScope === 'participant';
let firebaseServices;

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const setStatus = (element, message, type = '') => { element.textContent = message; element.className = `auth-status${type ? ` is-${type}` : ''}`; };
const clearError = (input) => { const group = input.closest('.field-group'); group.classList.remove('has-error'); group.querySelector('.field-error').textContent = ''; };
const showError = (input, message) => { const group = input.closest('.field-group'); group.classList.add('has-error'); group.querySelector('.field-error').textContent = message; };

document.querySelectorAll('.field-group input').forEach((input) => input.addEventListener('input', () => clearError(input)));
document.querySelector('#passwordToggle').addEventListener('click', () => {
  const visible = loginPassword.type === 'text';
  loginPassword.type = visible ? 'password' : 'text';
  document.querySelector('#passwordToggle').classList.toggle('is-visible', !visible);
  document.querySelector('#passwordToggle').setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
});

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

const saveProfile = (user, profile) => {
  const teamRole = profile.role;
  const sessionRole = participantLogin ? 'participant' : teamRole;
  const sessionProfile = { ...profile, role: sessionRole, teamRole: teamRole === 'volunteer' ? 'volunteer' : teamRole === 'admin' ? 'admin' : undefined };
  sessionStorage.setItem('eventflowUser', JSON.stringify({ uid:user.uid, email:user.email, ...sessionProfile }));
  sessionStorage.setItem('eventflowDemoRole', sessionRole);
  sessionStorage.setItem('eventflowDemoEmail', user.email || '');
};
const routeForProfile = (profile) => ['admin', 'volunteer', 'participant'].includes(profile.role) ? (profile.role === 'admin' ? 'admin.html' : 'role-dashboard.html') : null;
const loadRoleProfile = async (services, user) => {
  const snapshot = await services.getDoc(services.doc(services.db, 'users', user.uid));
  if (!snapshot.exists()) throw new Error('Your account is not connected to an EventFlow workspace yet.');
  const profile = snapshot.data();
  if (!['admin', 'volunteer', 'participant'].includes(profile.role)) throw new Error('This account does not have a valid EventFlow role.');
  const teamEligible = ['admin', 'volunteer'].includes(profile.role);
  const participantEligible = ['participant', 'volunteer'].includes(profile.role) || profile.roles?.includes('participant');
  if (participantLogin && !participantEligible) throw new Error('This account is not set up for participant access.');
  if (!participantLogin && !teamEligible) throw new Error('This account is not set up for team access.');
  return profile;
};
const authError = (error) => ({
  'auth/invalid-credential':'Email or password is incorrect.',
  'auth/user-not-found':'Email or password is incorrect.',
  'auth/wrong-password':'Email or password is incorrect.',
  'auth/popup-closed-by-user':'Google sign-in was cancelled.',
  'auth/network-request-failed':'Network error. Check your connection and try again.'
}[error?.code] || error?.message || 'Unable to authenticate right now.');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#loginEmail');
  const password = document.querySelector('#loginPassword');
  clearError(email); clearError(password); setStatus(loginStatus, '');
  let valid = true;
  if (!validEmail(email.value.trim())) { showError(email, 'Enter a valid email address.'); valid = false; }
  if (!password.value) { showError(password, 'Enter your password.'); valid = false; }
  if (!valid) return;
  setStatus(loginStatus, participantLogin ? 'Opening participant access...' : 'Checking your team workspace...');
  try {
    const services = await getFirebaseServices();
    if (!services) throw new Error('Firebase is not configured yet. Add the runtime Firebase configuration before signing in.');
    const credentials = await services.signInWithEmailAndPassword(services.auth, email.value.trim(), password.value);
    const profile = await loadRoleProfile(services, credentials.user);
    const destination = routeForProfile(profile);
    if (!destination) throw new Error('No workspace is assigned to this account.');
    saveProfile(credentials.user, profile);
    setStatus(loginStatus, participantLogin ? 'Opening your participant space...' : `Opening your ${profile.role} workspace...`, 'success');
    window.setTimeout(() => { window.location.href = destination; }, 240);
  } catch (error) { setStatus(loginStatus, authError(error), 'error'); }
});

document.querySelector('#googleLoginButton').addEventListener('click', async () => {
  setStatus(loginStatus, 'Opening Google sign-in...');
  try {
    const services = await getFirebaseServices();
    if (!services) throw new Error('Firebase is not configured yet. Add the runtime Firebase configuration before signing in.');
    const credentials = await services.signInWithPopup(services.auth, new services.GoogleAuthProvider());
    const profile = await loadRoleProfile(services, credentials.user);
    const destination = routeForProfile(profile);
    if (!destination) throw new Error('No workspace is assigned to this account.');
    saveProfile(credentials.user, profile);
    setStatus(loginStatus, participantLogin ? 'Opening your participant space...' : `Opening your ${profile.role} workspace...`, 'success');
    window.setTimeout(() => { window.location.href = destination; }, 240);
  } catch (error) { setStatus(loginStatus, authError(error), 'error'); }
});

document.querySelector('#forgotPasswordLink').addEventListener('click', (event) => { event.preventDefault(); resetPanel.hidden = false; loginForm.hidden = true; document.querySelector('#resetEmail').value = document.querySelector('#loginEmail').value; });
document.querySelector('#backToLogin').addEventListener('click', () => { resetPanel.hidden = true; loginForm.hidden = false; setStatus(resetStatus, ''); });
resetPanel.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#resetEmail'); clearError(email); setStatus(resetStatus, '');
  if (!validEmail(email.value.trim())) { showError(email, 'Enter a valid email address.'); return; }
  try { const services = await getFirebaseServices(); if (!services) throw new Error('Firebase is not configured yet.'); await services.sendPasswordResetEmail(services.auth, email.value.trim()); setStatus(resetStatus, 'Password reset email sent. Check your inbox.', 'success'); } catch (error) { setStatus(resetStatus, authError(error), 'error'); }
});

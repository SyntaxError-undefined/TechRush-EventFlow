/* ─── EventFlow Digital Clock Time Picker ─────────────────────────────────── */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let activeInput = null;
  let pickerEl = null;
  let currentHour = 10;   // 1–12
  let currentMinute = 0;  // 0–59
  let currentPeriod = 'AM'; // 'AM' | 'PM'

  // ── Parse existing value from input ────────────────────────────────────────
  function parseTime(value) {
    if (!value) return;
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const p = match[3] ? match[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
    if (h === 0) h = 12;
    else if (h > 12) { h -= 12; }
    currentHour = h;
    currentMinute = m;
    currentPeriod = p;
  }

  // ── Format final value ──────────────────────────────────────────────────────
  function formatTime() {
    const h = String(currentHour).padStart(2, '0');
    const m = String(currentMinute).padStart(2, '0');
    return `${h}:${m} ${currentPeriod}`;
  }

  // ── Build picker DOM ────────────────────────────────────────────────────────
  function buildPicker() {
    const el = document.createElement('div');
    el.id = 'efTimePicker';
    el.className = 'ef-time-picker';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Select time');
    el.innerHTML = `
      <div class="ef-tp-header">
        <span class="ef-tp-icon">◷</span>
        <span class="ef-tp-title">Select Time</span>
        <button class="ef-tp-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="ef-tp-display">
        <span class="ef-tp-display-h" id="efTpH">10</span>
        <span class="ef-tp-colon">:</span>
        <span class="ef-tp-display-m" id="efTpM">00</span>
        <button class="ef-tp-period" id="efTpPeriod" type="button">AM</button>
      </div>
      <div class="ef-tp-columns">
        <div class="ef-tp-col">
          <button class="ef-tp-arrow ef-tp-arrow--up" type="button" data-target="hour" data-dir="up" aria-label="Hour up">▲</button>
          <div class="ef-tp-scroll-wrap" id="efHourWrap">
            <div class="ef-tp-scroll" id="efHourScroll"></div>
          </div>
          <button class="ef-tp-arrow ef-tp-arrow--down" type="button" data-target="hour" data-dir="down" aria-label="Hour down">▼</button>
          <div class="ef-tp-col-label">Hour</div>
        </div>
        <div class="ef-tp-separator">:</div>
        <div class="ef-tp-col">
          <button class="ef-tp-arrow ef-tp-arrow--up" type="button" data-target="minute" data-dir="up" aria-label="Minute up">▲</button>
          <div class="ef-tp-scroll-wrap" id="efMinuteWrap">
            <div class="ef-tp-scroll" id="efMinuteScroll"></div>
          </div>
          <button class="ef-tp-arrow ef-tp-arrow--down" type="button" data-target="minute" data-dir="down" aria-label="Minute down">▼</button>
          <div class="ef-tp-col-label">Minute</div>
        </div>
      </div>
      <div class="ef-tp-footer">
        <button class="ef-tp-btn ef-tp-btn--cancel" type="button" id="efTpCancel">Cancel</button>
        <button class="ef-tp-btn ef-tp-btn--confirm" type="button" id="efTpConfirm">Confirm Time</button>
      </div>
    `;
    return el;
  }

  // ── Populate scrollers ──────────────────────────────────────────────────────
  function populateScrollers() {
    const hourScroll = pickerEl.querySelector('#efHourScroll');
    const minuteScroll = pickerEl.querySelector('#efMinuteScroll');

    hourScroll.innerHTML = '';
    for (let h = 1; h <= 12; h++) {
      const item = document.createElement('div');
      item.className = 'ef-tp-item' + (h === currentHour ? ' is-selected' : '');
      item.dataset.value = h;
      item.dataset.target = 'hour';
      item.textContent = String(h).padStart(2, '0');
      hourScroll.appendChild(item);
    }

    minuteScroll.innerHTML = '';
    for (let m = 0; m < 60; m += 5) {
      const item = document.createElement('div');
      item.className = 'ef-tp-item' + (m === currentMinute ? ' is-selected' : '');
      item.dataset.value = m;
      item.dataset.target = 'minute';
      item.textContent = String(m).padStart(2, '0');
      minuteScroll.appendChild(item);
    }

    scrollToSelected('efHourWrap', 'efHourScroll');
    scrollToSelected('efMinuteWrap', 'efMinuteScroll');
  }

  function scrollToSelected(wrapId, scrollId) {
    const wrap = pickerEl.querySelector('#' + wrapId);
    const scroll = pickerEl.querySelector('#' + scrollId);
    const selected = scroll.querySelector('.is-selected');
    if (!selected || !wrap) return;
    const itemH = selected.offsetHeight || 44;
    const selectedIdx = Array.from(scroll.children).indexOf(selected);
    wrap.scrollTop = selectedIdx * itemH - itemH;
  }

  // ── Update display ──────────────────────────────────────────────────────────
  function updateDisplay() {
    pickerEl.querySelector('#efTpH').textContent = String(currentHour).padStart(2, '0');
    pickerEl.querySelector('#efTpM').textContent = String(currentMinute).padStart(2, '0');
    pickerEl.querySelector('#efTpPeriod').textContent = currentPeriod;
    // Update selected classes
    pickerEl.querySelectorAll('.ef-tp-item[data-target="hour"]').forEach((item) => {
      item.classList.toggle('is-selected', parseInt(item.dataset.value, 10) === currentHour);
    });
    pickerEl.querySelectorAll('.ef-tp-item[data-target="minute"]').forEach((item) => {
      item.classList.toggle('is-selected', parseInt(item.dataset.value, 10) === currentMinute);
    });
  }

  // ── Position picker near input ──────────────────────────────────────────────
  function positionPicker(input) {
    const rect = input.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const top = rect.bottom + scrollY + 6;
    let left = rect.left + scrollX;
    const pickerW = 320;
    if (left + pickerW > window.innerWidth - 12) {
      left = Math.max(8, window.innerWidth - pickerW - 12);
    }
    pickerEl.style.top = top + 'px';
    pickerEl.style.left = left + 'px';
  }

  // ── Open picker ────────────────────────────────────────────────────────────
  function openPicker(input) {
    if (pickerEl && document.body.contains(pickerEl)) closePicker();
    activeInput = input;
    parseTime(input.value);
    pickerEl = buildPicker();
    document.body.appendChild(pickerEl);
    positionPicker(input);
    populateScrollers();
    updateDisplay();
    requestAnimationFrame(() => pickerEl.classList.add('is-open'));
    attachPickerEvents();
  }

  // ── Close picker ───────────────────────────────────────────────────────────
  function closePicker() {
    if (!pickerEl) return;
    pickerEl.classList.remove('is-open');
    pickerEl.addEventListener('transitionend', () => pickerEl?.remove(), { once: true });
    pickerEl = null;
    activeInput = null;
  }

  // ── Confirm ─────────────────────────────────────────────────────────────────
  function confirmTime() {
    if (!activeInput) return;
    activeInput.value = formatTime();
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    closePicker();
  }

  // ── Picker events ───────────────────────────────────────────────────────────
  function attachPickerEvents() {
    if (!pickerEl) return;

    // Close button
    pickerEl.querySelector('.ef-tp-close').addEventListener('click', closePicker);
    pickerEl.querySelector('#efTpCancel').addEventListener('click', closePicker);
    pickerEl.querySelector('#efTpConfirm').addEventListener('click', confirmTime);

    // AM/PM toggle
    pickerEl.querySelector('#efTpPeriod').addEventListener('click', () => {
      currentPeriod = currentPeriod === 'AM' ? 'PM' : 'AM';
      updateDisplay();
    });

    // Arrow buttons
    pickerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-target][data-dir]');
      if (!btn) return;
      const target = btn.dataset.target;
      const dir = btn.dataset.dir === 'up' ? 1 : -1;
      if (target === 'hour') {
        currentHour = ((currentHour - 1 + dir + 12) % 12) + 1;
        updateDisplay();
        scrollToSelected('efHourWrap', 'efHourScroll');
      } else {
        // Minutes in steps of 5
        const minuteItems = Array.from(pickerEl.querySelectorAll('.ef-tp-item[data-target="minute"]'))
          .map((el) => parseInt(el.dataset.value, 10));
        const idx = minuteItems.indexOf(currentMinute);
        const newIdx = (idx + dir + minuteItems.length) % minuteItems.length;
        currentMinute = minuteItems[newIdx];
        updateDisplay();
        scrollToSelected('efMinuteWrap', 'efMinuteScroll');
      }
    });

    // Click on scroller item
    pickerEl.addEventListener('click', (e) => {
      const item = e.target.closest('.ef-tp-item');
      if (!item) return;
      const val = parseInt(item.dataset.value, 10);
      if (item.dataset.target === 'hour') {
        currentHour = val;
      } else {
        currentMinute = val;
      }
      updateDisplay();
    });

    // Prevent picker from closing when clicking inside
    pickerEl.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  // ── Global delegation: open on time input click/focus ──────────────────────
  const TIME_INPUT_IDS = new Set(['startTime', 'endTime', 'slotTime']);

  function isTimeInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    if (TIME_INPUT_IDS.has(el.id)) return true;
    if (el.dataset.timepicker) return true;
    return false;
  }

  document.addEventListener('mousedown', (e) => {
    if (pickerEl && !pickerEl.contains(e.target) && !isTimeInput(e.target)) {
      closePicker();
    }
  }, true);

  document.addEventListener('focusin', (e) => {
    if (isTimeInput(e.target)) {
      openPicker(e.target);
    }
  }, true);

  // Also handle dynamically injected inputs (modal re-renders)
  const _observer = new MutationObserver(() => {
    if (pickerEl && activeInput && !document.body.contains(activeInput)) {
      closePicker();
    }
  });
  _observer.observe(document.body, { childList: true, subtree: true });

  // Keyboard: Escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pickerEl) closePicker();
  });

})();

// App State
let appState = {
    sessions: JSON.parse(localStorage.getItem('trackdown_sessions')) || [],
    dailyGoalHrs: parseFloat(localStorage.getItem('trackdown_daily_goal')) || 2,
    streak: parseInt(localStorage.getItem('trackdown_streak')) || 0,
    lastSessionDate: localStorage.getItem('trackdown_last_date') || null
};

// Timer State
let timer = {
    interval: null,
    timeLeft: 25 * 60,
    isWorking: true,
    isRunning: false,
    currentSubject: ''
};

// DOM Elements
const els = {
    timerDisplay: document.getElementById('timer-display'),
    currentLabel: document.getElementById('current-label'),
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnStop: document.getElementById('btn-stop'),
    inputSubject: document.getElementById('session-subject'),
    inputWork: document.getElementById('work-duration'),
    inputBreak: document.getElementById('break-duration'),
    canvas: document.getElementById('thermostat-canvas'),
    ctx: document.getElementById('thermostat-canvas').getContext('2d'),
    valCurrentHrs: document.getElementById('current-hours'),
    valGoalHrs: document.getElementById('goal-hours'),
    inputGoal: document.getElementById('daily-goal-input'),
    historyList: document.getElementById('history-list'),
    streakCount: document.getElementById('streak-count'),
    toggles: document.querySelectorAll('.toggle-btn'),
    manualSubject: document.getElementById('manual-subject'),
    manualDur: document.getElementById('manual-duration'),
    btnAddManual: document.getElementById('btn-add-manual'),
    audio: document.getElementById('notification-sound')
};

// Current Progress View (today, week, month)
let currentView = 'today';

// --- INITIALIZATION ---
function init() {
    updateStreak();
    els.streakCount.innerText = appState.streak;
    
    // Set up timer values based on inputs
    resetTimer();

    // Event Listeners
    els.btnStart.addEventListener('click', startTimer);
    els.btnPause.addEventListener('click', pauseTimer);
    els.btnStop.addEventListener('click', stopTimer);
    
    els.inputGoal.addEventListener('change', (e) => {
        appState.dailyGoalHrs = parseFloat(e.target.value) || 2;
        saveState();
        renderThermostat();
    });

    els.btnAddManual.addEventListener('click', addManualSession);

    els.inputWork.addEventListener('change', () => !timer.isRunning && resetTimer());
    els.inputBreak.addEventListener('change', () => !timer.isRunning && resetTimer());

    els.toggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
            els.toggles.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.getAttribute('data-view');
            renderThermostat();
        });
    });

    renderHistory();
    renderThermostat();
}

// --- TIMER LOGIC ---
function resetTimer() {
    pauseTimer();
    const min = timer.isWorking ? parseInt(els.inputWork.value) || 25 : parseInt(els.inputBreak.value) || 5;
    timer.timeLeft = min * 60;
    updateTimerDisplay();
    els.currentLabel.innerText = timer.isWorking ? 'Focus Session' : 'Break Time';
    els.currentLabel.style.color = timer.isWorking ? 'var(--secondary)' : 'var(--accent)';
}

function startTimer() {
    if (timer.isRunning) return;
    
    // Grab subject on start
    if (timer.isWorking) {
        timer.currentSubject = els.inputSubject.value.trim() || 'Deep Work';
    }

    timer.isRunning = true;
    els.btnStart.textContent = 'Running...';
    
    timer.interval = setInterval(() => {
        timer.timeLeft--;
        updateTimerDisplay();

        if (timer.timeLeft <= 0) {
            handleSessionComplete();
        }
    }, 1000);
}

function pauseTimer() {
    timer.isRunning = false;
    clearInterval(timer.interval);
    els.btnStart.textContent = 'Resume';
}

function stopTimer() {
    resetTimer();
    els.btnStart.textContent = 'Start';
}

function updateTimerDisplay() {
    const m = Math.floor(timer.timeLeft / 60).toString().padStart(2, '0');
    const s = (timer.timeLeft % 60).toString().padStart(2, '0');
    els.timerDisplay.innerText = `${m}:${s}`;
}

function handleSessionComplete() {
    pauseTimer();
    
    // Play notification sound
    if (els.audio) {
        els.audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    if (timer.isWorking) {
        // Save focus session
        saveSession(timer.currentSubject, parseInt(els.inputWork.value) || 25);
        celebrate();
        
        // Auto-switch to break
        timer.isWorking = false;
        resetTimer();
        startTimer(); // Auto start break
    } else {
        // Break is over, back to work
        timer.isWorking = true;
        resetTimer();
        els.btnStart.textContent = 'Start';
    }
}

// --- DATA LOGIC ---
function saveSession(subject, durationMins) {
    const session = {
        id: Date.now(),
        subject,
        duration: durationMins,
        date: new Date().toISOString()
    };
    appState.sessions.unshift(session);
    saveState();
    
    renderHistory();
    renderThermostat();
    updateStreak();
}

function saveState() {
    localStorage.setItem('trackdown_sessions', JSON.stringify(appState.sessions));
    localStorage.setItem('trackdown_daily_goal', appState.dailyGoalHrs);
    localStorage.setItem('trackdown_streak', appState.streak);
    if (appState.lastSessionDate) {
        localStorage.setItem('trackdown_last_date', appState.lastSessionDate);
    }
}

function addManualSession() {
    const sub = els.manualSubject.value.trim();
    const dur = parseInt(els.manualDur.value);
    
    if (sub && dur && dur > 0) {
        saveSession(sub, dur);
        els.manualSubject.value = '';
        els.manualDur.value = '';
        celebrate();
    }
}

function updateStreak() {
    const today = new Date().toDateString();
    
    if (!appState.lastSessionDate) {
        appState.lastSessionDate = today;
        appState.streak = 1;
        saveState();
    } else if (appState.lastSessionDate !== today) {
        const lastDate = new Date(appState.lastSessionDate);
        const currDate = new Date(today);
        const diffTime = Math.abs(currDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays === 1) {
            appState.streak++;
        } else if (diffDays > 1) {
            appState.streak = 1; // reset streak
        }
        appState.lastSessionDate = today;
        saveState();
    }
    els.streakCount.innerText = appState.streak;
}

// --- HISTORY RENDER ---
function renderHistory() {
    els.historyList.innerHTML = '';
    const recent = appState.sessions.slice(0, 15); // Show last 15
    
    if (recent.length === 0) {
        els.historyList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 2rem 0;">No sessions yet.</p>';
        return;
    }

    recent.forEach(s => {
        const d = new Date(s.date);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-info">
                <strong>${s.subject}</strong>
                <span>${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="history-duration">${s.duration}m</div>
        `;
        els.historyList.appendChild(div);
    });
}

// --- THERMOSTAT DRAWING ---
function renderThermostat() {
    const { ctx, canvas } = els;
    const cw = canvas.width;
    const ch = canvas.height;
    const cx = cw / 2;
    const cy = ch / 2;
    const radius = 80;
    
    // Calculate total hours based on view
    let totalMins = 0;
    const now = new Date();
    
    appState.sessions.forEach(s => {
        const sessionDate = new Date(s.date);
        let include = false;
        
        if (currentView === 'today') {
            include = sessionDate.toDateString() === now.toDateString();
        } else if (currentView === 'week') {
            const diffTime = Math.abs(now - sessionDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            include = diffDays <= 7;
        } else if (currentView === 'month') {
            include = sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear();
        }
        
        if (include) totalMins += s.duration;
    });

    const hours = +(totalMins / 60).toFixed(1);
    const goal = currentView === 'today' ? appState.dailyGoalHrs : 
                 currentView === 'week' ? appState.dailyGoalHrs * 5 : 
                 appState.dailyGoalHrs * 20; // Approx 20 work days month
                 
    els.valCurrentHrs.innerText = `${hours}h`;
    els.valGoalHrs.innerText = `${goal}h`;
    
    // Clear
    ctx.clearRect(0, 0, cw, ch);
    
    // Draw Track (background circle)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI * 0.75, Math.PI * 2.25);
    ctx.strokeStyle = 'rgba(172, 148, 176, 0.2)'; // secondary with opacity
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw Fill (progress)
    const progress = Math.min(hours / goal, 1);
    if(progress > 0) {
        ctx.beginPath();
        const endAngle = Math.PI * 0.75 + (Math.PI * 1.5 * progress);
        ctx.arc(cx, cy, radius, Math.PI * 0.75, endAngle);
        
        // Gradient for fill
        const grad = ctx.createLinearGradient(0, cy - radius, cw, cy + radius);
        grad.addColorStop(0, '#785C7C'); // primary
        grad.addColorStop(1, '#71385C'); // accent
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

// --- CELEBRATION EFFECT (Custom Particles) ---
function celebrate() {
    const numParticles = 30;
    const colors = ['#785C7C', '#AC94B0', '#71385C', '#ffffff'];
    
    for (let i = 0; i < numParticles; i++) {
        createParticle(colors[Math.floor(Math.random() * colors.length)]);
    }
}

function createParticle(color) {
    const particle = document.createElement('div');
    document.body.appendChild(particle);
    
    const size = Math.random() * 10 + 5;
    
    // Start at bottom center
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight;
    
    particle.style.cssText = `
        position: fixed;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        left: ${startX}px;
        top: ${startY}px;
        pointer-events: none;
        z-index: 9999;
        box-shadow: 0 0 10px ${color};
        opacity: 1;
    `;

    const destX = startX + (Math.random() - 0.5) * 600;
    const destY = startY - Math.random() * window.innerHeight;
    const duration = Math.random() * 1000 + 1000;

    const anim = particle.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${destX - startX}px, ${destY - startY}px) scale(0)`, opacity: 0 }
    ], {
        duration,
        easing: 'cubic-bezier(0, .9, .57, 1)'
    });

    anim.onfinish = () => {
        particle.remove();
    };
}

// Kickoff
init();

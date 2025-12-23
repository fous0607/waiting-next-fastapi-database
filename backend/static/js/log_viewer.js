// Log Data Store
const MAX_LOGS = 500;
let eventSource = null;

async function loadLogs() {
    // Initial load using REST API to fill history
    const container = document.getElementById('log-container');
    const level = document.getElementById('levelFilter').value;
    const keyword = document.getElementById('keywordFilter').value;

    if (container.children.length === 0) {
        container.innerHTML = '<div class="loading">Loading logs...</div>';
    }

    try {
        let url = `/logs/api?limit=${100}`;
        if (level) url += `&level=${level}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

        const response = await fetch(url);
        const data = await response.json();

        renderLogs(data.logs);
    } catch (error) {
        container.innerHTML = `<div class="loading" style="color:var(--error-color)">Error loading logs: ${error.message}</div>`;
    }
}

function renderLogs(logs) {
    const container = document.getElementById('log-container');
    container.innerHTML = logs.map(createLogHtml).join('');
}

function createLogHtml(log) {
    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleTimeString('ko-KR', { hour12: false }) + '.' + date.getMilliseconds().toString().padStart(3, '0');

    return `
                <div class="log-entry">
                    <div class="log-time" title="${log.timestamp}">${timeStr}</div>
                    <div class="log-level ${log.level}">${log.level}</div>
                    <div class="log-module">${log.module}:${log.line}</div>
                    <div class="log-message">${escapeHtml(log.message)}</div>
                </div>
            `;
}

function prependLog(log) {
    const container = document.getElementById('log-container');

    // Filter client-side if filters are active
    const levelFilter = document.getElementById('levelFilter').value;
    const keywordFilter = document.getElementById('keywordFilter').value;

    if (levelFilter && log.level !== levelFilter) return;
    if (keywordFilter && !JSON.stringify(log).toLowerCase().includes(keywordFilter.toLowerCase())) return;

    const html = createLogHtml(log);
    container.insertAdjacentHTML('afterbegin', html);

    // Add animation class to the new first element
    if (container.firstChild) {
        container.firstChild.classList.add('new');
    }

    // Limit size
    if (container.children.length > MAX_LOGS) {
        container.lastChild.remove();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// SSE Connection Logic
function connectSSE() {
    if (eventSource) {
        eventSource.close();
    }

    const badge = document.getElementById('liveBadge');

    console.log("Connecting to System Log SSE...");
    eventSource = new EventSource("/api/sse/stream?channel=system");

    eventSource.onopen = () => {
        console.log("SSE Connected");
        badge.style.display = 'inline-block';
        badge.style.opacity = '1';
        badge.textContent = "LIVE";
        badge.style.backgroundColor = "#ea5e5e"; // Red
    };

    eventSource.onerror = (err) => {
        console.error("SSE Error:", err);
        badge.textContent = "OFFLINE";
        badge.style.backgroundColor = "#888";
        eventSource.close();
        // Reconnect strategy could be added here
        setTimeout(connectSSE, 5000);
    };

    eventSource.addEventListener("log", (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload.event === 'log') {
                prependLog(payload.data);
            }
        } catch (e) {
            console.error("Parse error", e);
        }
    });

    // Backup handler if `event_generator` format changes to standard SSE events
    eventSource.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload.event === 'log') {
                prependLog(payload.data);
            }
        } catch (e) {
            console.error("Parse error", e);
        }
    };
}

function toggleAutoRefresh(enabled) {
    const badge = document.getElementById('liveBadge');
    if (enabled) {
        connectSSE();
    } else {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        badge.style.display = 'none';
    }
}

document.getElementById('autoRefresh').addEventListener('change', (e) => {
    toggleAutoRefresh(e.target.checked);
});

// Trigger search on enter
document.getElementById('keywordFilter').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadLogs();
});

// Initial Load
loadLogs();

// Auto Connect if checked
const autoCheck = document.getElementById('autoRefresh');
toggleAutoRefresh(autoCheck.checked);



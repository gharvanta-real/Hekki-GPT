/**
 * telephony_page.js — Hekki Voice AI & Telephony Metrics Page Component.
 * Flat, borderless, zero-shadow design (<180 lines).
 */

export function renderTelephonyPage(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="telephony-page">
      <header class="telephony-header">
        <h1 class="telephony-title">Telephony AI Voice Engine</h1>
        <p class="telephony-subtitle">Live SIP trunks, audio stream metrics, and call logs</p>
      </header>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total AI Calls Today</div>
          <div class="kpi-value">1,482 <span class="unit">calls</span></div>
          <div class="kpi-trend positive">
            <i data-lucide="trending-up"></i> +14.2% from yesterday
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Audio Stream Latency</div>
          <div class="kpi-value">182 <span class="unit">ms</span></div>
          <div class="kpi-trend positive">
            <i data-lucide="zap"></i> Real-time WebSocket
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Voice Synthesis Accuracy</div>
          <div class="kpi-value">99.4 <span class="unit">%</span></div>
          <div class="kpi-trend positive">
            <i data-lucide="check-circle"></i> High Quality
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Active Calls Right Now</div>
          <div class="kpi-value">6 <span class="unit">live</span></div>
          <div class="kpi-trend neutral">
            <i data-lucide="phone-call"></i> 2 Queued
          </div>
        </div>
      </div>

      <div class="section-header">Live Telephony Session Logs</div>

      <div class="table-wrapper">
        <table class="calls-table">
          <thead>
            <tr>
              <th>Call ID</th>
              <th>Direction</th>
              <th>Caller Number</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Audio Preview</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="call-id">#sip-call-89012</td>
              <td><span class="call-direction inbound"><i data-lucide="phone-incoming"></i> Inbound</span></td>
              <td>+1 (555) 019-2834</td>
              <td><span class="call-status active">Active</span></td>
              <td class="call-duration">02:45</td>
              <td>
                <div class="call-actions">
                  <button class="action-btn playing" title="Pause Stream"><i data-lucide="pause"></i></button>
                  <button class="action-btn" title="Download Audio"><i data-lucide="download"></i></button>
                </div>
              </td>
            </tr>
            <tr>
              <td class="call-id">#sip-call-89011</td>
              <td><span class="call-direction outbound"><i data-lucide="phone-outgoing"></i> Outbound</span></td>
              <td>+1 (555) 438-9102</td>
              <td><span class="call-status ended">Ended</span></td>
              <td class="call-duration">04:12</td>
              <td>
                <div class="call-actions">
                  <button class="action-btn" title="Play Recording"><i data-lucide="play"></i></button>
                  <button class="action-btn" title="Download Audio"><i data-lucide="download"></i></button>
                </div>
              </td>
            </tr>
            <tr>
              <td class="call-id">#sip-call-89010</td>
              <td><span class="call-direction inbound"><i data-lucide="phone-incoming"></i> Inbound</span></td>
              <td>+1 (555) 882-1049</td>
              <td><span class="call-status ended">Ended</span></td>
              <td class="call-duration">01:18</td>
              <td>
                <div class="call-actions">
                  <button class="action-btn" title="Play Recording"><i data-lucide="play"></i></button>
                  <button class="action-btn" title="Download Audio"><i data-lucide="download"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="audio-preview">
        <div class="audio-preview-header">
          <div class="audio-preview-title">Live Call Stream Spectrum</div>
          <span class="call-status active">Streaming 24kHz Mono</span>
        </div>
        <div class="audio-player">
          <button class="audio-play-btn playing" title="Toggle Audio Stream">
            <i data-lucide="square"></i>
          </button>
          <div class="audio-waveform">
            <div class="audio-waveform-bar active" style="height:14px;"></div>
            <div class="audio-waveform-bar active" style="height:28px;"></div>
            <div class="audio-waveform-bar active" style="height:18px;"></div>
            <div class="audio-waveform-bar active" style="height:36px;"></div>
            <div class="audio-waveform-bar active" style="height:22px;"></div>
            <div class="audio-waveform-bar active" style="height:30px;"></div>
            <div class="audio-waveform-bar" style="height:12px;"></div>
            <div class="audio-waveform-bar" style="height:20px;"></div>
          </div>
          <div class="audio-time">02:45 / 05:00</div>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

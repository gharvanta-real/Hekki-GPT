/* === chat/map_canvas_card.js — Ultra-Clean Full-Bleed Map Canvas Card with Location Status Info ===
 * Strict Design:
 * - 100% Full-bleed Map Canvas with 18px Rounded Container
 * - Sleek Location Info Bar underneath (Open/Closed Status, Hours, Address, Rating)
 * - Strict Theme Mapping: ONLY Light theme uses Light tiles; Dark, OLED, Catppuccin use Dark Matter tiles
 * - Zero Clutter: Floating Minimal Title Tag + Floating "Directions" Action Pill
 * - Animated Radar Pulse Pin Marker & Click-to-Pin Interactivity
 */

export function escapeHtmlLocal(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TILE_CONFIG = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }
};

const KNOWN_LANDMARKS = {
  'connaught place': { lat: 28.6315, lng: 77.2167, title: 'Connaught Place, New Delhi', category: 'Commercial Hub', status: 'Open Now', hours: 'Closes 10:00 PM', address: 'Connaught Place, New Delhi 110001', rating: '4.6' },
  'cp delhi': { lat: 28.6315, lng: 77.2167, title: 'Connaught Place, New Delhi', category: 'Commercial Hub', status: 'Open Now', hours: 'Closes 10:00 PM', address: 'Connaught Place, New Delhi 110001', rating: '4.6' },
  'india gate': { lat: 28.6129, lng: 77.2295, title: 'India Gate, New Delhi', category: 'Monument', status: 'Open 24 Hours', hours: 'Open all day', address: 'Kartavya Path, India Gate, New Delhi', rating: '4.7' },
  'red fort': { lat: 28.6562, lng: 77.2410, title: 'Red Fort, Delhi', category: 'Historical', status: 'Open Now', hours: '9:30 AM – 4:30 PM (Closed Mon)', address: 'Chandni Chowk, Delhi 110006', rating: '4.5' },
  'qutub minar': { lat: 28.5245, lng: 77.1855, title: 'Qutub Minar, Delhi', category: 'Heritage', status: 'Open Now', hours: '7:00 AM – 5:00 PM', address: 'Mehrauli, New Delhi 110030', rating: '4.5' },
  'rashtrapati bhavan': { lat: 28.6143, lng: 77.1994, title: 'Rashtrapati Bhavan, New Delhi', category: 'Official', status: 'Visiting Hours', hours: '9:00 AM – 4:00 PM', address: 'Presidential Estate, New Delhi', rating: '4.7' },
  'taj mahal': { lat: 27.1751, lng: 78.0421, title: 'Taj Mahal, Agra', category: 'Heritage', status: 'Open Now', hours: '6:00 AM – 6:30 PM (Closed Fri)', address: 'Tajganj, Agra, Uttar Pradesh', rating: '4.8' },
  'marine drive': { lat: 18.9432, lng: 72.8230, title: 'Marine Drive, Mumbai', category: 'Landmark', status: 'Open 24 Hours', hours: 'Open all day', address: 'Netaji Subhash Road, Mumbai', rating: '4.7' },
  'gateway of india': { lat: 18.9220, lng: 72.8347, title: 'Gateway of India, Mumbai', category: 'Monument', status: 'Open 24 Hours', hours: 'Open all day', address: 'Apollo Bandar, Colaba, Mumbai', rating: '4.6' },
  'golden temple': { lat: 31.6200, lng: 74.8765, title: 'Golden Temple, Amritsar', category: 'Spiritual', status: 'Open 24 Hours', hours: 'Open all day', address: 'Golden Temple Road, Amritsar', rating: '4.9' },
  'eiffel tower': { lat: 48.8584, lng: 2.2945, title: 'Eiffel Tower, Paris', category: 'Landmark', status: 'Open Now', hours: '9:30 AM – 11:45 PM', address: 'Champ de Mars, Paris, France', rating: '4.7' },
  'statue of liberty': { lat: 40.6892, lng: -74.0445, title: 'Statue of Liberty, New York', category: 'Monument', status: 'Open Now', hours: '9:00 AM – 5:00 PM', address: 'New York, NY 10004, USA', rating: '4.7' },
  'burj khalifa': { lat: 25.1972, lng: 55.2744, title: 'Burj Khalifa, Dubai', category: 'Skyscraper', status: 'Open Now', hours: '8:30 AM – 11:00 PM', address: 'Downtown Dubai, UAE', rating: '4.8' }
};

/**
 * Returns the appropriate map tile configuration based on active theme
 * ONLY 'light' uses light tiles. Dark, OLED, Catppuccin use Dark Matter tiles.
 */
export function getMapTileConfig() {
  const dt = (document.documentElement.getAttribute('data-theme') || '').toLowerCase();
  const bodyCls = (document.body.className || '').toLowerCase();
  const storedTheme = (localStorage.getItem('hekki_theme') || '').toLowerCase();

  const isLight = dt === 'light' || bodyCls.includes('light') || (storedTheme === 'light' && !dt && !bodyCls.includes('dark') && !bodyCls.includes('oled') && !bodyCls.includes('catppuccin'));

  return isLight ? TILE_CONFIG.light : TILE_CONFIG.dark;
}

let mapCardIdCounter = 0;

/**
 * Creates an ultra-clean full-bleed Map Canvas Card with bottom Location Info strip
 */
export function createMapCanvasCard({
  title = 'Location',
  lat = 28.6139,
  lng = 77.2090,
  zoom = 15,
  category = 'Location',
  status = 'Open Now',
  hours = '',
  address = '',
  description = '',
  rating = '',
  markers = []
}) {
  mapCardIdCounter++;
  const mapId = `map-canvas-inst-${Date.now()}-${mapCardIdCounter}`;
  const latNum = parseFloat(lat) || 28.6139;
  const lngNum = parseFloat(lng) || 77.2090;
  const cleanTitle = (title || 'Location').trim();
  const cleanStatus = (status || 'Open Now').trim();
  const cleanHours = (hours || (cleanStatus.toLowerCase().includes('closed') ? 'Closed for the day' : 'Open today')).trim();
  const cleanAddress = (address || description || '').trim();
  const cleanRating = (rating || '').trim();
  const isClosed = cleanStatus.toLowerCase().includes('close') || cleanStatus.toLowerCase().includes('band');
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}`;

  const card = document.createElement('div');
  card.className = 'map-canvas-card map-clean-card';
  card.innerHTML = `
    <!-- Top Map Viewport with Floating Overlays -->
    <div class="map-viewport-wrapper">
      <div class="map-canvas-viewport" id="${mapId}"></div>
      
      <!-- Floating Minimal Top Tag -->
      <div class="map-floating-tag">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
          <line x1="9" y1="3" x2="9" y2="18"></line>
          <line x1="15" y1="6" x2="15" y2="21"></line>
        </svg>
        <span class="map-floating-title">${escapeHtmlLocal(cleanTitle)}</span>
      </div>

      <!-- Floating Minimal Directions Action Button -->
      <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="map-floating-directions-btn" title="Open Directions in Google Maps">
        <span>Directions</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"></line>
          <polyline points="7 7 17 7 17 17"></polyline>
        </svg>
      </a>
    </div>

    <!-- Location Info Strip Underneath Card -->
    <div class="map-location-info-strip">
      <div class="map-info-left">
        <div class="map-status-pill ${isClosed ? 'status-closed' : 'status-open'}">
          <span class="status-dot"></span>
          <span class="status-label">${escapeHtmlLocal(cleanStatus)}</span>
        </div>
        <div class="map-info-meta">
          <span class="map-info-hours">${escapeHtmlLocal(cleanHours)}</span>
          ${cleanAddress ? `<span class="map-info-divider">•</span><span class="map-info-addr">${escapeHtmlLocal(cleanAddress)}</span>` : ''}
        </div>
      </div>
      ${cleanRating ? `
        <div class="map-info-rating">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" stroke-width="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>${escapeHtmlLocal(cleanRating)}</span>
        </div>
      ` : ''}
    </div>
  `;

  // Initialize Leaflet Map Instance asynchronously
  const initLeaflet = () => {
    if (!window.L) {
      setTimeout(initLeaflet, 100);
      return;
    }

    const mapEl = document.getElementById(mapId);
    if (!mapEl) return;

    const activeTiles = getMapTileConfig();

    const map = window.L.map(mapId, {
      center: [latNum, lngNum],
      zoom: parseInt(zoom, 10) || 15,
      zoomControl: false,
      attributionControl: false
    });

    let tileLayer = window.L.tileLayer(activeTiles.url, {
      maxZoom: activeTiles.maxZoom,
      subdomains: activeTiles.subdomains
    }).addTo(map);

    // Custom Animated Pulse Radar Marker Pin
    const radarIcon = window.L.divIcon({
      className: 'custom-map-radar-pin',
      html: `
        <div class="map-pin-beacon">
          <div class="map-pin-pulse"></div>
          <div class="map-pin-core"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const mainMarker = window.L.marker([latNum, lngNum], { icon: radarIcon }).addTo(map);
    mainMarker.bindPopup(`
      <div class="map-popup-card">
        <strong>${escapeHtmlLocal(cleanTitle)}</strong>
        <p style="margin:2px 0 0 0;font-size:11px;opacity:0.85;">${escapeHtmlLocal(cleanAddress || `${latNum}, ${lngNum}`)}</p>
      </div>
    `);

    // Click-to-Pin interactivity
    const floatingTitle = card.querySelector('.map-floating-title');
    map.on('click', (e) => {
      const clickedLat = e.latlng.lat.toFixed(5);
      const clickedLng = e.latlng.lng.toFixed(5);
      mainMarker.setLatLng(e.latlng);
      mainMarker.setPopupContent(`
        <div class="map-popup-card">
          <strong>Pinned Location</strong>
          <p style="margin:2px 0 0 0;font-size:11px;opacity:0.85;">${clickedLat}, ${clickedLng}</p>
        </div>
      `).openPopup();
      if (floatingTitle) {
        floatingTitle.textContent = `${cleanTitle} (${clickedLat}, ${clickedLng})`;
      }
      const dirBtn = card.querySelector('.map-floating-directions-btn');
      if (dirBtn) {
        dirBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${clickedLat},${clickedLng}`;
      }
    });

    setTimeout(() => { map.invalidateSize(); }, 200);
    setTimeout(() => { map.invalidateSize(); }, 700);

    // Live Theme Switching Observer (Watches html and body class / data-theme changes)
    const updateTileTheme = () => {
      const nextTiles = getMapTileConfig();
      if (tileLayer && tileLayer._url !== nextTiles.url) {
        map.removeLayer(tileLayer);
        tileLayer = window.L.tileLayer(nextTiles.url, {
          maxZoom: nextTiles.maxZoom,
          subdomains: nextTiles.subdomains
        }).addTo(map);
      }
    };

    const themeObserver = new MutationObserver(updateTileTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    window.addEventListener('storage', updateTileTheme);
  };

  setTimeout(initLeaflet, 50);

  return card;
}

/**
 * Scans markdown container and transforms map blocks/tags into interactive Map Canvas Cards
 */
export function enhanceMapCanvasCards(container) {
  if (!container) return;

  // 1. Enhance ```map / ```location / ```geo code blocks
  const codeBlocks = container.querySelectorAll('pre code, .code-block-wrapper pre code');
  codeBlocks.forEach(code => {
    const classList = Array.from(code.classList);
    const langClass = classList.find(c => c.startsWith('language-')) || '';
    const rawLang = langClass.replace('language-', '').toLowerCase().trim();

    if (rawLang === 'map' || rawLang === 'location' || rawLang === 'geo' || rawLang.startsWith('map:')) {
      const rawText = code.innerText.trim();
      let mapData = null;

      try {
        if (rawText.startsWith('{') && rawText.endsWith('}')) {
          mapData = JSON.parse(rawText);
        }
      } catch (e) {}

      if (!mapData) {
        const latMatch = rawText.match(/lat(?:itude)?[:=\s]+([-\d.]+)/i) || rawText.match(/^([-\d.]+)\s*,\s*([-\d.]+)/);
        const lngMatch = rawText.match(/lng|long(?:itude)?[:=\s]+([-\d.]+)/i);
        const titleMatch = rawText.match(/title[:=\s]+["']?([^"'\n]+)["']?/i) || rawText.match(/name[:=\s]+["']?([^"'\n]+)["']?/i);
        const statusMatch = rawText.match(/status[:=\s]+["']?([^"'\n]+)["']?/i);
        const hoursMatch = rawText.match(/hours[:=\s]+["']?([^"'\n]+)["']?/i);

        if (latMatch && lngMatch) {
          mapData = {
            lat: parseFloat(latMatch[1]),
            lng: parseFloat(lngMatch[1]),
            title: titleMatch ? titleMatch[1].trim() : 'Location Map',
            status: statusMatch ? statusMatch[1].trim() : 'Open Now',
            hours: hoursMatch ? hoursMatch[1].trim() : '',
            description: rawText.replace(/lat.*|lng.*|title.*/gi, '').trim()
          };
        } else if (latMatch && latMatch[2]) {
          mapData = {
            lat: parseFloat(latMatch[1]),
            lng: parseFloat(latMatch[2]),
            title: titleMatch ? titleMatch[1].trim() : 'Location Map'
          };
        }
      }

      if (mapData && mapData.lat && mapData.lng) {
        const card = createMapCanvasCard(mapData);
        const wrapper = code.closest('.code-block-wrapper') || code.closest('pre');
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.replaceChild(card, wrapper);
        }
      }
    }
  });

  // 2. Enhance inline [MAP: lat, lng | Title] tags
  const textNodes = [];
  const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walk.nextNode()) {
    if (n.nodeValue && n.nodeValue.includes('[MAP:')) {
      textNodes.push(n);
    }
  }

  textNodes.forEach(node => {
    const text = node.nodeValue;
    const match = text.match(/\[MAP:\s*([-\d.]+)\s*,\s*([-\d.]+)(?:\s*\|\s*([^\]]+))?\]/i);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const title = match[3] ? match[3].trim() : 'Location Overview';
      const card = createMapCanvasCard({ lat, lng, title });
      const parent = node.parentNode;
      if (parent) {
        parent.insertBefore(card, node);
        node.nodeValue = text.replace(match[0], '');
      }
    }
  });

  // 3. Auto-enhance Google Maps links in text to inline full-bleed Map Cards with Location Info
  if (!container.querySelector('.map-canvas-card')) {
    const mapLinks = container.querySelectorAll('a[href*="google.com/maps"], a[href*="maps.google.com"], a[href*="openstreetmap.org"]');
    mapLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent.trim();

      let matchedData = null;
      const cleanLinkText = text.toLowerCase().replace(/google maps\s*[-–—:]*\s*/i, '').trim();

      for (const [k, v] of Object.entries(KNOWN_LANDMARKS)) {
        if (cleanLinkText.includes(k) || href.toLowerCase().includes(k.replace(/\s+/g, '+')) || href.toLowerCase().includes(k.replace(/\s+/g, '%20'))) {
          matchedData = v;
          break;
        }
      }

      if (!matchedData) {
        const coordMatch = href.match(/(?:query|q|destination|loc)=([-\d.]+)[,+ ]+([-\d.]+)/i);
        if (coordMatch) {
          matchedData = {
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2]),
            title: cleanLinkText || 'Location Map',
            category: 'Location',
            status: 'Open Now',
            hours: 'Open today'
          };
        }
      }

      if (matchedData) {
        const card = createMapCanvasCard(matchedData);
        const parentLi = link.closest('li');
        if (parentLi && parentLi.parentNode) {
          parentLi.parentNode.replaceChild(card, parentLi);
        } else {
          const parentP = link.closest('p') || link;
          if (parentP && parentP.parentNode) {
            parentP.parentNode.replaceChild(card, parentP);
          }
        }
      }
    });
  }
}

// --- Global Declarations ---

let map;
let locationMarker = null; // Marker for the system/drone location
const body = document.body;

// --- Alert Polling Globals (Added from user request) ---
// IMPORTANT: Ensure your Python server (app.py) is running on port 5000!
const BRIDGE_SERVER_URL = 'http://127.0.0.1:5000/alerts'; 
const POLLING_INTERVAL = 10000; // Check every 10 seconds (10000 ms)

let lastAlertMessage = ''; 
let lastAlertSeverity = 'initial'; 
// Target the container that holds the individual alerts (set in DOMContentLoaded)
let alertContainer = null; 

// --- Helper Functions ---

/**
 * Function to generate a random number within a range (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer.
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper for simplified DOM lookup (used in net strength logic)
function $(id) {
    return document.getElementById(id);
}


// --- Map Initialization & Location Tracking (Only relevant for dashboard.html) ---
function initMap() {
    // 1. Initialize Map Core
    if (document.getElementById('map') && typeof L !== 'undefined' && !map) {
        map = L.map('map', {zoomControl:true, attributionControl:false})
            .setView([11.0168, 76.9558], 13); // Default center (Coimbatore)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(map);
        
        // 2. Start Location Tracking immediately after map setup
        startLocationTracking();
        
        // Fix map display issue if container size changes
        setTimeout(() => {
            map.invalidateSize();
        }, 500);
    }
}

function showSystemLocation(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    if (locationMarker) {
        locationMarker.setLatLng([lat, lon]);
    } else {
        locationMarker = L.marker([lat, lon]).addTo(map)
            .bindPopup(`System Location (Accuracy: ${accuracy.toFixed(0)}m)`).openPopup();
    }
    
    // Center map on the new location, maybe only once or on a specific user action
    // map.setView([lat, lon], map.getZoom()); 
}

function locationError(err) {
    console.error(`ERROR(${err.code}): ${err.message}`);
    // Fallback: If geolocation fails, set a static location for the marker
    if (document.getElementById('map') && typeof L !== 'undefined' && map && !locationMarker) {
        // Static location near the default center
        locationMarker = L.marker([11.0200, 76.9600]).addTo(map)
            .bindPopup('Fallback Location (Geolocation Failed)').openPopup();
    }
}

function startLocationTracking() {
    if ('geolocation' in navigator) {
        // Watch position instead of getCurrentPosition for live tracking
        navigator.geolocation.watchPosition(showSystemLocation, locationError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    } else {
        locationError({code: 0, message: "Geolocation not supported by browser."});
    }
}


// --- Sensor Data Update Logic (Mock Implementation) ---

/**
 * Function to update the sensor readings with mock data and visual indicators.
 * This is called every 10 seconds.
 */
function updateLiveSensors() {
    // Mock update for sensor data display elements (assuming IDs like data-temp, data-humid, etc. exist in the HTML)
    const temp = getRandomInt(25, 35);
    const humidity = getRandomInt(50, 80);
    const airPressure = getRandomInt(980, 1020);
    const co2 = getRandomInt(400, 700);

    const data = [
        { id: 'data-temp', value: `${temp}°C`, max: 30, min: 20 },
        { id: 'data-humid', value: `${humidity}%`, max: 70, min: 40 },
        { id: 'data-press', value: `${airPressure} hPa`, max: 1010, min: 990 },
        { id: 'data-co2', value: `${co2} ppm`, max: 600, min: 450 }
    ];

    data.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.textContent = item.value;
            // Simple visual indicator: if value is outside the comfortable range (max/min)
            const numericValue = parseFloat(item.value);
            if (numericValue > item.max || numericValue < item.min) {
                // Assuming Tailwind classes are used for styling, or fall back to CSS styles
                el.classList.add('text-red-500', 'font-bold'); 
            } else {
                el.classList.remove('text-red-500', 'font-bold');
            }
        }
    });
    
    // Placeholder for network strength and sparkline updates (using helper functions)
    // Note: If b1, b2, b3, b4, and spark elements are not in dashboard.html, these will be ignored.
    setBars(getRandomInt(50, 100)); 
    drawSpark(getRandomInt(50, 100));
}


// --- 1. NOTIFICATION HANDLERS (New Alert Logic) ---

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.error("Browser does not support desktop notification.");
        return;
    }
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            console.log("Notification permission:", permission);
        });
    }
}

function showNotification(title, body, severity) {
    if (Notification.permission === "granted") {
        const options = {
            body: body,
            // Use emojis reflecting Critical/Warning terminology
            icon: severity === 'red' ? '🚨' : (severity === 'yellow' ? '⚠️' : '🔔'), 
            vibrate: [200, 100, 200]
        };
        new Notification(title, options);
    }
}

// --- 2. ALERT FEED MANAGEMENT (New Alert Logic) ---

/**
 * Creates and displays a new alert item in the dashboard panel.
 * @param {string} level - 'red' or 'yellow'. 
 */
function createNewAlertItem(level, message) {
    if (!alertContainer) return; 

    const timestamp = new Date().toLocaleTimeString();
    
    // 1. Create the new alert element
    const newAlert = document.createElement('div');
    newAlert.className = `alert ${level}`;
    newAlert.style.opacity = 0; 
    
    // 2. Set the inner content
    newAlert.innerHTML = `
        <strong>${message}</strong>
        <small>From: AI Alert Bridge | ${timestamp}</small>
    `;

    // 3. Insert the new alert at the TOP of the container (most recent first)
    alertContainer.prepend(newAlert);
    
    // 4. Fade in the new alert
    setTimeout(() => {
        newAlert.style.transition = 'opacity 0.5s ease-in';
        newAlert.style.opacity = 1;
    }, 50); 
    
    // Optional: Keep only the last 10 alerts to prevent excessive DOM growth
    while (alertContainer.children.length > 10) {
        alertContainer.removeChild(alertContainer.lastChild);
    }
}

function checkAlertStatus() {
    fetch(BRIDGE_SERVER_URL)
        .then(response => {
            // 🛑 CRITICAL CHANGE: If status is 204 (No Content), skip JSON parsing and update.
            if (response.status === 204) {
                return null; 
            }
            if (!response.ok) {
                throw new Error('Network response not ok. AI Bridge error.');
            }
            return response.json();
        })
        .then(data => {
            // If data is null (due to 204 status), stop the function execution here.
            if (data === null) return; 
            
            const currentSeverity = data.severity;
            const message = data.message;
            
            // --- ALERT GENERATION LOGIC ---
            
            // Check if the alert message OR severity has genuinely changed
            if (message !== lastAlertMessage || currentSeverity !== lastAlertSeverity) {
                
                // 1. Create a new entry in the dashboard feed (will be red or yellow)
                createNewAlertItem(currentSeverity, message);

                // 2. Trigger the OS/browser notification
                let title = currentSeverity.toUpperCase() + " ALERT!";
                showNotification(title, message, currentSeverity);
            }
            
            // Update the trackers
            lastAlertMessage = message;
            lastAlertSeverity = currentSeverity;

        })
        .catch(error => {
            console.error('Connection Error:', error);
            // Show connection error in the panel if the bridge is down
            const connErrorMsg = 'WARNING: AI Bridge Server is offline. Data feed compromised.';
            if (lastAlertMessage !== connErrorMsg) {
                    createNewAlertItem('yellow', connErrorMsg);
                    lastAlertMessage = connErrorMsg;
            }
            lastAlertSeverity = 'yellow';
        });
}



// --- Simulation Data Logic (Placeholder for future development) ---

function renderSimContent(type) {
    const container = document.getElementById('simulation-content-container');
    if (!container) return;

    let title = "";
    let content = "";

    switch (type) {
        case 'zoonotic':
            title = "Zoonotic Outbreak Simulation";
            content = "<p>Model current transmission risk based on animal vector migration and human population density. <strong>Risk Level: Moderate.</strong></p><p><small>Simulation parameters: Wildlife movement data, seasonal changes, and localized weather.</small></p>";
            break;
        case 'wildfire':
            title = "Wildfire Spread Prediction";
            content = "<p>Predict fire path and intensity based on wind speed, temperature, and vegetation dryness. <strong>Warning: High Risk in Sector 7.</strong></p><p><small>Simulation parameters: Wind vector, biomass moisture index, and topographical data.</small></p>";
            break;
        case 'aqi':
            title = "Air Quality Index Forecast";
            content = "<p>Forecast air quality and pollutant dispersion across monitored zones for the next 48 hours. <strong>Forecast: Dropping (AQI 120).</strong></p><p><small>Simulation parameters: Industrial emissions, vehicular traffic, and atmospheric stability.</small></p>";
            break;
        default:
            title = "Select a Simulation";
            content = "<p>Please select a simulation type from the panel above.</p>";
    }

    container.innerHTML = `
        <h3>${title}</h3>
        <div class="sim-panel">${content}</div>
        <button class="btn-primary" style="margin-top: 20px;">Run Full Simulation</button>
    `;
}


// --- FULL CHAT BOT LOGIC ---

// Helper function to create and append a message element
// --- Corrected createMessage function with animation trigger ---
function createMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    const now = new Date();
    // Format timestamp as HH:MM AM/PM
    const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // 1. Create Wrapper (handles alignment: user=right, bot=left)
    const msgWrapper = document.createElement('div');
    msgWrapper.classList.add('msg-wrapper', sender);

    // 2. Create Message Bubble
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg');
    // Use innerHTML to allow for bold tags (from bot response)
    msgDiv.innerHTML = text; 

    // 3. Create Info/Timestamp Element (absolutely positioned by CSS)
    const msgInfo = document.createElement('span');
    msgInfo.classList.add('msg-info');
    msgInfo.innerHTML = `${sender === 'user' ? 'You' : 'Assistant'} • <span class="timestamp">${timestamp}</span>`;
    
    // Append info inside the bubble itself 
    msgDiv.appendChild(msgInfo); 
    msgWrapper.appendChild(msgDiv);
    
    // Append the message wrapper to the chat box
    chatBox.appendChild(msgWrapper);
    
    // *** CRITICAL: Trigger the animation after appending ***
    setTimeout(() => {
        msgWrapper.classList.add('show');
    }, 10);
    
    // Scroll to the bottom to see the new message
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to handle the bot's response logic
function getBotResponse(message) {
    const lowerCaseMsg = message.toLowerCase().trim();

    // --- EXISTING GENERAL COMMANDS (Alerts, Status, Greeting) ---
    if (lowerCaseMsg.includes('latest alerts') || lowerCaseMsg.includes('alerts')) {
        return "Current Alerts: High fire risk in Sector C. All Ranger Teams notified. Check **Reports** tab for details.";
    } else if (lowerCaseMsg.includes('drone status') || lowerCaseMsg.includes('drone')) {
        return "Drone Status: Drone 1 (Sector A) - Online, 95% Battery. Drone 2 (Sector B) - Offline for maintenance. Data feed is stable.";
    } else if (lowerCaseMsg.includes('simulation help') || lowerCaseMsg.includes('sim')) {
        return "Simulation Help: To run a new disease outbreak simulation, go to the **'Simulation'** tab and select 'New Scenario'. You can adjust parameters like R-naught and population density.";
    } else if (lowerCaseMsg.includes('hello') || lowerCaseMsg.includes('hi')) {
        return "Hello! I'm monitoring all systems. How may I assist you with the environmental or health data today?";
    } else if (lowerCaseMsg.includes('weather')) {
        return "I can check environmental data. Could you specify a location or sector?";
    } else if (lowerCaseMsg.includes('emergency') || lowerCaseMsg.includes('help')) {
        // Highlighting the emergency numbers from the HTML team cards
        const emergencyInfo = `🚨 Emergency! Please use the direct contact numbers for the relevant team: 
        <br>Ranger: 112
        <br>Veterinary: 1962
        <br>Fire Response: 1800 425 4586
        <br>Medical Assistant: 108`;
        return emergencyInfo;
    } 

    // --- NEW DISASTER-SPECIFIC COMMANDS ---
    
    // 1. Fire Warning / Risk
// --- COMPLETE ACTIONABLE RESPONSE LIST (Single Line Format) ---

    // FIRE & HAZARD CORE PROTOCOLS
    else if (lowerCaseMsg.includes('fire warning') || lowerCaseMsg.includes('fire risk')) return "🔥 CRITICAL ALERT: High fire risk. Check Dashboard gas levels and immediately contact Fire Response.";
    else if (lowerCaseMsg.includes('wildfire simulation') || lowerCaseMsg.includes('run fire sim')) return "🧪 Simulation initiating. Modeling fire spread with current wind data. Review the Simulation tab in 2 minutes.";
    else if (lowerCaseMsg.includes('fire response') && lowerCaseMsg.includes('eta')) return "Fire Response ETA for the critical zone is 15 minutes. Confirming route clearance now.";
    else if (lowerCaseMsg.includes('gas leak') || lowerCaseMsg.includes('toxic fumes')) return "⚠️ HAZARD ALERT: Gas leak confirmed near Sensor Array 5. Initiating ventilation protocol. Evacuate personnel immediately.";
    else if (lowerCaseMsg.includes('fire team eta to')) return "Fire Response ETA to your current location is 18 minutes. Hold position and wait for confirmation signal.";
    else if (lowerCaseMsg.includes('wind patterns') || lowerCaseMsg.includes('fire spread')) return "Current wind is North-West at 15 km/h. Fire spread simulation predicts boundary crossing in 45 minutes. Adjust deployment routes.";
    else if (lowerCaseMsg.includes('humidity critical')) return "Environmental Humidity is below 30%. Critical conditions for rapid fire spread. Requesting immediate atmospheric misting if available.";
    else if (lowerCaseMsg.includes('deploy suppression drones')) return "🚁 SUPPRESSION DRONES: Preparing payload. Confirm target zone and clearance for flight path before launch.";
    else if (lowerCaseMsg.includes('check smoke level') || lowerCaseMsg.includes('smoke detection')) return "Smoke Detection Alert: Levels are spiking near the Northern perimeter. Confirming gas sensor integrity now.";
    else if (lowerCaseMsg.includes('flame reported') || lowerCaseMsg.includes('active flame')) return "Active Flame Reported: Cross-referencing visual data with thermal sensors. Contact Fire Response immediately.";
    else if (lowerCaseMsg.includes('firebreak status')) return "Firebreak Status: Firebreak Alpha is cleared. Firebreak Beta requires immediate inspection for dry brush accumulation.";
    else if (lowerCaseMsg.includes('containment plan')) return "Containment Plan: The current strategy is to use Firebreak Alpha as the primary boundary. Monitor wind shift.";
    else if (lowerCaseMsg.includes('last fire report')) return "Last Fire Report: Incident resolved at 15:30 IST. Post-incident assessment pending. Check Reports tab for summary.";

    // RANGER & SECURITY PROTOCOLS
    else if (lowerCaseMsg.includes('vibration anomaly') || lowerCaseMsg.includes('seismic')) return "⚠️ Vibration Anomaly: Confirmed high seismic activity in Sector 4. Ranger Team notified to assess ground stability.";
    else if (lowerCaseMsg.includes('intruder') || lowerCaseMsg.includes('illegal activity')) return "Intruder Protocol 3A: Do not engage. Notify the Ranger Team immediately via emergency line (112).";
    else if (lowerCaseMsg.includes('ranger emergency') || lowerCaseMsg.includes('contact 112')) return "📞 Ranger Emergency Contact: Dial 112.";
    else if (lowerCaseMsg.includes('accelerometer readings') || lowerCaseMsg.includes('ground movement')) return "Accelerometer Report: Z-axis stability is nominal (2.981). High Y-axis fluctuation (-9.257) confirms ongoing ground instability.";
    else if (lowerCaseMsg.includes('sector 3 patrol')) return "Ranger Team 3 is currently conducting an emergency patrol in Sector 3, Grid E-4. Last check-in was 5 minutes ago.";
    else if (lowerCaseMsg.includes('communication breakdown')) return "📡 COMMUNICATION WARNING: Signal loss detected in Sector 2. Dispatching Drone Alpha to establish relay and check ground unit status.";
    else if (lowerCaseMsg.includes('ranger log')) return "Latest Ranger Log (16:35 IST): Report of possible snare trap near the river delta. Veterinary Unit has been notified.";
    else if (lowerCaseMsg.includes('environmental data for sector')) return "Sector Data (Current): Temp 28°C, Hum 55%, Gas (MQ6) 450. Conditions are stable, but visibility is low.";
    else if (lowerCaseMsg.includes('perimeter breach')) return "Perimeter Breach Alert: Sensor triggered on the West fence line. Ranger Team 1 dispatched to investigate.";
    else if (lowerCaseMsg.includes('gear status')) return "Ranger Gear Status: All field equipment is confirmed functional. Drones carrying thermal optics are deployed.";
    else if (lowerCaseMsg.includes('search pattern')) return "Search Pattern: Initiating grid search pattern Alpha-4. Teams must maintain radio silence until discovery.";
    else if (lowerCaseMsg.includes('drone visual feed')) return "Drone Visual Feed: Switching main display to live feed from Drone Beta, currently over the anomaly location.";
    else if (lowerCaseMsg.includes('geological stability')) return "Geological Stability: The fault line monitor shows minor, continuous shifts. Avoid heavy vehicle use in Sector 4.";
    else if (lowerCaseMsg.includes('intruder alert')) return "Intruder Alert: Sensor Array 8 reports unauthorized movement. Ranger Team 1 is confirming the threat level.";
    else if (lowerCaseMsg.includes('unauthorized vehicle')) return "Unauthorized Vehicle Protocol: Drone Alpha is tracking a vehicle near Sector G. Provide live GPS coordinates to the Ranger Team.";
    else if (lowerCaseMsg.includes('security camera feed')) return "Security Camera Feed: Switching main display to Camera 4 feed. Focus on the North-East boundary gate.";
    else if (lowerCaseMsg.includes('poaching suspected')) return "Poaching Suspected: Specialized acoustic sensor triggered. Ranger Team 3 is commencing silent approach.";
    else if (lowerCaseMsg.includes('border crossing')) return "Border Crossing Alert: Unidentified personnel detected crossing the defined conservation area boundary. Initiate visual tracking.";
    else if (lowerCaseMsg.includes('safe word')) return "Security Safe Word Confirmed: All systems are green. Proceed with caution and maintain standard operating procedures.";
    else if (lowerCaseMsg.includes('field operative status')) return "Field Operative Status: All personnel confirmed accounted for and logged in the secure zone.";
    else if (lowerCaseMsg.includes('trap detection')) return "Trap Detection Alert: Passive infrared sensor identified a potential snare trap location. Veterinary Unit is advised to stand by.";
    else if (lowerCaseMsg.includes('alarm')) return "System Alarm: Sensor array malfunction in Sector 5. Switching to auxiliary power and logging the error.";
    else if (lowerCaseMsg.includes('breach')) return "Breach Confirmed: Perimeter zone G compromised. All non-essential personnel are to evacuate to Safety Point 2.";
    else if (lowerCaseMsg.includes('tracking')) return "Tracking Initiated: Live GPS feed activated for field operative Alpha. Coordinates are updating on the main map display.";
    else if (lowerCaseMsg.includes('hostile')) return "Hostile Presence Reported: Unidentified individuals sighted near the storage depot. Rangers are en route. Maintain visual distance.";
    else if (lowerCaseMsg.includes('block')) return "Route Blocked: Road access to Sector C is impassable due to fallen debris. Re-routing all response vehicles via Alternate Path A.";

    // MEDICAL & PUBLIC HEALTH PROTOCOLS
    else if (lowerCaseMsg.includes('medical assistant contact') || lowerCaseMsg.includes('contact 108')) return "🚑 Medical Emergency: Contact the Medical Assistant Unit immediately at 108.";
    else if (lowerCaseMsg.includes('public health protocol') || lowerCaseMsg.includes('outbreak protocol')) return "Public Health Protocol 5B Activated: Isolate the area. Do not permit unauthorized entry. Medical Assistant Team dispatched for screening.";
    else if (lowerCaseMsg.includes('human health hazard')) return "Reported Hazard: Contaminated water source in the east village. Medical Assistant notified. Do not consume water from this area.";
    else if (lowerCaseMsg.includes('nearest medical facility')) return "Nearest Medical Facility: Jungle Outpost Clinic, 12 km East. Coordinates: 11.0500°N, 77.0500°E.";
    else if (lowerCaseMsg.includes('request patient transport')) return "Patient Transport requested. Ambulance ETA to the nearest pickup zone is 15 minutes. Prepare the patient for transport.";
    else if (lowerCaseMsg.includes('air quality')) return "Air Quality Index (AQI): 95 (Moderate). Particulate matter (PM2.5) elevated due to dust. Use face masks in the north zone.";
    else if (lowerCaseMsg.includes('need evacuation')) return "Evacuation Request Acknowledged: Sending nearest Medical Assistant team and coordinating air lift if necessary.";
    else if (lowerCaseMsg.includes('medical supplies')) return "Medical Supplies: Inventory check shows low stock of trauma kits. Request resupply from central depot.";
    else if (lowerCaseMsg.includes('quarantine zone')) return "Quarantine Zone Status: Zone Q-1 is established and secured by Rangers. No unauthorized entry allowed.";
    else if (lowerCaseMsg.includes('vaccination status')) return "Vaccination Status: All deployed personnel are confirmed up-to-date on required vaccinations.";
    else if (lowerCaseMsg.includes('human temperature high')) return "High Human Temperature Alert: Field operative 4's biometric data is critical. Requesting immediate medical review.";

    // VETERINARY & WILDLIFE PROTOCOLS
    else if (lowerCaseMsg.includes('zoonotic threat') || lowerCaseMsg.includes('disease threat')) return "🦠 Potential Zoonotic Threat: Checking recent lab results. Veterinary Unit is on standby.";
    else if (lowerCaseMsg.includes('veterinary status') || lowerCaseMsg.includes('vets deployed')) return "Veterinary Unit is deployed to the Animal Health Outpost (Sector 2). Standby for status update.";
    else if (lowerCaseMsg.includes('sick elephant') || lowerCaseMsg.includes('large animal protocol')) return "Large Animal Protocol: Send GPS coordinates immediately to the Veterinary Unit. Do not approach without supervision.";
    else if (lowerCaseMsg.includes('nearest animal rescue') || lowerCaseMsg.includes('rescue point')) return "The nearest established Rescue Point is Point Delta (4.5 km away). Route and coordinates sent to your device.";
    else if (lowerCaseMsg.includes('wildlife movement tracking') || lowerCaseMsg.includes('animal tracking')) return "Tracking active. Major herd movement detected towards the south boundary (Sector F). Confirming reason for displacement.";
    else if (lowerCaseMsg.includes('last known gps') || lowerCaseMsg.includes('location of tiger')) return "Last known GPS for the tagged Tiger is 11.0023°N, 77.0125°E (4 minutes ago). Status: Resting.";
    else if (lowerCaseMsg.includes('request field team')) return "Field Team Request received. Veterinary Unit 2 is en route to the location of the sick animal. ETA 30 minutes.";
    else if (lowerCaseMsg.includes('animal health outpost')) return "Animal Health Outpost status: Operational, 3 staff present. Current stock of emergency anti-venom is 10 units.";
    else if (lowerCaseMsg.includes('lab results') || lowerCaseMsg.includes('antivenom')) return "Lab Results: Preliminary tests on recent samples are negative for key zoonotic markers. Final report available in 2 hours.";
    else if (lowerCaseMsg.includes('animal injury')) return "Animal Injury Protocol: Confirm species and severity. Veterinary Unit team 3 is the closest unit available.";
    else if (lowerCaseMsg.includes('poaching activity')) return "Poaching Activity Alert: Acoustic sensor confirmed unauthorized gunshot sound. Ranger team notified. Veterinary Unit should stand by for intervention.";
    else if (lowerCaseMsg.includes('quarantine animal')) return "Animal Quarantine: Set up temporary isolation pens at Outpost 2. Use full PPE when handling the specimen.";
    else if (lowerCaseMsg.includes('pathogen identity')) return "Pathogen Identity: Initial tests suggest a viral hemorrhagic fever. Full ID requires 48 hours. Isolate all exposed animals.";
    else if (lowerCaseMsg.includes('translocation route')) return "Translocation Route: Route Gamma is cleared and safe for movement. Estimated travel time is 4 hours.";

    // SYSTEM & OPERATIONAL PROTOCOLS
    else if (lowerCaseMsg.includes('critical errors') || lowerCaseMsg.includes('system failure')) return "⚠️ Critical Error: Sensor Array 7 has failed. Switching to Drone surveillance feed for backup. Operations informed.";
    else if (lowerCaseMsg.includes('protocol for high priority alert')) return "High Priority Alert Protocol: 1. Verify sensor data. 2. Notify two relevant department heads. 3. Initiate real-time tracking of all field personnel.";
    else if (lowerCaseMsg.includes('system status')) return "All systems are green. Core servers are running at 45% load. Drone network is nominal. No current outages.";
    else if (lowerCaseMsg.includes('sensor status') || lowerCaseMsg.includes('sensors online')) return "All 18 environmental sensors are online and reporting. Array 7 data stream is currently being processed for stability check.";
    else if (lowerCaseMsg.includes('data records') || lowerCaseMsg.includes('latest data')) return "Latest Data Summary (16:38 IST): Temp 30.5°C, Vib DETECTED, Gas 505. See the Dashboard for trend graphs.";
    else if (lowerCaseMsg.includes('download csv')) return "CSV file generation initiated. The full sensor data log for the last 24 hours will be available for download in the Reports tab within 30 seconds.";
    else if (lowerCaseMsg.includes('power outage')) return "Power Outage Detected: Switching all critical sensors and communication hubs to backup battery power. System lifespan 6 hours.";
    else if (lowerCaseMsg.includes('check backup systems')) return "Backup Systems Check: All failover systems are green. Data redundancy is confirmed.";
    else if (lowerCaseMsg.includes('resource manifest')) return "Resource Manifest: Currently available resources include 2 heavy transport vehicles and 5 trauma kits. Check Logistics tab for details.";
    else if (lowerCaseMsg.includes('data latency')) return "Data Latency Warning: Real-time sensor latency has increased to 4 seconds. Network engineer is working on the connection stability.";
    else if (lowerCaseMsg.includes('system reboot')) return "System Reboot: Initiating partial system reboot of the sensor network. Critical data logging will continue uninterrupted.";
    else if (lowerCaseMsg.includes('threat')) return "Threat Identified: Unknown biological agent detected. Contact Veterinary Unit (1962) and follow isolation protocol.";
    else if (lowerCaseMsg.includes('danger')) return "Danger Imminent: Hazardous gas levels confirmed. Initiate immediate dispersal and deploy emergency breathing apparatus.";
    else if (lowerCaseMsg.includes('secure')) return "Security Status: All access points are locked and monitored. Confirming internal security sweep by Ranger Team.";
    else if (lowerCaseMsg.includes('escape')) return "Escape Route: Use Emergency Egress Route 4, heading West to the nearest extraction point. Confirm clearance upon arrival.";
    else if (lowerCaseMsg.includes('drone')) return "Drone Deployment: Launching Drone 3 to provide real-time aerial assessment of the incident zone.";
    // --- NEW SINGLE-WORD DISASTER/SECURITY CHECKS ---
    else if (lowerCaseMsg.includes('alarm')) return "System Alarm: Sensor array malfunction in Sector 5. Switching to auxiliary power and logging the error.";
    else if (lowerCaseMsg.includes('breach')) return "Breach Confirmed: Perimeter zone G compromised. All non-essential personnel are to evacuate to Safety Point 2.";
    else if (lowerCaseMsg.includes('threat')) return "Threat Identified: Unknown biological agent detected. Contact Veterinary Unit (1962) and follow isolation protocol.";
    else if (lowerCaseMsg.includes('danger')) return "Danger Imminent: Hazardous gas levels confirmed. Initiate immediate dispersal and deploy emergency breathing apparatus.";
    else if (lowerCaseMsg.includes('secure')) return "Security Status: All access points are locked and monitored. Confirming internal security sweep by Ranger Team.";
    else if (lowerCaseMsg.includes('block')) return "Route Blocked: Road access to Sector C is impassable due to fallen debris. Re-routing all response vehicles via Alternate Path A.";
    else if (lowerCaseMsg.includes('tracking')) return "Tracking Initiated: Live GPS feed activated for field operative Alpha. Coordinates are updating on the main map display.";
    else if (lowerCaseMsg.includes('hostile')) return "Hostile Presence Reported: Unidentified individuals sighted near the storage depot. Rangers are en route. Maintain visual distance.";
    else if (lowerCaseMsg.includes('escape')) return "Escape Route: Use Emergency Egress Route 4, heading West to the nearest extraction point. Confirm clearance upon arrival.";
    else if (lowerCaseMsg.includes('drone')) return "Drone Deployment: Launching Drone 3 to provide real-time aerial assessment of the incident zone.";
    // --- DEFAULT RESPONSE ---
    else {
        // Default response
        return "I see you typed: '" + message + "'. I can provide system updates, alerts, and data summaries. Try asking about 'Latest Alerts', 'Drone Status', or a disaster like 'Fire Warning'.";
    }
}
// Main send message handler for the chat
function sendMessage() {
    const userInput = document.getElementById('userInput');
    if (!userInput) return; // Exit if not on communication.html
    
    const message = userInput.value.trim();
    if (message === '') return; // Don't send empty messages

    // 1. Display user message
    createMessage(message, 'user');
    
    // Clear input field
    userInput.value = '';

    // 2. Simulate bot typing/delay for a better UX
    setTimeout(() => {
        // 3. Get and display bot response
        const botResponse = getBotResponse(message);
        createMessage(botResponse, 'bot');
    }, 500); // 500ms delay
}


// --- Theme Logic ---

function applyTheme(isDarkMode) {
    if (isDarkMode) {
        body.classList.remove('light-mode');
        // Save 'dark'
        localStorage.setItem('theme', 'dark');
    } else {
        // Adding the 'light-mode' class enables the CSS overrides
        body.classList.add('light-mode');
        // Save 'light'
        localStorage.setItem('theme', 'light');
    }
    
    // Update the toggle switch to match the applied theme (for settings.html)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // If the theme being applied is dark, the checkbox should be checked = false (off)
        // If the theme being applied is light, the checkbox should be checked = true (on)
        themeToggle.checked = !isDarkMode; 
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Default to dark mode if no preference is saved.
    let isDarkMode = true; 

    // If preference is explicitly 'light', switch to light mode.
    if (savedTheme === 'light') {
        isDarkMode = false; 
    }
    
    // Immediately apply the saved class to prevent "flashing"
    if (!isDarkMode) {
        body.classList.add('light-mode');
    }

    // Set the initial visual state of the toggle switch
    if (themeToggle) {
        themeToggle.checked = !isDarkMode;
    }
}


// --- NET/SPARKLINE LOGIC (For System Status Panel) ---

function setBars(q){
    const bars = [ $("b1"), $("b2"), $("b3"), $("b4") ].filter(Boolean);
    const levels = Math.round(((+q||0)/100)*4);
    bars.forEach((b,i)=> b.classList.toggle("on", i < levels));
}
const sparkPoints = [];
function drawSpark(v){
    const c = $("spark"); if (!c) return;
    const ctx = c.getContext("2d");
    sparkPoints.push(+v||0);
    if (sparkPoints.length > 80) sparkPoints.shift();
    ctx.clearRect(0,0,c.width,c.height);
    ctx.strokeStyle = "#33e1a1"; ctx.lineWidth = 2; ctx.beginPath();
    sparkPoints.forEach((y,i)=>{
        const x = (i/(80-1))* (c.width-8) + 4;
        const ya = c.height - (y/100)*(c.height-8) - 4;
        if(i===0) ctx.moveTo(x, ya); else ctx.lineTo(x, ya);
    });
    ctx.stroke();
}

// ---------- logging ----------
function logLine(t){
    const el = $("log"); if (!el) return;
    const time = new Date().toLocaleTimeString();
    el.innerHTML = `<div>[${time}] ${t}</div>` + el.innerHTML;
}


// --- RESCUER PREDICTION LOGIC (NEW) ---

/**
 * Calculates the recommended number of rescuers based on detected survivors.
 * Rule: 1–2 ➜ 2; 3–4 ➜ 4; 5–6 ➜ 6; >6 ➜ ceil(1.2×N)
 */
function calculateRecommendedRescuers(survivorCount) {
    if (survivorCount <= 0) {
        return 0;
    } else if (survivorCount <= 2) {
        return 2;
    } else if (survivorCount <= 4) {
        return 4;
    } else if (survivorCount <= 6) {
        return 6;
    } else {
        return Math.ceil(1.2 * survivorCount);
    }
}

// Function to update the prediction panel display
function updatePredictionDisplay(detectedSurvivors) {
    const pplDisplay = document.getElementById('ppl'); 
    const rescDisplay = document.getElementById('resc'); 
    
    if (pplDisplay && rescDisplay) {
        const recommendedRescuers = calculateRecommendedRescuers(detectedSurvivors);
        pplDisplay.textContent = detectedSurvivors;
        rescDisplay.textContent = recommendedRescuers;
    }
}

// Initial/Simulated live survivor count
let liveSurvivorCount = 0; 


// --- Main Document Ready Function ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load theme instantly on EVERY page load (sets class and toggle state)
    loadTheme();

    // 2. Set up Alert Polling and Notifications (New Logic)
    alertContainer = document.getElementById('live-alert-status'); // Set global container variable
    requestNotificationPermission();
    // Start the continuous polling for alerts
    checkAlertStatus();
    setInterval(checkAlertStatus, POLLING_INTERVAL); 
    // END ALERT LOGIC SETUP

    // 3. Theme Toggle Listener (for settings page)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            // Apply theme based on checkbox state: true (checked) = Light Mode (isDarkMode=false)
            applyTheme(!e.target.checked); 
        });
    }
    
    // 4. Initial Message Timestamp Update (for the communication.html welcome message)
    const initialTimestampElement = document.querySelector('.msg-wrapper.bot .timestamp');
    if (initialTimestampElement) {
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        initialTimestampElement.textContent = time;
    }

    // 5. Dashboard Initialization (for dashboard.html)
    if (document.getElementById('dashboard-content')) {
        initMap(); // Calls initMap, which calls startLocationTracking
        updateLiveSensors(); // Initial mock data fetch
        // INTERVAL CHANGED TO 10000ms for 10 seconds
        setInterval(updateLiveSensors, 10000); 
        
        // --- Rescuer Prediction Setup (Dashboard) ---
        const survivorInput = document.getElementById('survivor-input');
        const applyOverrideButton = document.getElementById('apply-override');

        updatePredictionDisplay(liveSurvivorCount); // Initial state (0 survivors)

        if (applyOverrideButton && survivorInput) {
            applyOverrideButton.addEventListener('click', () => {
                const manualValue = parseInt(survivorInput.value);

                if (!isNaN(manualValue) && manualValue >= 0) {
                    liveSurvivorCount = manualValue;
                    updatePredictionDisplay(liveSurvivorCount);
                    survivorInput.value = ''; // Clear input after applying
                } else if (survivorInput.value === '') {
                     liveSurvivorCount = 0; // Reset to 0 if input is cleared and applied
                     updatePredictionDisplay(liveSurvivorCount);
                }
            });
            
            // Allow Enter key to apply override
            survivorInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    applyOverrideButton.click();
                }
            });
        }
    }

    // 6. Simulation Content Listener (for simulation.html)
    const simButtons = document.querySelectorAll('.sim-btn');
    if (simButtons.length > 0) {
        simButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                simButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderSimContent(btn.dataset.type);
            });
        });
        // Initial load for Simulation page
        renderSimContent('zoonotic'); 
    }

    // 7. Chat Event Listeners (for communication.html)
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const quickActionBtns = document.querySelectorAll('.quick-actions button');
    const teamCards = document.querySelectorAll('.team-card');
    const chatBox = document.getElementById('chatBox');


    if (sendBtn && userInput) {
        // A. Send button click
        sendBtn.addEventListener('click', sendMessage);

        // B. Enter key press in the input field
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // C. Quick action buttons
        quickActionBtns.forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                let messageText = '';
                
                // Map data-action to a user-friendly message
                switch(action) {
                    case 'alerts':
                        messageText = 'Latest Alerts';
                        break;
                    case 'drone-status':
                        messageText = 'Drone Status';
                        break;
                    case 'sim-help':
                        messageText = 'Simulation Help';
                        break;
                    default:
                        messageText = '';
                }
                
                if (messageText) {
                    // Set the input field and trigger the send function
                    userInput.value = messageText;
                    sendMessage();
                }
            });
        });

        // D. Team Card Interaction 
        teamCards.forEach(card => {
            card.addEventListener('click', function() {
                // Remove active class from all
                teamCards.forEach(c => c.classList.remove('active'));
                // Add active class to the clicked card
                this.classList.add('active');
                
                const teamName = this.querySelector('h4').textContent;
                createMessage(`Selected **${teamName}**. You can now directly send messages or alerts related to this team.`, 'bot');
            });
        });
        
        // Initial scroll to bottom (for the existing welcome message)
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    // 8. Handle Generic Action Button Clicks (Placeholder for other pages)
    document.querySelectorAll('.action-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const actionText = event.currentTarget.textContent.trim().replace(/\s\s+/g, ' ');
            alert(`Action: "${actionText}" triggered. (Functionality coming soon!)`);
        });
    });
});
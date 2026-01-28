# Save this file as 'app.py'
# Required: pip install Flask flask-cors requests

from flask import Flask, jsonify
from flask_cors import CORS
import random
import time

# 1. IMPORT THE NETWORK STATUS MODULE
# Assumes network_status.py is in the same directory
from network_status import get_network_strength 

app = Flask(__name__)
CORS(app) 

# --- CONFIGURATION ---
# Define the alert thresholds
TEMP_CRITICAL_THRESHOLD = 95.0
GAS_CRITICAL_THRESHOLD = 120.0
VIB_CRITICAL_THRESHOLD = 0.8
# --- END CONFIGURATION ---


def fetch_external_sensor_data():
    """
    *** SIMULATION MODE *** Generates random sensor data to test alert logic.
    Biased to frequently trigger Critical (RED) alerts.
    """
    data = {}
    
    # 5% chance: Force all sensors into the CRITICAL AND zone
    if random.random() < 0.05:
        data = {
            'temperature': random.uniform(98, 110),
            'gas_ppm': random.uniform(130, 200),
            'vibration_g': random.uniform(0.9, 1.5)
        }
    else:
        # 95% chance: Generate data with a high likelihood of hitting individual 
        # or multiple thresholds to trigger WARNINGS and occasional CRITICALS.
        data = {
            'temperature': random.uniform(85, 105), 
            'gas_ppm': random.uniform(80, 150), 
            'vibration_g': random.uniform(0.6, 1.2) 
        }
    
    return data


@app.route('/alerts', methods=['GET'])
def get_alert_status():
    """
    API endpoint for simulated sensor alerts (Critical/Warning/Normal).
    """
    data = fetch_external_sensor_data()
    
    current_temp = data.get('temperature', 0)
    current_gas = data.get('gas_ppm', 0)
    current_vib = data.get('vibration_g', 0)

    
    # --- CRITICAL ALERT (RED) LOGIC ---
    temp_is_high = current_temp > TEMP_CRITICAL_THRESHOLD
    gas_is_high = current_gas > GAS_CRITICAL_THRESHOLD
    vib_is_high = current_vib > VIB_CRITICAL_THRESHOLD
    
    if temp_is_high and gas_is_high and vib_is_high:
        message = (
            f"CRITICAL SYSTEM FAILURE: ALL Sensors Exceeded Thresholds! "
            f"T:{current_temp:.1f}°C, G:{current_gas:.0f} ppm, V:{current_vib:.2f}g."
        )
        return jsonify({
            'severity': 'red',
            'message': message,
            'timestamp': time.time()
        })
    
    # --- WARNING ALERT (YELLOW) LOGIC ---
    elif temp_is_high or gas_is_high or vib_is_high:
        warnings = []
        if temp_is_high:
            warnings.append(f"High Temp ({current_temp:.1f}°C)")
        if gas_is_high:
            warnings.append(f"High Gas ({current_gas:.0f} ppm)")
        if vib_is_high:
            warnings.append(f"High Vib ({current_vib:.2f} g)")
            
        message = f"WARNING: Elevated Sensor Readings: {', '.join(warnings)}. Monitor system."
        
        return jsonify({
            'severity': 'yellow',
            'message': message,
            'timestamp': time.time()
        })

    # --- NORMAL (NO MESSAGE) LOGIC ---
    else:
        # Return HTTP 204 No Content for System Normal
        return ('', 204)


@app.route('/network', methods=['GET'])
def get_network_data():
    """
    API endpoint for the dashboard to fetch RSSI and Quality data 
    from the imported network_status module.
    """
    # Calls the function imported from network_status.py
    data = get_network_strength()
    
    # Returns the dictionary as a JSON response
    return jsonify(data)


if __name__ == '__main__':
    # Start the server
    app.run(debug=True, port=5000)
# Save this file as 'app.py'
# Required: pip install Flask flask-cors requests

from flask import Flask, jsonify, render_template  # Added render_template
from flask_cors import CORS
import random
import time
import os  # Added os to handle Render's port

# 1. IMPORT THE NETWORK STATUS MODULE
from network_status import get_network_strength 

app = Flask(__name__)
CORS(app) 

# --- CONFIGURATION ---
TEMP_CRITICAL_THRESHOLD = 95.0
GAS_CRITICAL_THRESHOLD = 120.0
VIB_CRITICAL_THRESHOLD = 0.8
# --- END CONFIGURATION ---

# --- NEW ROUTES FOR YOUR DASHBOARDS ---

@app.route('/')
def home():
    """Serves the main dashboard from the 'templates' folder."""
    return render_template('dashboard.html')

@app.route('/map')
def map_page():
    """Serves the map dashboard."""
    return render_template('map.html')

@app.route('/simulation')
def simulation_page():
    """Serves the simulation page."""
    return render_template('simulation.html')

# Helper for other pages: This allows you to visit /ranger.html or /sensor.html automatically
@app.route('/<page_name>')
def other_pages(page_name):
    if page_name.endswith('.html'):
        return render_template(page_name)
    return render_template(f"{page_name}.html")

# --- END NEW ROUTES ---

def fetch_external_sensor_data():
    """*** SIMULATION MODE ***"""
    if random.random() < 0.05:
        data = {
            'temperature': random.uniform(98, 110),
            'gas_ppm': random.uniform(130, 200),
            'vibration_g': random.uniform(0.9, 1.5)
        }
    else:
        data = {
            'temperature': random.uniform(85, 105), 
            'gas_ppm': random.uniform(80, 150), 
            'vibration_g': random.uniform(0.6, 1.2) 
        }
    return data

@app.route('/alerts', methods=['GET'])
def get_alert_status():
    data = fetch_external_sensor_data()
    current_temp = data.get('temperature', 0)
    current_gas = data.get('gas_ppm', 0)
    current_vib = data.get('vibration_g', 0)

    temp_is_high = current_temp > TEMP_CRITICAL_THRESHOLD
    gas_is_high = current_gas > GAS_CRITICAL_THRESHOLD
    vib_is_high = current_vib > VIB_CRITICAL_THRESHOLD
    
    if temp_is_high and gas_is_high and vib_is_high:
        message = (f"CRITICAL SYSTEM FAILURE: ALL Sensors Exceeded Thresholds! "
                   f"T:{current_temp:.1f}°C, G:{current_gas:.0f} ppm, V:{current_vib:.2f}g.")
        return jsonify({'severity': 'red', 'message': message, 'timestamp': time.time()})
    
    elif temp_is_high or gas_is_high or vib_is_high:
        warnings = []
        if temp_is_high: warnings.append(f"High Temp ({current_temp:.1f}°C)")
        if gas_is_high: warnings.append(f"High Gas ({current_gas:.0f} ppm)")
        if vib_is_high: warnings.append(f"High Vib ({current_vib:.2f} g)")
        message = f"WARNING: Elevated Sensor Readings: {', '.join(warnings)}. Monitor system."
        return jsonify({'severity': 'yellow', 'message': message, 'timestamp': time.time()})
    else:
        return ('', 204)

@app.route('/network', methods=['GET'])
def get_network_data():
    data = get_network_strength()
    return jsonify(data)

if __name__ == '__main__':
    # Modified for Render: Use os.environ.get for the PORT
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
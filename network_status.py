# modules/network_status.py
import requests, random, time

ESP_NET_URL = "http://192.168.1.61/network" # change to your ESP2

def _mock():
    # ... (function body remains the same)
    rssi = random.randint(-86, -54)           # dBm
    qual = int((min(max(rssi, -100), -50) + 100) * 2)  # approx 0..100
    return {"rssi": rssi, "quality": qual, "timestamp": int(time.time())}

def get_network_strength():
    # ... (function body remains the same)
    """
    Try to fetch network JSON from ESP. If it fails, return realistic mock.
    Expected JSON: {"rssi": -65, "quality": 78}
    """
    try:
        r = requests.get(ESP_NET_URL, timeout=2)
        if r.status_code == 200:
            data = r.json()
            data.setdefault("timestamp", int(time.time()))
            return data
        return _mock()
    except Exception:
        return _mock()


# -----------------------------------------------
# ADD THIS BLOCK FOR STANDALONE EXECUTION/TESTING
# -----------------------------------------------
if __name__ == '__main__':
    print("Attempting to fetch network status...")
    status = get_network_strength()
    print("--- Network Status Result ---")
    
    # Print the result clearly, either real or mock data
    if status.get("rssi") is not None:
        print(f"RSSI: {status['rssi']} dBm")
        print(f"Quality: {status['quality']} %")
    
    print(f"Full Data: {status}")
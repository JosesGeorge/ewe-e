from __future__ import annotations
from dataclasses import dataclass
from typing import Deque, Iterable, List, Tuple, Optional
from collections import deque
import math
import time
import random # Needed for Kalman1D Demo

# ====================================================================
# CLASS DEFINITIONS
# ====================================================================

# ---------- 1) Exponential Moving Average Forecaster ----------

@dataclass
class EMAForecaster:
    """
    Fast, online exponential moving average forecaster.

    alpha: 0..1 smoothing factor (higher = reacts faster to new data)
    """
    alpha: float = 0.3
    _level: Optional[float] = None

    def update(self, value: float) -> float:
        """Feed a new observation and get the updated EMA."""
        if self._level is None:
            self._level = value
        else:
            # EMA formula: L_t = alpha * Y_t + (1 - alpha) * L_{t-1}
            self._level = self.alpha * value + (1 - self.alpha) * self._level
        return self._level

    def predict(self, steps: int = 1) -> float:
        """
        Predict `steps` ahead (for EMA it's the same value).
        """
        if self._level is None:
            raise ValueError("No data yet. Call update() first.")
        return self._level


# ---------- 2) Simple (1D) Kalman Filter for Sensor Smoothing ----------

@dataclass
class Kalman1D:
    """
    Minimal 1D Kalman filter for smoothing a single noisy signal.
    - q: process noise (how much the true state moves)
    - r: measurement noise (sensor noise)
    """
    q: float = 1e-3
    r: float = 1e-2
    x: Optional[float] = None
    p: float = 1.0

    def update(self, z: float) -> float:
        """Update with measurement z and return filtered estimate."""
        if self.x is None:
            # initialize with first observation
            self.x = z
            self.p = 1.0
            return self.x # Return initial estimate immediately

        # Predict
        self.p = self.p + self.q

        # Update
        k = self.p / (self.p + self.r) # Kalman Gain
        self.x = self.x + k * (z - self.x)
        self.p = (1 - k) * self.p
        return self.x


# ---------- 3) ETA (Arrival Time) Prediction ----------

@dataclass
class ETAPredictor:
    """
    Predict ETA based on the remaining distance (meters) and recent speed history (m/s).
    """
    window: int = 30  # number of recent speed samples
    _speeds: Deque[float] = None

    def __post_init__(self):
        self._speeds = deque(maxlen=self.window)

    def update_speed(self, speed_mps: float) -> None:
        """Add a speed sample in meters/second."""
        self._speeds.append(max(0.0, float(speed_mps)))

    def estimate_eta_seconds(self, remaining_distance_m: float, min_speed: float = 0.05) -> float:
        """
        Returns ETA in seconds using the harmonic mean of recent speeds.
        """
        if not self._speeds:
            v = min_speed
        else:
            # Use speeds greater than zero to avoid division issues
            valid_speeds = [s for s in self._speeds if s > 0]
            if not valid_speeds:
                 v = min_speed
            else:
                # Harmonic mean: N / Sum(1/s)
                inv = [1.0 / s for s in valid_speeds]
                v = len(valid_speeds) / sum(inv)
                v = max(v, min_speed) # Clamp to minimum speed

        return remaining_distance_m / v


# ---------- 4) Risk Heatmap with Temporal Decay ----------

@dataclass
class RiskHeatmap:
    """
    Maintains a risk grid that decays over time and can be reinforced by new observations.
    """
    rows: int
    cols: int
    decay_per_sec: float = 0.01  # 1% per second
    _grid: List[List[float]] = None
    _last_ts: float = None

    def __post_init__(self):
        self._grid = [[0.0 for _ in range(self.cols)] for _ in range(self.rows)]
        self._last_ts = time.time()

    def _apply_decay(self):
        now = time.time()
        dt = max(0.0, now - self._last_ts)
        self._last_ts = now
        if dt <= 0:
            return
        
        # Calculate the decay factor for the elapsed time
        decay_factor = max(0.0, 1.0 - self.decay_per_sec * dt)
        
        for r in range(self.rows):
            for c in range(self.cols):
                self._grid[r][c] *= decay_factor

    def reinforce(self, cells: Iterable[Tuple[int, int]], amount: float = 1.0) -> None:
        """
        Increase risk at given (row, col) cells. Decay is applied first.
        """
        self._apply_decay()
        for r, c in cells:
            if 0 <= r < self.rows and 0 <= c < self.cols:
                self._grid[r][c] += amount

    def get(self) -> List[List[float]]:
        """Return the current (decayed) risk grid. Decay is applied first."""
        self._apply_decay()
        return self._grid

# ====================================================================
# DEMONSTRATION SCRIPT
# ====================================================================

if __name__ == "__main__":
    print("--- 1. EMAForecaster Demo (Smoothing a Price Signal) ---")
    ema = EMAForecaster(alpha=0.2)
    prices = [10.0, 10.5, 11.0, 9.5, 12.0, 11.5]
    for p in prices:
        smoothed_value = ema.update(p)
        print(f"Observation: {p:<4} | EMA: {smoothed_value:.3f}")

    print(f"\nPrediction for next step: {ema.predict(steps=1):.3f}")

    print("\n" + "="*50 + "\n")

    print("--- 2. Kalman1D Demo (Filtering Noisy Sensor Data) ---")
    # Simulate a true value of 5.0 with added random noise
    kf = Kalman1D(q=1e-3, r=0.1) # q=process noise (small), r=measurement noise (higher)
    true_value = 5.0

    print(f"| {'Observation':<12} | {'Filtered Est.':<12} | {'Uncertainty (P)':<15} |")
    for i in range(10):
        # Generate noisy measurement
        measurement = true_value + random.uniform(-0.5, 0.5)
        filtered_estimate = kf.update(measurement)

        print(f"| {measurement:<12.3f} | {filtered_estimate:<12.3f} | {kf.p:<15.6f} |")

    print("\n" + "="*50 + "\n")

    print("--- 3. ETAPredictor Demo (Predicting Arrival Time) ---")
    eta_pred = ETAPredictor(window=5)
    remaining_distance_m = 1000.0 # 1 km

    # Speed samples (m/s)
    speeds = [5.0, 4.8, 5.2, 10.0, 4.9, 5.1, 4.7]

    print(f"Initial distance: {remaining_distance_m:.1f} meters")
    for speed in speeds:
        eta_pred.update_speed(speed)
        eta = eta_pred.estimate_eta_seconds(remaining_distance_m)
        # Calculate the actual average speed used for ETA for display purposes
        avg_speed_used = remaining_distance_m / eta
        print(f"Speed In: {speed:<4.1f} m/s | Avg Speed: {avg_speed_used:.2f} m/s | ETA: {eta:.1f} seconds")

    print("\n" + "="*50 + "\n")

    print("--- 4. RiskHeatmap Demo (Spatial Risk with Temporal Decay) ---")
    heatmap = RiskHeatmap(rows=3, cols=3, decay_per_sec=0.1) # 10% decay per second

    print("Initial Heatmap (at time 0):")
    for row in heatmap.get():
        print([f"{x:.3f}" for x in row])

    # Reinforce a cell
    heatmap.reinforce([(1, 1), (0, 2)], amount=5.0)
    print("\nHeatmap after initial reinforcement (5.0 at (1,1) and (0,2)):")
    for row in heatmap.get():
        print([f"{x:.3f}" for x in row])

    # Wait for 1 second to observe decay
    print("\n[...Waiting 1 second for decay...]")
    time.sleep(1.0)

    # Reinforce again, decay happens automatically before reinforcement
    heatmap.reinforce([(1, 1)], amount=2.0)
    print("\nHeatmap after 1s decay + reinforcement (2.0 at (1,1)):")
    for row in heatmap.get():
        print([f"{x:.3f}" for x in row])
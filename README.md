# Pine Valley 3D Disc Golf Championship

A complete, fully playable 3D disc golf simulator built using **HTML5, WebGL/Three.js, procedural Web Audio API, and custom aerodynamic physics simulation**.

---

## 🌟 Key Features

### 1. Realistic Disc Aerodynamics & Flight Ratings
- **4-Rating Flight System**:
  - **Speed** (1–14): Governs release velocity, air penetration, and high-speed cruise threshold.
  - **Glide** (1–7): Modulates base aerodynamic lift coefficient and float duration.
  - **Turn** (-5 to +1): Generates high-speed drift to the right for RHBH (Right-Hand Backhand) throws via gyroscopic precession.
  - **Fade** (0 to +5): Produces low-speed gyroscopic hook to the left as velocity decays.
- **Advanced Aerodynamic Modeling**:
  - Lift and Drag dynamically calculated based on relative airspeed ($\mathbf{v}_{rel} = \mathbf{v} - \mathbf{v}_{wind}$) and Angle of Attack ($\alpha = \theta_{nose} - \gamma_{flight}$).
  - Spin decay ($\dot{\omega} = -0.04 \omega$) reducing gyroscopic stability over time.
  - High-speed turn vs. low-speed fade gyroscopic pitching moments.
  - Crosswind plate interaction: crosswind blowing over top of banked plate pushes disc down; blowing underneath catches bottom plate and lifts disc.
  - Headwinds induce extra high-speed turn; tailwinds drop lift and trigger earlier fade.

### 2. Comprehensive Ground Physics & Interactions
- **Flare Skips**: High-speed, steep-hyzer landings cause beveled driver rims to bite into turf, leaping back into the air with a lateral flare kick.
- **Ground Rollers**: Steep edge landings transition into roller mode, curling along terrain contours on the disc's rim before wobbling and settling flat.
- **Spikes & Tombstones**: High-velocity vertical dives stick directly into soft turf with a deep impact thud.
- **Turf Friction Slides**: Flat landings skid across grass with kinetic friction deceleration.

### 2. Backhand (RHBH) vs. Forehand (RHFH) Throw Styles
- **Backhand (RHBH)**:
  - Clockwise (CW) spin.
  - High-speed turn drifts **right**, low-speed fade hooks **left**.
  - Natural flight: right then left (S-curve).
- **Forehand (RHFH / Sidearm)**:
  - Counter-Clockwise (CCW) spin.
  - Inverted gyroscopic precession moments: High-speed turn drifts **left**, low-speed fade hooks **right**!
  - Disc ready pose shifts to the right side of the body in sidearm flick stance.
  - Instant toggle via **`[H]`** hotkey or HUD button.

### 3. Clear & Substantial 3D Flight Line with Landing Bullseye
- Replaces hairline rendering with an **extruded 3D volumetric glowing tube** ($\approx 15\text{ cm}$ thick) with golden amber emissive sheen.
- **Dynamic Touchdown Bullseye**: Concentric target rings on the turf marking the exact projected landing point.
- **Floating Distance Readout**: 3D billboard placard hovering over the target displaying distance in feet and meters (e.g. `🎯 285 FT (87 M)`).
- Dynamically bends, arches, and recalculates in real-time as you adjust power, Hyzer/Anhyzer tilt, Nose pitch, disc mold, and throw style!

### 4. Seamless Launch Orientation
- Unified transform mathematics guarantees that the visual disc pose at the lie seamlessly transitions into flight without any $180^\circ$ coordinate flips or angle swaps upon release.

### 4. Dynamic Wind Simulation & 3D Wind Visuals
- Real-time wind with base speed, direction, altitude boundary gradient, and micro-gusts.
- 180 floating wind particles / drifting leaves streaming across the fairway in the direction of the wind.
- Animated red pennant flags on top of target baskets fluttering in the wind.
- Wind compass widget showing wind speed (MPH) and direction relative to player aim (Headwind, Tailwind, Crosswind).
- **3 Selectable Discs**:
  1. **Putter** (*Aviar Floater*): `2 | 4 | 0 | 1` — High glide, neutral stability, laser-straight approach & putting.
  2. **Midrange** (*Buzzz Precision*): `5 | 5 | -1 | 1` — Balanced flight, subtle high-speed turn, gentle fade.
  3. **Fairway Driver** (*Destroyer Pro*): `9 | 5 | -1 | 3` — High velocity, sharp aerodynamic rim, wide flex distance with aggressive fade hook.

### 2. Player Controls & Throw Mechanics
- **Aiming**: Smooth horizontal camera look via mouse drag or touch swipe. Visual aiming guide line and [B] "Aim at Basket" quick button.
- **3-Click Power & Accuracy Meter**:
  - **Click 1**: Starts charging throw power bar.
  - **Click 2**: Locks power percentage at peak. Needle reverses toward accuracy center mark.
  - **Click 3**: Locks accuracy in the center sweet spot (deviations produce slight release drift and wobble).
- **Angle Adjustment Controls**:
  - **Release Angle (Hyzer/Anhyzer)**: Interactive slider or [Q]/[E] hotkeys (-45° Hyzer to +45° Anhyzer).
  - **Nose Angle (Pitch/Elevation)**: Interactive slider or [R]/[F] hotkeys (-20° Nose Down to +30° Nose Up).
- **Lie System**:
  - Concrete tee pads for hole opening shots.
  - Dynamic mini marker disc placed at the lie after every throw.
  - Smooth camera translation/teleportation to the lie facing the basket for the next throw.

### 3. 9-Hole Championship Course Design
1. **Hole 1: "Pine Valley Meadow"** — Par 3, 230 ft (70 m). Gentle downhill straight warm-up fairway flanked by pines.
2. **Hole 2: "Oak Dogleg Right"** — Par 3, 280 ft (85 m). Dense oak tree cluster forcing an anhyzer turnover line.
3. **Hole 3: "Granite Ridge"** — Par 3, 310 ft (94 m). Elevated tee overlooking a scenic valley slope with rock outcroppings.
4. **Hole 4: "The Wooded Corridor"** — Par 3, 260 ft (79 m). Tight tree tunnel demanding a low-ceiling, laser-straight fairway shot.
5. **Hole 5: "Whispering Pines"** — Par 4, 420 ft (128 m). Long sweeping par 4 over rolling hills to an elevated knoll.
6. **Hole 6: "Reflecting Pond (Island Green)"** — Par 3, 245 ft (75 m). Island green encircled by a water hazard pond with wooden bridge.
7. **Hole 7: "Hyzer Gulch"** — Par 3, 295 ft (90 m). Deep natural dogleg left bending around granite cliffs.
8. **Hole 8: "The Hilltop Fortress"** — Par 3, 340 ft (104 m). Steep uphill drive (+28 ft elevation) testing power and nose angle.
9. **Hole 9: "Grand Finale (Clubhouse Green)"** — Par 4, 450 ft (137 m). Championship finisher across rolling hills and a paved walking path OB hazard to the clubhouse patio.

### 4. Realistic Basket & Out-of-Bounds (OB) Hazards
- **Tournament Basket Target**: Galvanized center pole, high-visibility yellow top band, 24 dual-tier steel chains, and lower collection tray.
- **Physical Chain Dampening**: Kinetic energy absorption that drops the disc down into the basket tray.
- **Out-of-Bounds Hazards**:
  - Water hazards and paved walking paths.
  - +1 stroke penalty banner and automatic lie reset to the hazard entry point.

### 5. UI, Mini-Map, Scorecard & Procedural Audio
- **Modern HUD**: Displays Hole #, Par, Distance in Feet and Meters, Current Stroke Count, and Stroke Type Badge ("TEE SHOT", "APPROACH", "PUTT").
- **Canvas Mini-Map**: Overhead hole preview rendering fairway, tee, water hazards, player lie, aiming ray, and basket.
- **Dynamic Wind Widget**: Randomized wind speed (0–20 mph) and rotating compass direction needle.
- **Persistent Scorecard**: Full 9-hole card tracking relative to par (Ace, Eagle, Birdie, Par, Bogey, Double Bogey).
- **End-of-Round Summary**: Complete scorecard recap, PDGA-style rating calculation, and "Play Again" button.
- **Synthesized Web Audio API**:
  - Power-scaled throw whoosh.
  - Realistic multi-voice metallic chain crash & rattle.
  - Tree trunk ricochet knock and bark crack.
  - Grass/dirt impact thuds and skips.
  - Water hazard splash.
  - Victory arpeggios on birdies and aces.

---

## 🕹️ Controls

| Action | Control |
|---|---|
| **Throw Disc (3-Click Meter)** | **Space** or Click **"THROW DISC"** |
| **Toggle Backhand / Forehand** | **H** or Click **"RHBH / RHFH"** |
| **Aim Direction** | **Mouse Drag** / **Touch Swipe** horizontally |
| **Aim Straight at Basket** | **B** or Click **"Aim at Basket"** |
| **Select Disc** | **1** (Putter), **2** (Midrange), **3** (Driver) |
| **Adjust Release Tilt (Hyzer/Anhyzer)** | **Q** / **E** or Slider (-45° to +45°) |
| **Adjust Nose Pitch** | **R** / **F** or Slider (-20° to +30°) |
| **Toggle Camera View** | **C** (Chase Cam / First-Person) |
| **Toggle Scorecard Modal** | **Tab** or Click **"Scorecard"** |

---

## 🚀 Running the Game

Simply open `index.html` in any modern web browser, or run the included Python HTTP server:

```bash
python3 server.py
```
Then navigate to `http://localhost:8080/`.

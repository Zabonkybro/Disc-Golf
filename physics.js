/**
 * Disc Golf Aerodynamics & Physics Engine
 * Implements:
 * - Authentic 4-rating aerodynamics (Speed, Glide, Turn, Fade)
 * - Fluid lift, drag, and gyroscopic precession (RHBH high-speed turn & low-speed fade)
 * - Dynamic wind mechanics with vertical boundary layer, gusts, and crosswind plate lift/drop
 * - Realistic ground physics: Flare Skips, Ground Rollers (curling on rim), Spikes/Tombstones, and Grass Slides
 * - Fast real-time trajectory forecasting for visual aiming
 */

class DiscPhysics {
  constructor(audio) {
    this.audio = audio;

    // Discs in bag with precise rim and flight specs
    this.discs = [
      {
        id: 'putter',
        name: 'Aviar Floater',
        type: 'Putter',
        speed: 2,
        glide: 4,
        turn: 0,
        fade: 1,
        color: 0x10b981, // Emerald Green
        rimWidth: 0.010, // 10mm blunt rim
        thickness: 0.034,
        baseSpeedMps: 20.0,
        dragCoeff: 0.095,
        liftBase: 0.16,
        skipFactor: 0.20, // Low skip, sticks to turf
        description: 'Neutral, floaty approach and putting disc. Holds laser-straight lines.'
      },
      {
        id: 'midrange',
        name: 'Buzzz Precision',
        type: 'Midrange',
        speed: 5,
        glide: 5,
        turn: -1,
        fade: 1,
        color: 0x3b82f6, // Sapphire Blue
        rimWidth: 0.015, // 15mm moderate rim
        thickness: 0.026,
        baseSpeedMps: 26.5,
        dragCoeff: 0.065,
        liftBase: 0.14,
        skipFactor: 0.52, // Moderate forward skip
        description: 'Reliable workhorse for controlled tunnel shots and gentle turnover lines.'
      },
      {
        id: 'driver',
        name: 'Destroyer Pro',
        type: 'Fairway Driver',
        speed: 9,
        glide: 5,
        turn: -1,
        fade: 3,
        color: 0xef4444, // Blaze Red
        rimWidth: 0.022, // 22mm sharp beveled rim
        thickness: 0.019,
        baseSpeedMps: 33.0,
        dragCoeff: 0.048,
        liftBase: 0.12,
        skipFactor: 0.92, // Massive flare skips on hyzer landings!
        description: 'Fast, sharp-rim driver. S-curve distance with hard left finishing hook.'
      }
    ];

    // Physical Constants
    this.GRAVITY = 9.81;
    this.AIR_DENSITY = 1.225; // kg/m^3
    this.DISC_MASS = 0.175;   // 175g tournament weight
    this.DISC_AREA = 0.035;   // 21.2 cm diameter
    this.DISC_RADIUS = 0.106;

    // Active flight state
    this.disc = null;
    this.trail = [];
  }

  getDiscByIndex(index) {
    return this.discs[Math.max(0, Math.min(this.discs.length - 1, index))];
  }

  /**
   * Launch a disc into physical flight
   * @param {Object} discSpec - Active disc definition
   * @param {THREE.Vector3} startPos - Launch position
   * @param {number} aimYaw - Heading in radians (0 = South, PI/2 = West, etc.)
   * @param {number} power - Throw power (0.2 to 1.0)
   * @param {number} hyzerDeg - Release roll angle (-45° to +45°, neg = hyzer, pos = anhyzer)
   * @param {number} noseDeg - Nose pitch angle (-20° to +30°, neg = nose down, pos = nose up)
   * @param {number} accuracyOffset - Accuracy error from 3-click meter (-1 to 1)
   * @param {string} throwStyle - 'backhand' (RHBH, CW spin) or 'forehand' (RHFH, CCW spin)
   */
  launch(discSpec, startPos, aimYaw, power, hyzerDeg, noseDeg, accuracyOffset = 0, throwStyle = 'backhand') {
    const maxSpeed = discSpec.baseSpeedMps * (0.85 + discSpec.speed * 0.022);
    const launchSpeed = maxSpeed * Math.max(0.25, Math.min(1.0, power));

    // Accuracy error adjusts launch heading slightly and adds flutter
    const errorYaw = accuracyOffset * 0.09;
    const effectiveYaw = aimYaw + errorYaw;

    // Launch pitch and roll: clean direct angle without artificial upward bias
    const launchPitch = (noseDeg * 0.7 * Math.PI) / 180;
    const hyzerRad = (hyzerDeg * Math.PI) / 180;

    const fwdX = -Math.sin(effectiveYaw);
    const fwdZ = -Math.cos(effectiveYaw);

    const vx = fwdX * Math.cos(launchPitch) * launchSpeed;
    const vy = Math.sin(launchPitch) * launchSpeed;
    const vz = fwdZ * Math.cos(launchPitch) * launchSpeed;

    // Spin rate in rad/s
    // Backhand (RHBH): Clockwise (spinDir = 1)
    // Forehand (RHFH): Counter-Clockwise (spinDir = -1, slightly lower spin ratio)
    const isForehand = throwStyle === 'forehand';
    const spinDir = isForehand ? -1 : 1;
    const baseSpin = isForehand ? (16 + power * 20) : (20 + power * 22);
    const spinRate = baseSpin * Math.PI * 2 * spinDir;

    this.disc = {
      spec: discSpec,
      throwStyle: throwStyle,
      spinDir: spinDir,
      pos: startPos.clone(),
      vel: new THREE.Vector3(vx, vy, vz),
      prevPos: startPos.clone(),
      roll: hyzerRad,          // Bank angle: negative = Hyzer (tilted left), positive = Anhyzer (tilted right)
      pitch: launchPitch,      // Initial pitch matches launch angle
      yaw: effectiveYaw,
      spin: Math.abs(spinRate),
      wobble: Math.abs(accuracyOffset) * 0.2, // Release flutter if missed center
      flightTime: 0,
      isGrounded: false,
      isRolling: false,        // Ground roller mode!
      rollLean: 0,
      rollHeading: 0,
      rollDuration: 0,
      isSliding: false,        // Ground slide / scoot mode!
      slideDuration: 0,
      isOB: false,
      inChains: false,
      settledInBasket: false,
      skips: 0,
      obEntryPoint: null,
      trailPoints: [startPos.clone()]
    };

    this.trail = [startPos.clone()];

    if (this.audio) {
      this.audio.playWhoosh(power);
    }

    return this.disc;
  }

  /**
   * Calculate effective wind vector at any 3D position (including altitude gradient and gusts)
   */
  getWindAt(pos, baseWindVector, time = 0) {
    const height = Math.max(0.5, pos.y);
    // Boundary layer: wind is slower near ground (z0 ~ 0.2m grass) and stronger aloft
    const heightFactor = Math.min(1.4, Math.max(0.5, Math.log(height / 0.15) / Math.log(10 / 0.15)));

    // Micro-gusts and turbulence
    const gustX = Math.sin(time * 1.8 + pos.x * 0.05) * 0.8 + Math.cos(time * 0.7 + pos.z * 0.04) * 0.5;
    const gustZ = Math.cos(time * 1.5 + pos.z * 0.05) * 0.8 + Math.sin(time * 0.9 + pos.x * 0.04) * 0.5;

    return {
      x: baseWindVector.x * heightFactor + gustX,
      z: baseWindVector.z * heightFactor + gustZ
    };
  }

  /**
   * Predict the flight trajectory ahead of time for visual HUD aiming
   * Returns array of THREE.Vector3 points
   */
  predictTrajectory(discSpec, startPos, aimYaw, power, hyzerDeg, noseDeg, environment, baseWindVector, maxSteps = 160, throwStyle = 'backhand') {
    const points = [];
    const maxSpeed = discSpec.baseSpeedMps * (0.85 + discSpec.speed * 0.022);
    const launchSpeed = maxSpeed * Math.max(0.25, Math.min(1.0, power));

    const launchPitch = (noseDeg * 0.7 * Math.PI) / 180;
    let roll = (hyzerDeg * Math.PI) / 180;
    let pitch = launchPitch;

    const fwdX = -Math.sin(aimYaw);
    const fwdZ = -Math.cos(aimYaw);

    const pos = startPos.clone();
    const vel = new THREE.Vector3(
      fwdX * Math.cos(launchPitch) * launchSpeed,
      Math.sin(launchPitch) * launchSpeed,
      fwdZ * Math.cos(launchPitch) * launchSpeed
    );

    const spinDir = throwStyle === 'forehand' ? -1 : 1;
    // High-resolution substep identical to runtime simulation
    const dt = 0.025;
    const cruiseSpeed = discSpec.baseSpeedMps * 0.65;

    points.push(pos.clone());

    for (let step = 0; step < maxSteps; step++) {
      const wind = this.getWindAt(pos, baseWindVector, step * dt);
      const airVelX = vel.x - wind.x;
      const airVelY = vel.y;
      const airVelZ = vel.z - wind.z;
      const airspeedSq = airVelX * airVelX + airVelY * airVelY + airVelZ * airVelZ;
      const airspeed = Math.sqrt(airspeedSq);

      if (airspeed < 0.2) break;

      const horizSpeed = Math.hypot(airVelX, airVelZ);
      const flightPitch = Math.atan2(airVelY, Math.max(0.01, horizSpeed));
      const aoa = pitch - flightPitch;

      // Aerodynamic Lift & Critical Stall
      const glideMultiplier = 0.9 + discSpec.glide * 0.05;
      let cl = (discSpec.liftBase + aoa * 1.25) * glideMultiplier;
      if (aoa > 0.22) {
        cl = Math.max(0.05, 0.32 - (aoa - 0.22) * 1.5);
      }
      cl = Math.max(-0.25, Math.min(0.34, cl));
      const dynamicPressure = 0.5 * this.AIR_DENSITY * airspeedSq * this.DISC_AREA;
      const liftMagnitude = dynamicPressure * cl;

      const heading = Math.atan2(airVelX, airVelZ);
      const rightX = Math.cos(heading);
      const rightZ = -Math.sin(heading);

      const cosRoll = Math.cos(roll);
      const sinRoll = Math.sin(roll);

      let liftForceY = cosRoll * liftMagnitude;
      const lateralPull = -sinRoll * liftMagnitude * 1.45;
      let liftForceX = rightX * lateralPull;
      let liftForceZ = rightZ * lateralPull;

      // Crosswind flight plate interaction (synchronized with runtime physics)
      const crosswindDot = wind.x * rightX + wind.z * rightZ;
      const plateExposure = crosswindDot * sinRoll;
      if (plateExposure !== 0) {
        liftForceY += plateExposure * 0.15 * dynamicPressure;
      }

      // Bank cutting drag reduces distance and flight time on angled shots
      const bankDrag = 1.0 + 0.8 * (sinRoll * sinRoll);
      const totalCd = (discSpec.dragCoeff * bankDrag) + (cl * cl) * 0.25;
      const dragMagnitude = dynamicPressure * totalCd;
      const dragForceX = -(airVelX / airspeed) * dragMagnitude;
      const dragForceY = -(airVelY / airspeed) * dragMagnitude;
      const dragForceZ = -(airVelZ / airspeed) * dragMagnitude;

      // High-Speed Turn & Low-Speed Fade
      const speedRatio = airspeed / cruiseSpeed;
      if (speedRatio > 1.0) {
        roll += spinDir * (speedRatio - 1.0) * (-discSpec.turn) * 0.09 * dt;
      } else {
        roll -= spinDir * Math.pow(1.0 - speedRatio, 1.3) * (discSpec.fade + 0.5) * 0.35 * dt;
      }

      roll = Math.max(-1.4, Math.min(1.4, roll));
      pitch -= aoa * 0.7 * dt;

      // Accelerations
      const ax = (liftForceX + dragForceX) / this.DISC_MASS;
      const ay = ((liftForceY + dragForceY) / this.DISC_MASS) - this.GRAVITY;
      const az = (liftForceZ + dragForceZ) / this.DISC_MASS;

      vel.x += ax * dt;
      vel.y += ay * dt;
      vel.z += az * dt;

      // Kinetic loss on climb (no infinite loft)
      if (vel.y > 0 && horizSpeed > 1.0) {
        const kineticLoss = (this.GRAVITY * vel.y * dt) / horizSpeed;
        vel.x -= (vel.x / horizSpeed) * kineticLoss;
        vel.z -= (vel.z / horizSpeed) * kineticLoss;
      }

      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;

      points.push(pos.clone());

      // Stop if hitting terrain
      const groundY = environment.getTerrainHeight(pos.x, pos.z);
      if (pos.y <= groundY + 0.05) {
        pos.y = groundY + 0.05;
        points.push(pos.clone());
        break;
      }
    }

    return points;
  }

  /**
   * Main simulation update
   */
  update(deltaTime, environment, baseWindVector = { x: 0, z: 0 }) {
    if (!this.disc || this.disc.isGrounded) return this.disc;

    const subSteps = 4;
    const dt = Math.min(deltaTime, 0.06) / subSteps;

    for (let step = 0; step < subSteps; step++) {
      if (this.disc.isGrounded) break;
      this._subStep(dt, environment, baseWindVector);
    }

    return this.disc;
  }

  _subStep(dt, environment, baseWindVector) {
    const d = this.disc;
    d.flightTime += dt;
    d.prevPos.copy(d.pos);

    // Dynamic wind at disc's current position and time
    const wind = this.getWindAt(d.pos, baseWindVector, d.flightTime);

    // --- State 1: In Basket Chains ---
    if (d.inChains) {
      d.vel.x *= 0.6;
      d.vel.z *= 0.6;
      d.vel.y -= this.GRAVITY * 1.6 * dt;
      d.pos.addScaledVector(d.vel, dt);

      const basket = environment.getCurrentHoleBasket();
      const trayY = basket.position.y + 0.68;
      if (d.pos.y <= trayY) {
        d.pos.y = trayY;
        d.vel.set(0, 0, 0);
        d.isGrounded = true;
        d.settledInBasket = true;
      }
      return;
    }

    // --- State 2: Ground Roller Physics (rolling along terrain on edge) ---
    if (d.isRolling) {
      this._updateRollerPhysics(dt, environment);
      return;
    }

    // --- State 3: Ground Slide / Scoot Physics (skidding along turf before rest) ---
    if (d.isSliding) {
      this._updateSlidePhysics(dt, environment);
      return;
    }

    // --- State 4: Airborne Aerodynamic Flight ---
    // Relative airspeed
    const airVelX = d.vel.x - wind.x;
    const airVelY = d.vel.y;
    const airVelZ = d.vel.z - wind.z;
    const airspeedSq = airVelX * airVelX + airVelY * airVelY + airVelZ * airVelZ;
    const airspeed = Math.sqrt(airspeedSq);

    if (airspeed < 0.2) {
      d.vel.y -= this.GRAVITY * dt;
      d.pos.addScaledVector(d.vel, dt);
      this._checkCollisions(environment);
      return;
    }

    const airDirX = airVelX / airspeed;
    const airDirY = airVelY / airspeed;
    const airDirZ = airVelZ / airspeed;

    // Flight path climb angle
    const horizSpeed = Math.hypot(airVelX, airVelZ);
    const flightPitch = Math.atan2(airVelY, Math.max(0.01, horizSpeed));

    // True Angle of Attack (AoA)
    const aoa = d.pitch - flightPitch;

    // 1. Aerodynamic Lift & Critical Stall
    const glideMultiplier = 0.9 + d.spec.glide * 0.05;
    let cl = (d.spec.liftBase + aoa * 1.25) * glideMultiplier;
    // Beyond critical stall AoA (~12.6° = 0.22 rad), lift drops off sharply
    if (aoa > 0.22) {
      cl = Math.max(0.05, 0.32 - (aoa - 0.22) * 1.5);
    }
    cl = Math.max(-0.25, Math.min(0.34, cl));
    const dynamicPressure = 0.5 * this.AIR_DENSITY * airspeedSq * this.DISC_AREA;
    const liftMagnitude = dynamicPressure * cl;

    // Direction of lateral lift
    const heading = Math.atan2(airVelX, airVelZ);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);

    const cosRoll = Math.cos(d.roll);
    const sinRoll = Math.sin(d.roll);

    // Cutting physics: steep bank turns lift into lateral slicing force
    let liftForceY = cosRoll * liftMagnitude;
    const lateralPull = -sinRoll * liftMagnitude * 1.45;
    let liftForceX = rightX * lateralPull;
    let liftForceZ = rightZ * lateralPull;

    // 2. Crosswind Flight Plate Interaction (Lift Killer / Wind Catch)
    // When a banked disc's top plate faces into a crosswind, the wind pushes down on the disc.
    // When the bottom plate catches crosswind, the wind lifts the disc up!
    const crosswindDot = wind.x * rightX + wind.z * rightZ;
    const plateExposure = crosswindDot * sinRoll;
    if (plateExposure !== 0) {
      const crosswindForce = plateExposure * 0.15 * dynamicPressure;
      liftForceY += crosswindForce;
    }

    // 3. Aerodynamic Drag (Banked cuts create extra edge drag, reducing distance)
    const bankDrag = 1.0 + 0.8 * (sinRoll * sinRoll);
    const totalCd = (d.spec.dragCoeff * bankDrag) + (cl * cl) * 0.25;
    const dragMagnitude = dynamicPressure * totalCd;

    const dragForceX = -airDirX * dragMagnitude;
    const dragForceY = -airDirY * dragMagnitude;
    const dragForceZ = -airDirZ * dragMagnitude;

    // 4. High-Speed Turn & Low-Speed Fade Dynamics (Gyroscopic Precession)
    // Spin rate decays gradually
    d.spin = Math.max(30, d.spin - d.spin * 0.04 * dt);

    const cruiseSpeed = d.spec.baseSpeedMps * 0.65;
    const speedRatio = airspeed / cruiseSpeed;

    const spinDir = d.spinDir !== undefined ? d.spinDir : 1;
    if (speedRatio > 1.0) {
      // High-Speed Turn (RHBH drifts right +, RHFH drifts left -)
      const turnPower = (speedRatio - 1.0) * (-d.spec.turn) * 0.09;
      d.roll += spinDir * turnPower * dt;
    } else {
      // Low-Speed Fade (RHBH hooks left -, RHFH hooks right +)
      const fadeFactor = Math.pow(1.0 - speedRatio, 1.3) * (d.spec.fade + 0.5) * 0.35;
      d.roll -= spinDir * fadeFactor * dt;
    }

    d.roll = Math.max(-1.4, Math.min(1.4, d.roll));
    d.pitch -= aoa * 0.7 * dt;

    // Flutter / wobble decay
    if (d.wobble > 0.005) {
      d.wobble *= 0.94;
    }

    // 5. Total Accelerations
    const accelX = (liftForceX + dragForceX) / this.DISC_MASS;
    const accelY = ((liftForceY + dragForceY) / this.DISC_MASS) - this.GRAVITY;
    const accelZ = (liftForceZ + dragForceZ) / this.DISC_MASS;

    // 6. Integration
    d.vel.x += accelX * dt;
    d.vel.y += accelY * dt;
    d.vel.z += accelZ * dt;

    // Kinetic energy conservation on climb (prevents infinite upward climbing!)
    if (d.vel.y > 0 && horizSpeed > 1.0) {
      const kineticLoss = (this.GRAVITY * d.vel.y * dt) / horizSpeed;
      d.vel.x -= (d.vel.x / horizSpeed) * kineticLoss;
      d.vel.z -= (d.vel.z / horizSpeed) * kineticLoss;
    }

    d.pos.x += d.vel.x * dt;
    d.pos.y += d.vel.y * dt;
    d.pos.z += d.vel.z * dt;

    // Check Mandatory (Mando) Crossing for current hole
    const hole = environment.getCurrentHole ? environment.getCurrentHole() : null;
    if (hole && hole.mando && !d.isMandoMissed) {
      const m = hole.mando;
      const crossedZ = (d.prevPos.z >= m.planeZ && d.pos.z < m.planeZ) ||
                       (d.prevPos.z <= m.planeZ && d.pos.z > m.planeZ);
      if (crossedZ) {
        const t = (m.planeZ - d.prevPos.z) / (d.pos.z - d.prevPos.z || 0.0001);
        const crossX = d.prevPos.x + t * (d.pos.x - d.prevPos.x);

        if (m.passSide === 'left' && crossX > m.x) {
          d.isMandoMissed = true;
          d.mandoDropZone = new THREE.Vector3(m.dropZone.x, environment.getTerrainHeight(m.dropZone.x, m.dropZone.z) + 0.1, m.dropZone.z);
        } else if (m.passSide === 'right' && crossX < m.x) {
          d.isMandoMissed = true;
          d.mandoDropZone = new THREE.Vector3(m.dropZone.x, environment.getTerrainHeight(m.dropZone.x, m.dropZone.z) + 0.1, m.dropZone.z);
        }
      }
    }

    // Record flight trail points
    if (d.trailPoints.length === 0 || d.trailPoints[d.trailPoints.length - 1].distanceTo(d.pos) > 0.4) {
      d.trailPoints.push(d.pos.clone());
      this.trail.push(d.pos.clone());
    }

    // 7. Check Collisions: Basket, Trees, Rocks, Water OB, Terrain
    this._checkCollisions(environment);
  }

  /**
   * Ground roller physics: disc rolling along the grass on its rim
   * Enhanced with obstacle collisions, realistic turf rolling friction, and lean decay so it falls flat
   */
  _updateRollerPhysics(dt, environment) {
    const d = this.disc;
    d.rollDuration += dt;

    const terrainY = environment.getTerrainHeight(d.pos.x, d.pos.z);
    d.pos.y = terrainY + this.DISC_RADIUS;

    // Check Obstacles (Trees & Rocks) while rolling!
    const obstacles = environment.getObstacles();
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dx = d.pos.x - obs.x;
      const dz = d.pos.z - obs.z;
      const distXZ = Math.hypot(dx, dz);
      const hitRadius = (obs.type === 'tree' ? obs.trunkRadius : (obs.type === 'rock' ? obs.radius : 0.6)) + 0.18;
      if (distXZ < hitRadius) {
        d.vel.multiplyScalar(-0.35);
        d.isRolling = false;
        d.rollLean = 0;
        d.roll = 0;
        if (this.audio) {
          if (obs.type === 'tree') this.audio.playTreeHit();
          else this.audio.playGroundHit(false);
        }
        this._startGroundSlide(d.vel.clone().multiplyScalar(0.4), environment);
        return;
      }
    }

    const speed = d.vel.length();

    // Terrain slope influence (gravity pulls downhill)
    const delta = 0.4;
    const hL = environment.getTerrainHeight(d.pos.x - delta, d.pos.z);
    const hR = environment.getTerrainHeight(d.pos.x + delta, d.pos.z);
    const hU = environment.getTerrainHeight(d.pos.x, d.pos.z - delta);
    const hD = environment.getTerrainHeight(d.pos.x, d.pos.z + delta);
    const slopeX = (hR - hL) / (2 * delta);
    const slopeZ = (hD - hU) / (2 * delta);

    d.vel.x -= slopeX * this.GRAVITY * 0.45 * dt;
    d.vel.z -= slopeZ * this.GRAVITY * 0.45 * dt;

    // Substantial Grass & Turf Rolling Friction (increases as speed decreases)
    const baseFriction = 0.62;
    const speedDrag = 0.26 * speed;
    const turfResistance = baseFriction + speedDrag + (0.55 / (speed + 0.35));
    d.vel.multiplyScalar(Math.max(0, 1.0 - turfResistance * dt));

    const currentSpeed = d.vel.length();

    // Roller curls in direction of its lean!
    const heading = Math.atan2(d.vel.x, d.vel.z);
    const curlRate = (d.rollLean < 0 ? -1 : 1) * 2.2 * (1.0 / Math.max(1.2, currentSpeed));
    const newHeading = heading + curlRate * dt;

    d.vel.x = Math.sin(newHeading) * currentSpeed;
    d.vel.z = Math.cos(newHeading) * currentSpeed;

    d.pos.x += d.vel.x * dt;
    d.pos.z += d.vel.z * dt;

    // As the disc rolls, gyroscopic stability decays and the disc leans over progressively towards the grass
    const leanFallRate = 0.35 + (20.0 - Math.min(20.0, currentSpeed)) * 0.05;
    d.rollLean += (d.rollLean > 0 ? 1 : -1) * leanFallRate * dt;

    // Record trail
    if (d.trailPoints.length === 0 || d.trailPoints[d.trailPoints.length - 1].distanceTo(d.pos) > 0.4) {
      d.trailPoints.push(d.pos.clone());
      this.trail.push(d.pos.clone());
    }

    // Disc wobbles, loses balance, and falls flat onto the turf
    // It will NEVER roll forever! It flops flat after ~2.0-3.5s or when leaned over or slowed down.
    if (Math.abs(d.rollLean) >= 1.38 || currentSpeed < 1.2 || d.rollDuration >= 3.6) {
      d.isRolling = false;
      d.rollLean = 0;
      d.roll = 0;
      d.pitch = 0;
      if (this.audio) this.audio.playGroundHit(false);

      // Transition into a short ground slide before coming to a complete rest
      this._startGroundSlide(d.vel.clone().multiplyScalar(0.6), environment);
      return;
    }

    // Check water OB while rolling
    const obZone = environment.checkOB(d.pos.x, d.pos.z);
    if (obZone.isOB) {
      d.isRolling = false;
      d.isGrounded = true;
      d.isOB = true;
      d.vel.set(0, 0, 0);
      d.obEntryPoint = obZone.entryPoint || d.prevPos.clone();
      if (this.audio) this.audio.playWaterSplash();
    }
  }

  /**
   * Ground Slide / Scoot state: when a disc lands on the grass, it scoots forward
   * across the terrain surface with realistic grass friction before settling.
   */
  _startGroundSlide(initialVel, environment) {
    const d = this.disc;
    const tY = environment.getTerrainHeight(d.pos.x, d.pos.z);
    d.pos.y = tY + 0.02;

    const isIce = environment.isIceSurface ? environment.isIceSurface(d.pos.x, d.pos.z) : false;
    const isFrostCourse = environment.currentCourseId === 'frostPeak';
    d.onIce = isIce;

    const initialSpeed = initialVel.length();
    const minSpeed = isIce ? 0.20 : (isFrostCourse ? 0.32 : 0.45);

    if (initialSpeed < minSpeed) {
      d.vel.set(0, 0, 0);
      d.isSliding = false;
      d.isGrounded = true;
      d.roll = 0;
      d.pitch = 0;
      if (this.audio) {
        if (isIce) this.audio.playIceSlide();
        else this.audio.playGroundHit(false);
      }
      return;
    }

    d.isSliding = true;
    d.slideDuration = 0;
    d.vel.copy(initialVel);
    d.vel.y = 0;
    d.roll = 0;
    d.pitch = 0;
    if (this.audio) {
      if (isIce) this.audio.playIceSlide();
      else this.audio.playGroundHit(false);
    }
  }

  _updateSlidePhysics(dt, environment) {
    const d = this.disc;
    d.slideDuration += dt;

    const tY = environment.getTerrainHeight(d.pos.x, d.pos.z);
    d.pos.y = tY + 0.02;

    const isIce = environment.isIceSurface ? environment.isIceSurface(d.pos.x, d.pos.z) : false;
    const isFrostCourse = environment.currentCourseId === 'frostPeak';
    d.onIce = isIce;

    // Check OB while sliding
    const obZone = environment.checkOB(d.pos.x, d.pos.z);
    if (obZone.isOB) {
      d.isSliding = false;
      d.isGrounded = true;
      d.isOB = true;
      d.vel.set(0, 0, 0);
      d.obEntryPoint = obZone.entryPoint || d.prevPos.clone();
      if (this.audio) {
        if (obZone.type === 'water') this.audio.playWaterSplash();
        else this.audio.playGroundHit(false);
      }
      return;
    }

    // Check Obstacles (Trees & Rocks) while sliding
    const obstacles = environment.getObstacles();
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dx = d.pos.x - obs.x;
      const dz = d.pos.z - obs.z;
      const distXZ = Math.hypot(dx, dz);
      const hitRadius = (obs.type === 'tree' ? obs.trunkRadius : (obs.type === 'rock' ? obs.radius : 0.5)) + 0.15;
      if (distXZ < hitRadius) {
        d.vel.set(0, 0, 0);
        d.isSliding = false;
        d.isGrounded = true;
        if (this.audio) {
          if (obs.type === 'tree') this.audio.playTreeHit();
          else this.audio.playGroundHit(false);
        }
        return;
      }
    }

    // Check Basket Tray while sliding
    const basket = environment.getCurrentHoleBasket();
    if (basket) {
      const bPos = basket.position;
      const distXZ = Math.hypot(d.pos.x - bPos.x, d.pos.z - bPos.z);
      if (distXZ <= 0.65 && Math.abs(d.pos.y - (bPos.y + 0.68)) < 0.35) {
        d.pos.y = bPos.y + 0.68;
        d.vel.set(0, 0, 0);
        d.isSliding = false;
        d.isGrounded = true;
        d.settledInBasket = true;
        if (this.audio) this.audio.playChainsCrash(true);
        return;
      }
    }

    const speed = d.vel.length();

    // Terrain slope
    const delta = 0.4;
    const hL = environment.getTerrainHeight(d.pos.x - delta, d.pos.z);
    const hR = environment.getTerrainHeight(d.pos.x + delta, d.pos.z);
    const hU = environment.getTerrainHeight(d.pos.x, d.pos.z - delta);
    const hD = environment.getTerrainHeight(d.pos.x, d.pos.z + delta);
    const slopeX = (hR - hL) / (2 * delta);
    const slopeZ = (hD - hU) / (2 * delta);

    // Slope gravity: on ice or snow slopes, disc accelerates downhill with much higher momentum
    const slopeFactor = isIce ? 0.85 : (isFrostCourse ? 0.55 : 0.35);
    d.vel.x -= slopeX * this.GRAVITY * slopeFactor * dt;
    d.vel.z -= slopeZ * this.GRAVITY * slopeFactor * dt;

    // Sliding friction:
    // Ice: extremely low friction (0.35 + speed * 0.03) -> huge slides and glides!
    // Snow: low friction (1.5 + speed * 0.12)
    // Grass: standard friction (5.2 + speed * 0.38)
    let friction;
    if (isIce) {
      friction = 0.35 + speed * 0.03;
    } else if (isFrostCourse) {
      friction = 1.5 + speed * 0.12;
    } else {
      friction = 5.2 + speed * 0.38;
    }

    const newSpeed = Math.max(0, speed - friction * dt);

    if (speed > 0.01) {
      d.vel.x = (d.vel.x / speed) * newSpeed;
      d.vel.z = (d.vel.z / speed) * newSpeed;
    }

    d.pos.x += d.vel.x * dt;
    d.pos.z += d.vel.z * dt;

    // Trail
    if (d.trailPoints.length === 0 || d.trailPoints[d.trailPoints.length - 1].distanceTo(d.pos) > 0.3) {
      d.trailPoints.push(d.pos.clone());
      this.trail.push(d.pos.clone());
    }

    // Disc comes to a complete rest:
    // On ice, allows slides up to 6.0 seconds; on snow 3.2s; on grass 1.6s
    const maxSlideTime = isIce ? 6.0 : (isFrostCourse ? 3.2 : 1.6);
    const stopSpeed = isIce ? 0.15 : 0.25;

    if (newSpeed < stopSpeed || d.slideDuration > maxSlideTime) {
      d.vel.set(0, 0, 0);
      d.isSliding = false;
      d.isGrounded = true;
    }
  }

  _checkCollisions(environment) {
    const d = this.disc;
    if (!d || d.isGrounded || d.isSliding) return;

    // --- A. Basket & Chains Collision ---
    const basket = environment.getCurrentHoleBasket();
    if (basket) {
      const bPos = basket.position;
      const dx = d.pos.x - bPos.x;
      const dz = d.pos.z - bPos.z;
      const distXZ = Math.hypot(dx, dz);

      const chainBottomY = bPos.y + 0.82;
      const chainTopY = bPos.y + 1.85;
      const chainRadius = 0.58;

      if (distXZ <= chainRadius && d.pos.y >= chainBottomY && d.pos.y <= chainTopY) {
        if (!d.inChains) {
          d.inChains = true;
          if (this.audio) this.audio.playChainsCrash(distXZ < 0.28);
          d.vel.x *= 0.12;
          d.vel.z *= 0.12;
          d.vel.y = -1.9;
          return;
        }
      }

      const poleRadius = 0.12;
      if (distXZ <= poleRadius && d.pos.y >= bPos.y && d.pos.y <= chainTopY + 0.2) {
        if (this.audio) this.audio.playChainsCrash(false);
        d.vel.x = -d.vel.x * 0.35;
        d.vel.z = -d.vel.z * 0.35;
        d.vel.y = -1.2;
        return;
      }

      const trayY = bPos.y + 0.68;
      const trayRadius = 0.65;
      if (distXZ <= trayRadius && Math.abs(d.pos.y - trayY) < 0.25) {
        d.pos.y = trayY;
        d.vel.set(0, 0, 0);
        d.isGrounded = true;
        d.settledInBasket = true;
        if (this.audio) this.audio.playChainsCrash(true);
        return;
      }
    }

    // --- B. Obstacles (Trees, Bushes & Rocks) ---
    const obstacles = environment.getObstacles();
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dx = d.pos.x - obs.x;
      const dz = d.pos.z - obs.z;
      const distXZ = Math.hypot(dx, dz);

      if (obs.type === 'tree') {
        // Solid trunk collision: ricochet & burst falling leaves!
        if (distXZ < (obs.trunkRadius + 0.22) && d.pos.y >= obs.baseY && d.pos.y <= (obs.baseY + obs.trunkHeight)) {
          if (environment && environment.spawnFallingLeaves) {
            environment.spawnFallingLeaves(d.pos.x, d.pos.y, d.pos.z, 36);
          }
          this._handleRicochet(obs.x, obs.z, obs.trunkRadius + 0.25, 'tree');
          return;
        }
        // Leafy canopy / branch interaction: slows down gracefully, rustles & showers leaves
        if (distXZ < obs.canopyRadius && d.pos.y >= (obs.baseY + obs.trunkHeight * 0.6) && d.pos.y <= (obs.baseY + obs.totalHeight)) {
          if (environment && environment.spawnFallingLeaves) {
            environment.spawnFallingLeaves(d.pos.x, d.pos.y, d.pos.z, 18);
          }
          d.vel.x *= 0.84;
          d.vel.z *= 0.84;
          // Downward drag: doesn't drop vertically like a brick, but starts sinking and losing lift
          d.vel.y = Math.min(d.vel.y * 0.75, 0.45) - 0.35;
          d.wobble = Math.min(0.5, d.wobble + 0.15);
          d.spin *= 0.88;
          d.pitch -= 0.06;
          d.roll += (Math.random() - 0.5) * 0.15;
          if (this.audio && Math.random() > 0.5) this.audio.playFoliageRustle();
        }
      } else if (obs.type === 'bush') {
        // Understory bush: brushes through with speed reduction and leafy rustle
        if (distXZ < (obs.radius + 0.22) && d.pos.y >= obs.baseY && d.pos.y <= (obs.baseY + obs.height)) {
          d.vel.x *= 0.86;
          d.vel.z *= 0.86;
          d.vel.y = Math.min(d.vel.y, 0.2) - 0.25;
          d.wobble = Math.min(0.4, d.wobble + 0.12);
          d.spin *= 0.92;
          if (this.audio && Math.random() > 0.5) this.audio.playFoliageRustle();
        }
      } else if (obs.type === 'rock') {
        if (distXZ < (obs.radius + 0.2) && d.pos.y >= obs.baseY && d.pos.y <= (obs.baseY + obs.height)) {
          this._handleRicochet(obs.x, obs.z, obs.radius + 0.25, 'rock');
          return;
        }
      }
    }

    // --- C. Advanced Terrain Surface & Ground Interactions ---
    const terrainHeight = environment.getTerrainHeight(d.pos.x, d.pos.z);
    const discRadiusOffset = 0.05;

    if (d.pos.y <= (terrainHeight + discRadiusOffset)) {
      d.pos.y = terrainHeight + discRadiusOffset;

      // 1. Check Out-Of-Bounds (OB) hazard
      const obZone = environment.checkOB(d.pos.x, d.pos.z);
      if (obZone.isOB) {
        d.isGrounded = true;
        d.isOB = true;
        d.vel.set(0, 0, 0);
        d.obEntryPoint = obZone.entryPoint || d.prevPos.clone();
        if (obZone.type === 'water') {
          if (this.audio) this.audio.playWaterSplash();
        } else {
          if (this.audio) this.audio.playGroundHit(false);
        }
        return;
      }

      // 2. Terrain Normal Vector & Surface Slope
      const delta = 0.4;
      const hL = environment.getTerrainHeight(d.pos.x - delta, d.pos.z);
      const hR = environment.getTerrainHeight(d.pos.x + delta, d.pos.z);
      const hU = environment.getTerrainHeight(d.pos.x, d.pos.z - delta);
      const hD = environment.getTerrainHeight(d.pos.x, d.pos.z + delta);
      const norm = new THREE.Vector3(-(hR - hL) / (2 * delta), 1.0, -(hD - hU) / (2 * delta)).normalize();

      const vn = d.vel.dot(norm);
      const vt = d.vel.clone().sub(norm.clone().multiplyScalar(vn));
      const vtSpeed = vt.length();

      const rollDeg = (d.roll * 180) / Math.PI;
      const absRollDeg = Math.abs(rollDeg);

      // --- Ground Interaction 1: Spike / Tombstone ---
      // Severe nose-dive or extreme bank spike into turf
      if (vn < -6.5 && (d.pitch < -0.45 || absRollDeg > 60)) {
        d.vel.set(0, 0, 0);
        d.isGrounded = true;
        if (this.audio) this.audio.playTombstone();
        return;
      }

      // --- Ground Interaction 2: Flare Skip (Moderate Hyzer/Anhyzer at high speed) ---
      // Beveled driver/mid hitting with speed and bank angle
      if (vtSpeed > 5.5 && absRollDeg >= 14 && absRollDeg <= 55 && vn > -6.0 && d.skips < 3 && d.spec.skipFactor >= 0.4) {
        d.skips++;
        const restitution = 0.42 * d.spec.skipFactor;
        const skipPop = Math.min(3.8, Math.abs(vn) * restitution + vtSpeed * 0.16);

        const heading = Math.atan2(vt.x, vt.z);
        const rightX = Math.cos(heading);
        const rightZ = -Math.sin(heading);
        const lateralKick = (rollDeg < 0 ? -1 : 1) * vtSpeed * 0.36 * d.spec.skipFactor;

        d.vel.x = vt.x * 0.65 + rightX * lateralKick;
        d.vel.z = vt.z * 0.65 + rightZ * lateralKick;
        d.vel.y = skipPop;

        d.roll *= 0.70; // flattens slightly
        d.pitch = Math.max(-0.1, d.pitch * 0.5);

        if (this.audio) this.audio.playFlareSkip(d.spec.skipFactor);
        return;
      }

      // --- Ground Interaction 3: Forward Shallow Skip (Flat fast driver landing) ---
      if (vtSpeed > 9.5 && absRollDeg < 14 && vn > -3.2 && d.skips < 2 && d.spec.skipFactor >= 0.5) {
        d.skips++;
        d.vel.x = vt.x * 0.72;
        d.vel.z = vt.z * 0.72;
        d.vel.y = 0.9 + vtSpeed * 0.10;
        d.pitch = 0.05;

        if (this.audio) this.audio.playFlareSkip(0.5);
        return;
      }

      // --- Ground Interaction 4: Ground Roller (Steep bank landing on rim) ---
      if (absRollDeg > 38 && vtSpeed > 5.0 && d.skips === 0) {
        d.isRolling = true;
        d.rollDuration = 0;
        d.rollLean = d.roll;
        d.rollHeading = Math.atan2(vt.x, vt.z);
        d.vel.copy(vt);
        if (this.audio) this.audio.playGroundHit(true);
        return;
      }

      // --- Ground Interaction 5: Realistic Turf / Snow / Ice Slide & Scoot ---
      const isIce = environment.isIceSurface ? environment.isIceSurface(d.pos.x, d.pos.z) : false;
      const isFrostCourse = environment.currentCourseId === 'frostPeak';
      const slideScalar = isIce ? 0.95 : (isFrostCourse ? 0.88 : 0.78);
      this._startGroundSlide(vt.multiplyScalar(slideScalar), environment);
      return;
    }
  }

  _handleRicochet(obsX, obsZ, safeRadius, type) {
    const d = this.disc;
    const dx = d.pos.x - obsX;
    const dz = d.pos.z - obsZ;
    const dist = Math.max(0.01, Math.hypot(dx, dz));

    const nx = dx / dist;
    const nz = dz / dist;
    const vn = d.vel.x * nx + d.vel.z * nz;

    const restitution = type === 'tree' ? 0.52 : 0.65;
    d.vel.x = (d.vel.x - (1 + restitution) * vn * nx) * 0.78 + (Math.random() - 0.5) * 1.5;
    d.vel.z = (d.vel.z - (1 + restitution) * vn * nz) * 0.78 + (Math.random() - 0.5) * 1.5;

    // Deflects with natural downward decay rather than plunging instantly straight down
    d.vel.y = Math.min(1.2, d.vel.y * 0.45 - 0.35);
    d.spin *= 0.35;
    d.wobble = 0.55;
    d.pitch += (Math.random() - 0.5) * 0.35;
    d.roll += (Math.random() - 0.5) * 0.45;

    d.pos.x = obsX + nx * safeRadius;
    d.pos.z = obsZ + nz * safeRadius;

    if (this.audio) {
      if (type === 'tree') this.audio.playTreeHit();
      else this.audio.playGroundHit(true);
    }
  }
}

window.DiscPhysics = DiscPhysics;

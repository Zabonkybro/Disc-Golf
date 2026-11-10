/**
 * Main 3D Disc Golf Game Controller
 * Features:
 * - Seamless disc orientation with zero angle-swap upon release
 * - Backhand (RHBH) and Forehand (RHFH) throw styles with reversed precession & flick mechanics
 * - Substantial 3D volumetric glowing trajectory tube with landing target bullseye and distance readout
 * - Live in-world 3D disc angle visualizer & attitude gauge
 * - Dynamic wind particle simulation & relative wind HUD indicator
 * - 3-Click throw meter and realistic ground interactions (flare skips, rollers, slides)
 * - Persistent 9-hole scorecard and end-of-round PDGA rating
 */

class DiscGolfGame {
  constructor() {
    this.container = document.getElementById('game-container');

    // Systems
    this.audio = new DiscGolfAudio();
    this.physics = new DiscPhysics(this.audio);
    this.course = null;

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 3D Visual Disc & Preview
    this.discMesh = null;
    this.discShadow = null;
    this.markerMesh = null;
    this.trajectoryMesh = null;
    this.landingTargetGroup = null;
    this.landingCanvas = null;
    this.landingTex = null;
    this.idleTimer = 0;

    // Wind Particle System
    this.windParticles = null;
    this.windParticleCount = 180;
    this.windParticlePositions = null;

    // Player & Camera State
    this.currentLie = new THREE.Vector3(0, 0, 0);
    this.aimYaw = 0; // Radians
    this.cameraMode = 'chase'; // 'chase' or 'firstperson'
    this.cameraDistance = 4.0;
    this.cameraHeight = 1.6;

    // Throw Style: 'backhand' (RHBH) or 'forehand' (RHFH)
    this.throwStyle = 'backhand';

    // Disc Bag State (0: Putter, 1: Midrange, 2: Driver)
    this.selectedDiscIndex = 2; // Default to Fairway Driver on tee

    // Throw Angles
    this.releaseAngle = 0; // -45 to +45 (Hyzer < 0, Anhyzer > 0)
    this.noseAngle = 8;    // -20 to +30 (Pitch elevation)

    // 3-Click Throw Meter State
    this.throwState = 0;   // 0: Idle, 1: Power, 2: Accuracy, 3: Flight
    this.powerVal = 0;
    this.powerLocked = 0.8;
    this.accuracyVal = 0;

    // Game Tracking
    this.currentStroke = 1;
    this.scorecard = new Array(9).fill(null);
    this.isHoleCompleted = false;
    this.roundCompleted = false;

    // Wind System
    this.windSpeedMph = 8;
    this.windAngle = Math.PI * 0.35;
    this.windVector = { x: 0, z: 0 };

    // Input Tracking
    this.isMouseDown = false;
    this.mousePrevX = 0;
    this.mousePrevY = 0;
    this.keysDown = {};

    // Freecam & Hole Preview Drone State
    this.isFreeCam = false;
    this.freeCamPos = new THREE.Vector3();
    this.freeCamYaw = 0;
    this.freeCamPitch = -0.15;
    this.freeCamFlyoverActive = false;
    this.freeCamFlyoverTimer = 0;

    // Advanced Circle 1 & Circle 2 DGPT Statistics
    this.stats = {
      c1InRegHits: 0,
      c1InRegChances: 0,
      c2InRegHits: 0,
      c2InRegChances: 0,
      c1PuttsAttempted: 0,
      c1PuttsMade: 0,
      c2PuttsAttempted: 0,
      c2PuttsMade: 0,
      scrambleChances: 0,
      scrambleSaves: 0
    };
    this.holeStats = new Array(9).fill(null);
    this.currentHoleStats = {
      reachedC1InReg: false,
      reachedC2InReg: false,
      puttsInsideC1: 0,
      puttsInsideC2: 0,
      c1PuttMade: false,
      c2PuttMade: false
    };
    this.lastShotDistToBasket = 999;

    // Mini-map & Hole Preview Canvas & Badges
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.minimapHoleTitle = document.getElementById('minimap-hole-title');
    this.minimapParTag = document.getElementById('minimap-par-tag');
    this.minimapDistBadge = document.getElementById('minimap-dist-badge');
    this.minimapShotTag = document.getElementById('minimap-shot-tag');
    this.minimapElevTag = document.getElementById('minimap-elev-tag');
    this.shotHistory = [];
    this.lastShotOrigin = null;

    // Initialize systems
    this._initThree();
    this._initCourse();
    this._initDiscVisuals();
    this._initTrajectoryVisuals();
    this._initWindParticles();
    this._initInput();
    this._initUI();
    this.startHole(0);

    // Run render loop
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0xa0d8ef, 0.0022);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1200);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);

    // Sun & Sky Lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x445533, 0.7);
    this.hemiLight.position.set(0, 100, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.3);
    this.dirLight.position.set(60, 120, 40);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 400;
    const d = 120;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  applyCourseAtmosphere(courseId) {
    const spec = DiscGolfCourse.COURSES[courseId] || DiscGolfCourse.COURSES.pineValley;
    const atm = spec.atmosphere;

    if (this.scene) {
      this.scene.background.setHex(atm.skyColor);
      if (this.scene.fog) {
        this.scene.fog.color.setHex(atm.fogColor);
        this.scene.fog.density = atm.fogDensity;
      }
    }

    if (this.hemiLight) {
      this.hemiLight.color.setHex(atm.hemiSky);
      this.hemiLight.groundColor.setHex(atm.hemiGround);
    }

    if (this.dirLight) {
      this.dirLight.color.setHex(atm.dirColor);
      this.dirLight.intensity = atm.dirIntensity;
      if (atm.dirPos) {
        this.dirLight.position.set(atm.dirPos[0], atm.dirPos[1], atm.dirPos[2]);
      }
    }

    if (this.renderer) {
      this.renderer.toneMappingExposure = atm.exposure;
    }
  }

  _initCourse() {
    this.course = new DiscGolfCourse(this.scene);
  }

  _initDiscVisuals() {
    // 3D Golf Disc Model
    this.discMesh = this._createDisc3DMesh(this.physics.getDiscByIndex(this.selectedDiscIndex));
    this.discMesh.visible = true;
    this.scene.add(this.discMesh);

    // Ground Shadow Decal
    const shadowGeo = new THREE.CircleGeometry(0.26, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38
    });
    this.discShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.discShadow.visible = true;
    this.scene.add(this.discShadow);

    // Mini Marker Disc on Lie
    const markerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.015, 16);
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    this.markerMesh = new THREE.Mesh(markerGeo, markerMat);
    this.markerMesh.visible = false;
    this.scene.add(this.markerMesh);
  }

  _initTrajectoryVisuals() {
    // Substantial 3D Volumetric Extruded Tube (replaces thin 1-pixel line)
    this.trajectoryMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.15,
      transparent: true,
      opacity: 0.95
    });
    this.trajectoryMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.trajectoryMat);
    this.scene.add(this.trajectoryMesh);

    // Projected Landing Target Bullseye & Placard
    this.landingTargetGroup = new THREE.Group();

    // Outer Target Ring
    const outerRingGeo = new THREE.RingGeometry(1.0, 1.4, 32);
    outerRingGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
    this.landingTargetGroup.add(outerRing);

    // Inner Bullseye Dot
    const dotGeo = new THREE.CircleGeometry(0.38, 24);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const innerDot = new THREE.Mesh(dotGeo, dotMat);
    this.landingTargetGroup.add(innerDot);

    // Floating Distance Billboard Sprite Placard
    this.landingCanvas = document.createElement('canvas');
    this.landingCanvas.width = 256;
    this.landingCanvas.height = 96;
    this.landingTex = new THREE.CanvasTexture(this.landingCanvas);
    const spriteMat = new THREE.SpriteMaterial({ map: this.landingTex, transparent: true });
    this.landingSprite = new THREE.Sprite(spriteMat);
    this.landingSprite.scale.set(3.8, 1.4, 1.0);
    this.landingSprite.position.set(0, 1.3, 0);
    this.landingTargetGroup.add(this.landingSprite);

    this.landingTargetGroup.visible = false;
    this.scene.add(this.landingTargetGroup);
  }

  _createDisc3DMesh(discSpec) {
    const group = new THREE.Group();

    // Flight Plate
    const plateGeo = new THREE.CylinderGeometry(0.20, 0.22, discSpec.thickness, 28);
    const discMat = new THREE.MeshStandardMaterial({
      color: discSpec.color,
      metalness: 0.3,
      roughness: 0.32
    });
    const plate = new THREE.Mesh(plateGeo, discMat);
    plate.castShadow = true;
    group.add(plate);

    // Aerodynamic Rim Bevel
    const rimGeo = new THREE.TorusGeometry(0.21, discSpec.rimWidth * 0.8, 8, 28);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: discSpec.color,
      metalness: 0.4,
      roughness: 0.28
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.castShadow = true;
    group.add(rim);

    // Hot Stamp / Center Flight Emblem
    const stampGeo = new THREE.CircleGeometry(0.12, 16);
    stampGeo.rotateX(-Math.PI / 2);
    const stampMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4
    });
    const stamp = new THREE.Mesh(stampGeo, stampMat);
    stamp.position.y = discSpec.thickness * 0.5 + 0.002;
    group.add(stamp);

    return group;
  }

  _initWindParticles() {
    const count = this.windParticleCount;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 12 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.22,
      transparent: true,
      opacity: 0.65
    });

    this.windParticles = new THREE.Points(geo, mat);
    this.windParticlePositions = positions;
    this.scene.add(this.windParticles);
  }

  _updateWindParticles(delta) {
    if (!this.windParticles) return;
    const pos = this.windParticlePositions;
    const count = this.windParticleCount;

    const wx = this.windVector.x;
    const wz = this.windVector.z;
    const centerX = this.currentLie.x;
    const centerZ = this.currentLie.z;

    for (let i = 0; i < count; i++) {
      let x = pos[i * 3];
      let y = pos[i * 3 + 1];
      let z = pos[i * 3 + 2];

      x += wx * delta;
      z += wz * delta;
      y -= delta * 0.4;

      if (Math.hypot(x - centerX, z - centerZ) > 60 || y < 0.2) {
        x = centerX - wx * 2.5 + (Math.random() - 0.5) * 60;
        z = centerZ - wz * 2.5 + (Math.random() - 0.5) * 60;
        y = Math.random() * 12 + 1.5;
      }

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }

    this.windParticles.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Unified, mathematically robust disc transform applicator
   * Eliminates any 180° flips or angle swaps between ready mode and flight mode
   */
  applyDiscOrientation(mesh, x, y, z, yaw, pitch, roll) {
    mesh.position.set(x, y, z);
    mesh.rotation.order = 'YXZ';
    // pitch: positive tilts nose up, negative tilts nose down
    // yaw: horizontal aim/flight heading (where 0 = South, PI/2 = West)
    // roll: negative tilts left (Hyzer), positive tilts right (Anhyzer)
    mesh.rotation.set(pitch, yaw, -roll);
  }

  startHole(holeIndex) {
    this.course.setHole(holeIndex);
    const hole = this.course.getCurrentHole();

    this.currentStroke = 1;
    this.isHoleCompleted = false;
    this.shotHistory = [];
    this.lastShotOrigin = null;

    if (this.isFreeCam) {
      this.toggleFreeCam();
    }

    this.currentHoleStats = {
      reachedC1InReg: false,
      reachedC2InReg: false,
      puttsInsideC1: 0,
      puttsInsideC2: 0,
      c1PuttMade: false,
      c2PuttMade: false
    };
    this.lastShotDistToBasket = hole.distanceMeters;

    // Position player on concrete tee pad
    const teeY = this.course.getTerrainHeight(hole.tee.x, hole.tee.z);
    this.currentLie.set(hole.tee.x, teeY + 0.1, hole.tee.z);
    this.markerMesh.visible = false;

    // Face toward target basket
    this.aimTowardBasket();

    // Auto-select Disc based on distance
    if (hole.distanceFeet > 320) {
      this.selectDisc(2); // Fairway Driver
    } else if (hole.distanceFeet > 230) {
      this.selectDisc(1); // Midrange
    } else {
      this.selectDisc(0); // Putter
    }

    // Dynamic Wind for this hole (0 to 18 mph)
    this.windSpeedMph = Math.floor(Math.random() * 15) + 3;
    this.windAngle = Math.random() * Math.PI * 2;
    const windSpeedMps = this.windSpeedMph * 0.44704;
    this.windVector.x = Math.cos(this.windAngle) * windSpeedMps;
    this.windVector.z = Math.sin(this.windAngle) * windSpeedMps;

    // Reset throw meter
    this.throwState = 0;
    this.powerVal = 0;
    this.accuracyVal = 0;
    this._updateMeterDisplay();

    this.updateHUD();
    this.updateAttitudeIndicator();
    this.renderMiniMap();
  }

  aimTowardBasket() {
    const hole = this.course.getCurrentHole();
    const dx = hole.basket.x - this.currentLie.x;
    const dz = hole.basket.z - this.currentLie.z;
    this.aimYaw = Math.atan2(-dx, -dz);
    this.updateAttitudeIndicator();
    this.updateHUD();
  }

  toggleThrowStyle() {
    this.throwStyle = this.throwStyle === 'backhand' ? 'forehand' : 'backhand';
    const tag = document.getElementById('style-tag');
    const label = document.getElementById('throw-style-label');
    const btn = document.getElementById('btn-throw-style');

    const isForehand = this.throwStyle === 'forehand';
    if (tag) {
      tag.textContent = isForehand ? 'RHFH' : 'RHBH';
      tag.className = `style-tag ${isForehand ? 'fh' : 'bh'}`;
    }
    if (label) {
      label.textContent = isForehand ? 'Forehand [H]' : 'Backhand [H]';
    }
    if (btn) {
      btn.classList.toggle('forehand-active', isForehand);
    }

    this.audio.playClick();
    this.updateAttitudeIndicator();
  }

  selectDisc(index) {
    this.selectedDiscIndex = Math.max(0, Math.min(2, index));
    const disc = this.physics.getDiscByIndex(this.selectedDiscIndex);

    // Rebuild 3D disc mesh with specific rim profile & color
    if (this.discMesh) {
      this.scene.remove(this.discMesh);
    }
    this.discMesh = this._createDisc3DMesh(disc);
    this.discMesh.visible = true;
    this.scene.add(this.discMesh);

    // Update UI selector buttons
    document.querySelectorAll('.disc-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.selectedDiscIndex);
    });

    // Update Flight Numbers
    document.getElementById('stat-speed').textContent = disc.speed;
    document.getElementById('stat-glide').textContent = disc.glide;
    document.getElementById('stat-turn').textContent = disc.turn;
    document.getElementById('stat-fade').textContent = disc.fade;
    document.getElementById('active-disc-name').textContent = disc.name;
    document.getElementById('active-disc-mold').textContent = disc.type.toUpperCase();

    this.audio.playClick();
    this.updateAttitudeIndicator();
  }

  setReleaseAngle(deg) {
    this.releaseAngle = Math.max(-45, Math.min(45, deg));
    const sliderEl = document.getElementById('slider-hyzer');
    if (sliderEl) sliderEl.value = this.releaseAngle;

    const textEl = document.getElementById('hyzer-val');
    if (textEl) {
      if (this.releaseAngle < -3) textEl.textContent = `${Math.abs(this.releaseAngle)}° HYZER (LEFT BANK)`;
      else if (this.releaseAngle > 3) textEl.textContent = `${this.releaseAngle}° ANHYZER (RIGHT BANK)`;
      else textEl.textContent = '0° FLAT RELEASE';
    }

    this.updateAttitudeIndicator();
  }

  setNoseAngle(deg) {
    this.noseAngle = Math.round(Math.max(-20, Math.min(30, deg)));

    const textEl = document.getElementById('nose-val');
    if (textEl) {
      if (this.noseAngle < 0) textEl.textContent = `${Math.abs(this.noseAngle)}° NOSE DOWN`;
      else if (this.noseAngle > 0) textEl.textContent = `+${this.noseAngle}° NOSE UP`;
      else textEl.textContent = '0° LEVEL NOSE';
    }

    const needleEl = document.getElementById('pitch-needle');
    if (needleEl) {
      const pct = ((this.noseAngle - (-20)) / 50) * 100;
      needleEl.style.left = `${pct}%`;
    }

    this.updateAttitudeIndicator();
  }

  updateAttitudeIndicator() {
    const discIcon = document.getElementById('disc-preview-icon');
    if (discIcon) {
      const rollDeg = this.releaseAngle;
      const nosePx = -(this.noseAngle * 0.8);
      discIcon.style.transform = `translateY(${nosePx}px) rotate(${-rollDeg}deg)`;
    }

    const badgeEl = document.getElementById('flight-type-badge');
    const detailEl = document.getElementById('attitude-detail');
    const isForehand = this.throwStyle === 'forehand';
    const stylePrefix = isForehand ? 'FOREHAND (RHFH)' : 'BACKHAND (RHBH)';

    if (badgeEl) {
      let flightName = 'FLAT STRAIGHT SHOT';
      let badgeClass = 'type-straight';

      if (isForehand) {
        // Forehand: Left bank = Turnover/Flex, Right bank = Hyzer (fades right!)
        if (this.releaseAngle <= -30) {
          flightName = 'FOREHAND ROLLER / HARDOVER';
          badgeClass = 'type-roller';
        } else if (this.releaseAngle < -8) {
          flightName = 'FOREHAND S-CURVE / TURNOVER';
          badgeClass = 'type-anhyzer';
        } else if (this.releaseAngle >= 25) {
          flightName = 'FOREHAND SPIKE HYZER (FADES RIGHT)';
          badgeClass = 'type-hyzer-hard';
        } else if (this.releaseAngle > 8) {
          flightName = 'FOREHAND HYZER (FADES RIGHT)';
          badgeClass = 'type-hyzer';
        }
      } else {
        // Backhand: Left bank = Hyzer (fades left!), Right bank = Turnover
        if (this.releaseAngle <= -30) {
          flightName = 'BACKHAND SPIKE HYZER (FADES LEFT)';
          badgeClass = 'type-hyzer-hard';
        } else if (this.releaseAngle < -8) {
          flightName = 'HYZER FLIP / SWEEPING HYZER';
          badgeClass = 'type-hyzer';
        } else if (this.releaseAngle >= 30) {
          flightName = 'BACKHAND GROUND ROLLER';
          badgeClass = 'type-roller';
        } else if (this.releaseAngle > 8) {
          flightName = 'ANHYZER TURNOVER / S-CURVE';
          badgeClass = 'type-anhyzer';
        }
      }

      badgeEl.textContent = flightName;
      badgeEl.className = `flight-type-badge ${badgeClass}`;
    }

    if (detailEl) {
      const hyzerLabel = this.releaseAngle < 0 ? `${Math.abs(this.releaseAngle)}° Hyzer` : (this.releaseAngle > 0 ? `${this.releaseAngle}° Anhyzer` : 'Flat');
      const noseLabel = this.noseAngle < 0 ? `${Math.abs(this.noseAngle)}° Down` : (this.noseAngle > 0 ? `+${this.noseAngle}° Up` : 'Level');
      detailEl.textContent = `${stylePrefix} • Tilt: ${hyzerLabel} • Nose: ${noseLabel}`;
    }
  }

  executeTapIn() {
    if (this.isFreeCam || this.isHoleCompleted || this.physics.disc) return;
    const hole = this.course.getCurrentHole();
    const basket = hole.basket;
    const basketY = this.course.getTerrainHeight(basket.x, basket.z);

    // Play distinct metallic chain crash
    if (this.audio) this.audio.playChainsCrash(true);

    // Position disc directly inside the basket collection tray
    this.physics.disc = {
      pos: new THREE.Vector3(basket.x, basketY + 0.85, basket.z),
      isGrounded: true,
      settledInBasket: true
    };
    this.discMesh.position.set(basket.x, basketY + 0.85, basket.z);
    this.discMesh.visible = true;
    this.markerMesh.visible = false;

    // Hide tap-in button
    const tapBtn = document.getElementById('btn-tap-in');
    if (tapBtn) tapBtn.classList.add('hidden');

    const distFeet = (Math.hypot(basket.x - this.currentLie.x, basket.z - this.currentLie.z) * 3.28084).toFixed(1);
    this.showToast(`🎯 TAP-IN BIRDIE / PUTT (${distFeet} FT)!`, '#4ade80');

    this.currentStroke++;
    this._completeHole();
  }

  handleClickThrow() {
    if (this.isFreeCam) return;
    if (this.isHoleCompleted) return;
    if (this.physics.disc) return; // Cannot initiate throw while disc is active or transitioning

    // Check tap-in range (within 5 feet / 1.52m)
    const hole = this.course.getCurrentHole();
    const distToBasketFeet = Math.hypot(hole.basket.x - this.currentLie.x, hole.basket.z - this.currentLie.z) * 3.28084;
    if (distToBasketFeet <= 5.0) {
      this.executeTapIn();
      return;
    }

    if (this.throwState === 0) {
      // 1st Click: Start charging power meter
      this.throwState = 1;
      this.powerVal = 0.15;
      this.accuracyVal = 0;
      this.audio.playClick();
    } else if (this.throwState === 1) {
      // 2nd Click: Lock Power! Reverse needle to measure accuracy
      this.throwState = 2;
      this.powerLocked = Math.max(0.25, this.powerVal);
      this.accuracyVal = -1.0;
      this.audio.playClick();
    } else if (this.throwState === 2) {
      // 3rd Click: Lock Accuracy and Launch!
      this.throwState = 3;
      this.audio.playClick();
      this._executeThrow();
    }
  }

  _executeThrow() {
    const discSpec = this.physics.getDiscByIndex(this.selectedDiscIndex);
    const fwdX = -Math.sin(this.aimYaw);
    const fwdZ = -Math.cos(this.aimYaw);
    const rightX = Math.cos(this.aimYaw);
    const rightZ = -Math.sin(this.aimYaw);

    // Initial launch position matches the exact ready disc view
    const sideOffset = this.throwStyle === 'forehand' ? 0.38 : -0.12;
    const launchPos = this.currentLie.clone().add(new THREE.Vector3(
      fwdX * 0.95 + rightX * sideOffset,
      1.35,
      fwdZ * 0.95 + rightZ * sideOffset
    ));

    const accuracyOffset = this.accuracyVal;
    this.lastShotOrigin = this.currentLie.clone();

    // DGPT Circle 1 & 2 putting attempt tracking
    const hole = this.course.getCurrentHole();
    const distToPinBefore = Math.hypot(hole.basket.x - this.currentLie.x, hole.basket.z - this.currentLie.z);
    this.lastShotDistToBasket = distToPinBefore;
    if (distToPinBefore <= 10.0) {
      this.stats.c1PuttsAttempted++;
      if (this.currentHoleStats) this.currentHoleStats.puttsInsideC1++;
    } else if (distToPinBefore <= 20.0) {
      this.stats.c2PuttsAttempted++;
      if (this.currentHoleStats) this.currentHoleStats.puttsInsideC2++;
    }

    this.physics.launch(
      discSpec,
      launchPos,
      this.aimYaw,
      this.powerLocked,
      this.releaseAngle,
      this.noseAngle,
      accuracyOffset,
      this.throwStyle
    );

    this.discMesh.visible = true;
    this.discShadow.visible = true;
    // Keep forecast tube visible as ghost guide during flight so player can see exact flight alignment
    if (this.trajectoryMesh) {
      this.trajectoryMesh.material.opacity = 0.38;
      this.trajectoryMesh.visible = true;
    }
    if (this.landingTargetGroup) {
      this.landingTargetGroup.visible = true;
    }

    // Reset meter display
    setTimeout(() => {
      this.throwState = 0;
      this.powerVal = 0;
      this.accuracyVal = 0;
      this._updateMeterDisplay();
    }, 600);
  }

  _updateMeter(delta) {
    if (this.throwState === 1) {
      this.powerVal += delta * 1.6;
      if (this.powerVal > 1.0) this.powerVal = 1.0;
      this._updateMeterDisplay();
    } else if (this.throwState === 2) {
      this.accuracyVal += delta * 2.8;
      if (this.accuracyVal > 1.0) {
        this.accuracyVal = 1.0;
        this.throwState = 3;
        this._executeThrow();
      }
      this._updateMeterDisplay();
    }
  }

  _updateMeterDisplay() {
    const powerBar = document.getElementById('meter-power-fill');
    const accuracyNeedle = document.getElementById('meter-accuracy-needle');
    const statusText = document.getElementById('meter-status-text');

    if (powerBar) {
      const p = this.throwState === 2 ? this.powerLocked : this.powerVal;
      powerBar.style.width = `${Math.round(p * 100)}%`;
    }

    if (accuracyNeedle) {
      const accPercent = ((this.accuracyVal + 1) / 2) * 100;
      accuracyNeedle.style.left = `${accPercent}%`;
    }

    if (statusText) {
      if (this.throwState === 0) statusText.textContent = "CLICK 'THROW' OR [SPACE] TO START POWER";
      else if (this.throwState === 1) statusText.textContent = "CLICK AGAIN TO LOCK POWER";
      else if (this.throwState === 2) statusText.textContent = "CLICK IN CENTER SWEET SPOT FOR ACCURACY!";
      else statusText.textContent = "DISC IN FLIGHT...";
    }
  }

  _initInput() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.mousePrevX = e.clientX;
      this.mousePrevY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        const dx = e.clientX - this.mousePrevX;
        const dy = e.clientY - this.mousePrevY;
        this.mousePrevX = e.clientX;
        this.mousePrevY = e.clientY;

        if (this.isFreeCam) {
          this.freeCamYaw -= dx * 0.005;
          this.freeCamPitch = Math.max(-1.4, Math.min(1.4, this.freeCamPitch - dy * 0.005));
          return;
        }

        this.aimYaw -= dx * 0.005;
        this.setNoseAngle(this.noseAngle - dy * 0.16);
        this.updateHUD();
      }
    });

    // Touch Support
    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isMouseDown = true;
        this.mousePrevX = e.touches[0].clientX;
        this.mousePrevY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isMouseDown && e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.mousePrevX;
        const dy = e.touches[0].clientY - this.mousePrevY;
        this.mousePrevX = e.touches[0].clientX;
        this.mousePrevY = e.touches[0].clientY;

        if (this.isFreeCam) {
          this.freeCamYaw -= dx * 0.007;
          this.freeCamPitch = Math.max(-1.4, Math.min(1.4, this.freeCamPitch - dy * 0.007));
          return;
        }

        this.aimYaw -= dx * 0.007;
        this.setNoseAngle(this.noseAngle - dy * 0.20);
        this.updateHUD();
      }
    }, { passive: true });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      this.keysDown[e.code] = true;

      if (e.code === 'KeyP' || e.code === 'KeyV') {
        this.toggleFreeCam();
      } else if (e.code === 'Escape') {
        if (this.isFreeCam) {
          this.toggleFreeCam(false);
        } else {
          const courseModal = document.getElementById('modal-course-select');
          if (courseModal && !courseModal.classList.contains('hidden')) {
            this.hideCourseSelectModal();
          } else {
            const scModal = document.getElementById('modal-scorecard');
            if (scModal && !scModal.classList.contains('hidden')) {
              this.toggleScorecard(false);
            }
          }
        }
      } else if (e.code === 'Space' || e.code === 'Enter') {
        if (this.isFreeCam) {
          // Used as altitude up in freecam
          return;
        }
        e.preventDefault();
        const hole = this.course.getCurrentHole();
        const distToBasketFeet = Math.hypot(hole.basket.x - this.currentLie.x, hole.basket.z - this.currentLie.z) * 3.28084;
        if (distToBasketFeet <= 5.0 && !this.isHoleCompleted && !this.physics.disc) {
          this.executeTapIn();
          return;
        }
        this.handleClickThrow();
      } else if (e.code === 'KeyT') {
        const hole = this.course.getCurrentHole();
        const distToBasketFeet = Math.hypot(hole.basket.x - this.currentLie.x, hole.basket.z - this.currentLie.z) * 3.28084;
        if (distToBasketFeet <= 5.0 && !this.isHoleCompleted && !this.physics.disc) {
          this.executeTapIn();
        }
      } else if (e.code === 'KeyH') {
        this.toggleThrowStyle();
      } else if (e.code === 'KeyM') {
        this.toggleCourseSelectModal();
      } else if (e.code === 'Digit1') {
        this.selectDisc(0);
      } else if (e.code === 'Digit2') {
        this.selectDisc(1);
      } else if (e.code === 'Digit3') {
        this.selectDisc(2);
      } else if (e.code === 'KeyQ') {
        this.setReleaseAngle(this.releaseAngle - 5);
      } else if (e.code === 'KeyE') {
        this.setReleaseAngle(this.releaseAngle + 5);
      } else if (e.code === 'KeyR') {
        this.setNoseAngle(this.noseAngle + 3);
      } else if (e.code === 'KeyF') {
        this.setNoseAngle(this.noseAngle - 3);
      } else if (e.code === 'KeyC') {
        this.toggleCameraMode();
      } else if (e.code === 'KeyB') {
        this.aimTowardBasket();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleScorecard();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });
  }

  _initUI() {
    const throwBtn = document.getElementById('btn-throw');
    if (throwBtn) throwBtn.addEventListener('click', () => this.handleClickThrow());

    const tapInBtn = document.getElementById('btn-tap-in');
    if (tapInBtn) tapInBtn.addEventListener('click', () => this.executeTapIn());

    const styleBtn = document.getElementById('btn-throw-style');
    if (styleBtn) styleBtn.addEventListener('click', () => this.toggleThrowStyle());

    const aimBasketBtn = document.getElementById('btn-aim-basket');
    if (aimBasketBtn) aimBasketBtn.addEventListener('click', () => {
      this.aimTowardBasket();
      this.audio.playClick();
    });

    const camBtn = document.getElementById('btn-cam-toggle');
    if (camBtn) camBtn.addEventListener('click', () => this.toggleCameraMode());

    // Hole Preview Drone Free Cam Button
    const freecamBtn = document.getElementById('btn-freecam');
    if (freecamBtn) freecamBtn.addEventListener('click', () => this.toggleFreeCam());

    // Free Cam Preset Jump Buttons
    const fcTee = document.getElementById('fc-btn-tee');
    if (fcTee) fcTee.addEventListener('click', () => this.setFreeCamPreset('tee'));

    const fcFairway = document.getElementById('fc-btn-fairway');
    if (fcFairway) fcFairway.addEventListener('click', () => this.setFreeCamPreset('fairway'));

    const fcBasket = document.getElementById('fc-btn-basket');
    if (fcBasket) fcBasket.addEventListener('click', () => this.setFreeCamPreset('basket'));

    const fcFlyover = document.getElementById('fc-btn-flythrough');
    if (fcFlyover) fcFlyover.addEventListener('click', () => this.startFlyoverTour());

    const fcReturn = document.getElementById('fc-btn-return');
    if (fcReturn) fcReturn.addEventListener('click', () => this.toggleFreeCam(false));

    document.querySelectorAll('.disc-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => this.selectDisc(idx));
    });

    const sliderHyzer = document.getElementById('slider-hyzer');
    if (sliderHyzer) {
      sliderHyzer.addEventListener('input', (e) => this.setReleaseAngle(parseInt(e.target.value)));
    }

    const scorecardBtn = document.getElementById('btn-scorecard');
    const closeScorecardBtn = document.getElementById('btn-close-scorecard');
    if (scorecardBtn) scorecardBtn.addEventListener('click', () => this.toggleScorecard(true));
    if (closeScorecardBtn) closeScorecardBtn.addEventListener('click', () => this.toggleScorecard(false));

    // Course Selection Modal Controls
    const courseBtn = document.getElementById('btn-course-select');
    if (courseBtn) courseBtn.addEventListener('click', () => this.toggleCourseSelectModal());

    const closeCourseBtn = document.getElementById('btn-close-course-select');
    if (closeCourseBtn) closeCourseBtn.addEventListener('click', () => this.hideCourseSelectModal());

    document.querySelectorAll('.select-course-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cId = btn.dataset.course || e.currentTarget.dataset.course;
        if (cId) this.selectCourse(cId);
      });
    });

    const replayBtn = document.getElementById('btn-replay-course');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        this.scorecard = new Array(this.course.holes.length).fill(null);
        this.holeStats = new Array(this.course.holes.length).fill(null);
        this.stats = {
          c1InRegHits: 0,
          c1InRegChances: 0,
          c2InRegHits: 0,
          c2InRegChances: 0,
          c1PuttsAttempted: 0,
          c1PuttsMade: 0,
          c2PuttsAttempted: 0,
          c2PuttsMade: 0,
          scrambleChances: 0,
          scrambleSaves: 0
        };
        this.startHole(0);
      });
    }

    // Open Course Select Menu on initial launch!
    setTimeout(() => {
      this.showCourseSelectModal();
    }, 400);
  }

  toggleCourseSelectModal() {
    const modal = document.getElementById('modal-course-select');
    if (!modal) return;
    if (modal.classList.contains('hidden')) {
      this.showCourseSelectModal();
    } else {
      this.hideCourseSelectModal();
    }
  }

  showCourseSelectModal() {
    const modal = document.getElementById('modal-course-select');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Highlight active course card
    document.querySelectorAll('.course-card').forEach(card => {
      card.classList.toggle('active-card', card.dataset.course === this.course.currentCourseId);
    });
    if (this.audio) this.audio.playClick();
  }

  hideCourseSelectModal() {
    const modal = document.getElementById('modal-course-select');
    if (modal) modal.classList.add('hidden');
    if (this.audio) this.audio.playClick();
  }

  selectCourse(courseId) {
    if (!DiscGolfCourse.COURSES[courseId]) return;

    this.course.loadCourse(courseId);
    this.applyCourseAtmosphere(courseId);

    // Reset scorecard array and tournament stats
    this.scorecard = new Array(this.course.holes.length).fill(null);
    this.holeStats = new Array(this.course.holes.length).fill(null);
    this.stats = {
      c1InRegHits: 0,
      c1InRegChances: 0,
      c2InRegHits: 0,
      c2InRegChances: 0,
      c1PuttsAttempted: 0,
      c1PuttsMade: 0,
      c2PuttsAttempted: 0,
      c2PuttsMade: 0,
      scrambleChances: 0,
      scrambleSaves: 0
    };

    // Update modal active card
    document.querySelectorAll('.course-card').forEach(card => {
      card.classList.toggle('active-card', card.dataset.course === courseId);
    });

    // Update scorecard total par & distance
    const totalParEl = document.getElementById('sc-total-par');
    if (totalParEl) totalParEl.textContent = this.course.totalPar;
    const totalDistEl = document.getElementById('sc-total-dist');
    if (totalDistEl) totalDistEl.textContent = `${this.course.courseSpec.totalDistanceFeet.toLocaleString()} FT`;

    this.hideCourseSelectModal();
    this.startHole(0);

    let msg = '🌲 WELCOME TO PINE VALLEY CHAMPIONSHIP (PAR 30)!';
    let msgColor = '#10b981';
    if (courseId === 'mapleRidge') {
      msg = '🍁 WELCOME TO MAPLE RIDGE AUTUMN GLEN (PAR 31)!';
      msgColor = '#f97316';
    } else if (courseId === 'frostPeak') {
      msg = '❄️ WELCOME TO FROST PEAK SKI RESORT (PAR 31)!';
      msgColor = '#38bdf8';
    }
    this.showToast(msg, msgColor);
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === 'chase' ? 'firstperson' : 'chase';
    const label = document.getElementById('cam-label');
    if (label) label.textContent = this.cameraMode.toUpperCase();
    this.audio.playClick();
  }

  /**
   * Toggle Drone Free Cam / Hole Preview Mode
   */
  toggleFreeCam(forceState) {
    this.isFreeCam = forceState !== undefined ? forceState : !this.isFreeCam;
    const overlay = document.getElementById('freecam-overlay');
    const bottomHud = document.getElementById('bottom-hud');
    const btn = document.getElementById('btn-freecam');

    if (this.isFreeCam) {
      if (overlay) overlay.classList.remove('hidden');
      if (bottomHud) bottomHud.classList.add('hidden');
      if (btn) btn.classList.add('active');

      if (this.trajectoryMesh) this.trajectoryMesh.visible = false;
      if (this.landingTargetGroup) this.landingTargetGroup.visible = false;
      if (this.discMesh) this.discMesh.visible = false;
      if (this.discShadow) this.discShadow.visible = false;

      // Position camera overlooking current lie towards the basket
      const hole = this.course.getCurrentHole();
      this.freeCamPos.set(this.currentLie.x, this.currentLie.y + 4.2, this.currentLie.z);
      this.freeCamYaw = Math.atan2(hole.basket.x - this.currentLie.x, -(hole.basket.z - this.currentLie.z));
      this.freeCamPitch = -0.18;
      this.freeCamFlyoverActive = false;

      this.showToast('🚁 DRONE FREECAM ACTIVE • WASD TO FLY • [P] RETURN TO THROW', '#38bdf8');
    } else {
      if (overlay) overlay.classList.add('hidden');
      if (bottomHud) bottomHud.classList.remove('hidden');
      if (btn) btn.classList.remove('active');

      if (this.discMesh) this.discMesh.visible = true;
      if (this.discShadow) this.discShadow.visible = true;
      this.freeCamFlyoverActive = false;
    }
    this.audio.playClick();
  }

  setFreeCamPreset(preset) {
    this.freeCamFlyoverActive = false;
    const hole = this.course.getCurrentHole();
    const tee = hole.tee;
    const basket = hole.basket;

    if (preset === 'tee') {
      const groundY = this.course.getTerrainHeight(tee.x, tee.z);
      this.freeCamPos.set(tee.x, groundY + 3.2, tee.z);
      this.freeCamYaw = Math.atan2(basket.x - tee.x, -(basket.z - tee.z));
      this.freeCamPitch = -0.10;
      this.showToast('📍 TEE PAD VIEW', '#facc15');
    } else if (preset === 'fairway') {
      const midX = (tee.x + basket.x) * 0.5;
      const midZ = (tee.z + basket.z) * 0.5;
      const groundY = this.course.getTerrainHeight(midX, midZ);
      this.freeCamPos.set(midX, groundY + 16.0, midZ);
      this.freeCamYaw = Math.atan2(basket.x - midX, -(basket.z - midZ));
      this.freeCamPitch = -0.38;
      this.showToast('📍 MID-FAIRWAY AERIAL VIEW', '#facc15');
    } else if (preset === 'basket') {
      const groundY = this.course.getTerrainHeight(basket.x, basket.z);
      this.freeCamPos.set(basket.x - 10, groundY + 5.0, basket.z + 10);
      this.freeCamYaw = Math.atan2(10, -(-10));
      this.freeCamPitch = -0.25;
      this.showToast('📍 TARGET BASKET & GREEN VIEW', '#38bdf8');
    }
    this.audio.playClick();
  }

  startFlyoverTour() {
    this.freeCamFlyoverActive = true;
    this.freeCamFlyoverTimer = 0;
    this.showToast('▶ CINEMATIC FLYOVER TOUR STARTED...', '#facc15');
    this.audio.playClick();
  }

  _updateFlyover(delta) {
    this.freeCamFlyoverTimer += delta;
    const duration = 6.5; // 6.5s tour
    const t = Math.min(1.0, this.freeCamFlyoverTimer / duration);
    const ease = t * t * (3 - 2 * t);

    const hole = this.course.getCurrentHole();
    const tee = hole.tee;
    const basket = hole.basket;
    const dogleg = hole.dogleg || { x: (tee.x + basket.x) * 0.5 + 10, z: (tee.z + basket.z) * 0.5 };

    const inv = 1 - ease;
    const curX = inv * inv * tee.x + 2 * inv * ease * dogleg.x + ease * ease * basket.x;
    const curZ = inv * inv * tee.z + 2 * inv * ease * dogleg.z + ease * ease * basket.z;
    const groundY = this.course.getTerrainHeight(curX, curZ);
    const altitude = groundY + 6.5 + Math.sin(ease * Math.PI) * 11.0;

    this.freeCamPos.set(curX, altitude, curZ);
    this.camera.position.copy(this.freeCamPos);

    // Look slightly ahead towards target basket
    const targetLook = new THREE.Vector3(
      basket.x,
      this.course.getTerrainHeight(basket.x, basket.z) + 1.2,
      basket.z
    );
    this.camera.lookAt(targetLook);

    if (t >= 1.0) {
      this.freeCamFlyoverActive = false;
      this.freeCamYaw = Math.atan2(basket.x - this.freeCamPos.x, -(basket.z - this.freeCamPos.z));
      this.freeCamPitch = -0.22;
      this.showToast('🏁 TOUR COMPLETE • HOVERING OVER GREEN', '#38bdf8');
    }
  }

  _updateFreeCam(delta) {
    if (this.freeCamFlyoverActive) {
      this._updateFlyover(delta);
      return;
    }

    const moveSpeed = (this.keysDown['ShiftLeft'] || this.keysDown['ShiftRight']) ? 52.0 : 25.0;
    const fwdX = Math.sin(this.freeCamYaw);
    const fwdZ = -Math.cos(this.freeCamYaw);
    const rightX = Math.cos(this.freeCamYaw);
    const rightZ = Math.sin(this.freeCamYaw);

    let moveX = 0;
    let moveZ = 0;
    let moveY = 0;

    if (this.keysDown['KeyW'] || this.keysDown['ArrowUp']) {
      moveX += fwdX;
      moveZ += fwdZ;
    }
    if (this.keysDown['KeyS'] || this.keysDown['ArrowDown']) {
      moveX -= fwdX;
      moveZ -= fwdZ;
    }
    if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft']) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (this.keysDown['KeyD'] || this.keysDown['ArrowRight']) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (this.keysDown['KeyE'] || this.keysDown['Space']) {
      moveY += 1.0;
    }
    if (this.keysDown['KeyQ'] || this.keysDown['ControlLeft']) {
      moveY -= 1.0;
    }

    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      this.freeCamPos.x += (moveX / len) * moveSpeed * delta;
      this.freeCamPos.z += (moveZ / len) * moveSpeed * delta;
    }
    this.freeCamPos.y += moveY * moveSpeed * delta;

    // Minimum altitude clamp above terrain
    const groundY = this.course.getTerrainHeight(this.freeCamPos.x, this.freeCamPos.z);
    this.freeCamPos.y = Math.max(groundY + 1.2, Math.min(130.0, this.freeCamPos.y));

    // Update camera transform
    this.camera.position.copy(this.freeCamPos);
    const lookDir = new THREE.Vector3(
      Math.sin(this.freeCamYaw) * Math.cos(this.freeCamPitch),
      Math.sin(this.freeCamPitch),
      -Math.cos(this.freeCamYaw) * Math.cos(this.freeCamPitch)
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  toggleScorecard(forceShow) {
    const modal = document.getElementById('modal-scorecard');
    if (!modal) return;
    const isVisible = !modal.classList.contains('hidden');
    const show = forceShow !== undefined ? forceShow : !isVisible;

    if (show) {
      this.populateScorecardModal();
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
    this.audio.playClick();
  }

  populateScorecardModal() {
    const tbody = document.getElementById('scorecard-body');
    const totalStrokesEl = document.getElementById('sc-total-strokes');
    const totalParEl = document.getElementById('sc-total-par');
    const totalDiffEl = document.getElementById('sc-total-diff');

    if (!tbody) return;

    // Update Circle 1 & 2 Live Tournament Stats Summary Row
    const c1rPct = this.stats.c1InRegChances > 0 ? Math.round((this.stats.c1InRegHits / this.stats.c1InRegChances) * 100) : 0;
    const c2rPct = this.stats.c2InRegChances > 0 ? Math.round((this.stats.c2InRegHits / this.stats.c2InRegChances) * 100) : 0;
    const c1xPct = this.stats.c1PuttsAttempted > 0 ? Math.round((this.stats.c1PuttsMade / this.stats.c1PuttsAttempted) * 100) : 0;
    const scramblePct = this.stats.scrambleChances > 0 ? Math.round((this.stats.scrambleSaves / this.stats.scrambleChances) * 100) : 0;

    const elC1R = document.getElementById('sc-stat-c1r');
    if (elC1R) elC1R.textContent = `${c1rPct}% (${this.stats.c1InRegHits}/${this.stats.c1InRegChances})`;
    const elC2R = document.getElementById('sc-stat-c2r');
    if (elC2R) elC2R.textContent = `${c2rPct}% (${this.stats.c2InRegHits}/${this.stats.c2InRegChances})`;
    const elC1X = document.getElementById('sc-stat-c1x');
    if (elC1X) elC1X.textContent = `${c1xPct}% (${this.stats.c1PuttsMade}/${this.stats.c1PuttsAttempted})`;
    const elC2P = document.getElementById('sc-stat-c2p');
    if (elC2P) elC2P.textContent = `${this.stats.c2PuttsMade}`;
    const elScr = document.getElementById('sc-stat-scramble');
    if (elScr) elScr.textContent = `${scramblePct}% (${this.stats.scrambleSaves}/${this.stats.scrambleChances})`;

    let rowsHtml = '';
    let completedStrokes = 0;
    let completedPar = 0;
    let totalCoursePar = 0;
    let completedCount = 0;

    this.course.holes.forEach((hole, idx) => {
      totalCoursePar += hole.par;
      const score = this.scorecard[idx];

      let scoreText = '-';
      let badgeClass = 'par-score';
      let term = '';

      if (score !== null) {
        completedStrokes += score;
        completedPar += hole.par;
        completedCount++;

        scoreText = score;
        const diff = score - hole.par;
        if (score === 1) { badgeClass = 'ace-score'; term = 'ACE!'; }
        else if (diff <= -2) { badgeClass = 'eagle-score'; term = 'Eagle'; }
        else if (diff === -1) { badgeClass = 'birdie-score'; term = 'Birdie'; }
        else if (diff === 0) { badgeClass = 'par-score'; term = 'Par'; }
        else if (diff === 1) { badgeClass = 'bogey-score'; term = 'Bogey'; }
        else { badgeClass = 'double-bogey'; term = `+${diff}`; }
      } else if (idx === this.course.currentHoleIndex) {
        // Active in-play hole
        scoreText = `${this.currentStroke}`;
        term = '(In Play)';
        badgeClass = 'in-progress-score';
      }

      // Green regulation badge (C1R, C2R, Scramble)
      let greenBadge = '-';
      const hStat = this.holeStats[idx];
      if (hStat) {
        if (hStat.reachedC1InReg) greenBadge = `<span class="badge-c1r">C1R</span>`;
        else if (hStat.reachedC2InReg) greenBadge = `<span class="badge-c2r">C2R</span>`;
        else greenBadge = `<span class="badge-scramble">Scramble</span>`;
      }

      const activeRow = idx === this.course.currentHoleIndex ? 'active-row' : '';

      rowsHtml += `
        <tr class="${activeRow}">
          <td><b>#${hole.number}</b></td>
          <td>${hole.name}</td>
          <td>${hole.distanceFeet} ft</td>
          <td>${hole.par}</td>
          <td>${greenBadge}</td>
          <td><span class="sc-badge ${badgeClass}">${scoreText} ${term}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;

    // Accurate tournament scoring: Compare completed holes against par of those completed holes
    if (completedCount > 0) {
      const diff = completedStrokes - completedPar;
      const diffText = diff > 0 ? `+${diff}` : (diff < 0 ? `${diff}` : 'E');
      if (totalStrokesEl) totalStrokesEl.textContent = completedStrokes;
      if (totalParEl) totalParEl.textContent = completedCount === this.course.holes.length ? `${totalCoursePar}` : `${completedPar} (Thru ${completedCount})`;
      if (totalDiffEl) {
        totalDiffEl.textContent = diffText;
        totalDiffEl.className = diff < 0 ? 'score-under' : (diff > 0 ? 'score-over' : 'score-even');
      }
    } else {
      if (totalStrokesEl) totalStrokesEl.textContent = '0';
      if (totalParEl) totalParEl.textContent = `${totalCoursePar}`;
      if (totalDiffEl) {
        totalDiffEl.textContent = 'E';
        totalDiffEl.className = 'score-even';
      }
    }
  }

  updateHUD() {
    const hole = this.course.getCurrentHole();
    const basket = this.course.getCurrentHoleBasket();

    // Distance to basket
    const dx = basket.position.x - this.currentLie.x;
    const dz = basket.position.z - this.currentLie.z;
    const distMeters = Math.hypot(dx, dz);
    const distFeet = Math.round(distMeters * 3.28084);

    document.getElementById('hud-hole-num').textContent = hole.number;
    document.getElementById('hud-hole-name').textContent = hole.name;
    document.getElementById('hud-par').textContent = hole.par;
    document.getElementById('hud-dist-ft').textContent = distFeet;
    document.getElementById('hud-dist-m').textContent = Math.round(distMeters);
    document.getElementById('hud-strokes').textContent = this.currentStroke;

    const badgeEl = document.getElementById('stroke-badge');
    if (badgeEl) {
      if (this.currentStroke === 1) badgeEl.textContent = 'TEE SHOT';
      else if (distMeters <= 10.0) badgeEl.textContent = 'C1 PUTT';
      else if (distMeters <= 20.0) badgeEl.textContent = 'C2 PUTT';
      else badgeEl.textContent = 'APPROACH';
    }

    const circleBadgeEl = document.getElementById('hud-circle-badge');
    if (circleBadgeEl) {
      if (distMeters <= 10.0) {
        circleBadgeEl.className = 'circle-badge in-c1';
        circleBadgeEl.textContent = `🎯 CIRCLE 1 (${distFeet} FT) • PUTT`;
      } else if (distMeters <= 20.0) {
        circleBadgeEl.className = 'circle-badge in-c2';
        circleBadgeEl.textContent = `🎯 CIRCLE 2 (${distFeet} FT) • JUMP PUTT`;
      } else if (this.currentStroke === 1) {
        circleBadgeEl.className = 'circle-badge on-tee';
        circleBadgeEl.textContent = `⛳ TEE PAD`;
      } else {
        circleBadgeEl.className = 'circle-badge in-fairway';
        circleBadgeEl.textContent = `FAIRWAY (${distFeet} FT)`;
      }
    }

    // Dynamic Wind Indicator & Relative Wind Direction
    const windSpeedEl = document.getElementById('wind-speed');
    const windArrowEl = document.getElementById('wind-arrow');
    const windRelEl = document.getElementById('wind-relation');

    if (windSpeedEl) windSpeedEl.textContent = `${this.windSpeedMph} MPH`;

    const relWindAngle = this.windAngle - this.aimYaw;
    if (windArrowEl) {
      const deg = (relWindAngle * 180) / Math.PI;
      windArrowEl.style.transform = `rotate(${deg}deg)`;
    }

    if (windRelEl) {
      const cosRel = Math.cos(relWindAngle);
      const sinRel = Math.sin(relWindAngle);

      let relText = "CROSSWIND";
      if (cosRel > 0.6) relText = "HEADWIND (More Turn)";
      else if (cosRel < -0.6) relText = "TAILWIND (Earlier Fade)";
      else if (sinRel > 0.3) relText = "CROSSWIND (Pushes Right)";
      else if (sinRel < -0.3) relText = "CROSSWIND (Pushes Left)";

      windRelEl.textContent = relText;
    }

    // Tap-In Quick Action Button (<= 5.0 feet / 1.52m)
    const tapInBtn = document.getElementById('btn-tap-in');
    if (tapInBtn) {
      const distFeetExact = distMeters * 3.28084;
      if (distFeetExact <= 5.0 && !this.isHoleCompleted && !this.physics.disc) {
        tapInBtn.classList.remove('hidden');
        tapInBtn.innerHTML = `<span>🎯 TAP IN PUTT (${distFeetExact.toFixed(1)} FT)</span><kbd>SPACE / ENTER / T</kbd>`;
      } else {
        tapInBtn.classList.add('hidden');
      }
    }

    // Mandatory (Mando) Warning Badge
    const mandoBadge = document.getElementById('hud-mando-badge');
    if (mandoBadge) {
      if (hole.mando) {
        mandoBadge.classList.remove('hidden');
        mandoBadge.textContent = `⚠️ MANDO: PASS ${hole.mando.passSide.toUpperCase()}`;
      } else {
        mandoBadge.classList.add('hidden');
      }
    }
  }

  renderMiniMap() {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const hole = this.course.getCurrentHole();
    const tee = hole.tee;
    const basket = hole.basket;

    // Calculate current live distance to pin
    const distToBasketMeters = Math.hypot(basket.x - this.currentLie.x, basket.z - this.currentLie.z);
    const distToBasketFeet = Math.round(distToBasketMeters * 3.28084);
    const totalHoleFeet = Math.round(Math.hypot(basket.x - tee.x, basket.z - tee.z) * 3.28084);

    // Update HTML info badges
    if (this.minimapHoleTitle) this.minimapHoleTitle.textContent = `HOLE ${hole.number} PREVIEW`;
    if (this.minimapParTag) this.minimapParTag.textContent = `PAR ${hole.par}`;
    if (this.minimapDistBadge) this.minimapDistBadge.textContent = `📍 ${distToBasketFeet} FT TO BASKET`;
    if (this.minimapShotTag) {
      const shotLabel = this.currentStroke === 1 ? 'TEE PAD' : `LIE (SHOT ${this.currentStroke})`;
      this.minimapShotTag.textContent = `SHOT ${this.currentStroke} • ${shotLabel}`;
    }
    if (this.minimapElevTag) {
      const elevDiff = Math.round((basket.y - this.currentLie.y) * 3.28084);
      if (elevDiff > 2) this.minimapElevTag.textContent = `▲ +${elevDiff} FT`;
      else if (elevDiff < -2) this.minimapElevTag.textContent = `▼ ${elevDiff} FT`;
      else this.minimapElevTag.textContent = `FLAT`;
    }

    // Dynamic map bounds enclosing tee, basket, current lie and previous shots
    let minX = Math.min(tee.x, basket.x, this.currentLie.x);
    let maxX = Math.max(tee.x, basket.x, this.currentLie.x);
    let minZ = Math.min(tee.z, basket.z, this.currentLie.z);
    let maxZ = Math.max(tee.z, basket.z, this.currentLie.z);

    if (this.shotHistory && this.shotHistory.length > 0) {
      this.shotHistory.forEach(s => {
        minX = Math.min(minX, s.to.x);
        maxX = Math.max(maxX, s.to.x);
        minZ = Math.min(minZ, s.to.z);
        maxZ = Math.max(maxZ, s.to.z);
      });
    }

    // Add margins
    minX -= 28;
    maxX += 28;
    minZ -= 28;
    maxZ += 28;

    const spanX = Math.max(45, maxX - minX);
    const spanZ = Math.max(45, maxZ - minZ);
    const padding = 18;
    const scale = Math.min((w - padding * 2) / spanX, (h - padding * 2) / spanZ);

    const toMapX = (worldX) => (worldX - minX) * scale + padding;
    const toMapY = (worldZ) => (worldZ - minZ) * scale + padding;

    // 1. Terrain Background with subtle grid texture
    const theme = this.course && this.course.courseSpec ? this.course.courseSpec.theme : 'standard';
    if (theme === 'freezing') {
      ctx.fillStyle = '#0f172a'; // Deep winter mountain slate
    } else if (theme === 'autumn') {
      ctx.fillStyle = '#221510'; // Warm autumnal forest floor
    } else {
      ctx.fillStyle = '#112918'; // Summer pine forest
    }
    ctx.fillRect(0, 0, w, h);

    // Subtle distance grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 28) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 28) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // 2. Concentric Distance Arcs radiating from Basket (100', 200', 300', 400')
    const ringDists = [100, 200, 300, 400];
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ringDists.forEach(rf => {
      const rMeters = rf / 3.28084;
      const rPixels = rMeters * scale;
      if (rPixels > 8 && rPixels < Math.max(w, h) * 1.2) {
        ctx.beginPath();
        ctx.arc(toMapX(basket.x), toMapY(basket.z), rPixels, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(250, 204, 21, 0.6)';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${rf}'`, toMapX(basket.x), toMapY(basket.z) - rPixels + 9);
      }
    });
    ctx.setLineDash([]);

    // 3. Fairway Corridor
    const tX = toMapX(tee.x);
    const tY = toMapY(tee.z);
    const bX = toMapX(basket.x);
    const bY = toMapY(basket.z);

    // Outer Fairway
    if (theme === 'freezing') {
      ctx.strokeStyle = '#334155';
    } else if (theme === 'autumn') {
      ctx.strokeStyle = '#5c3a21';
    } else {
      ctx.strokeStyle = '#2d6a4f';
    }
    ctx.lineWidth = Math.max(16, hole.fairwayWidth * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tX, tY);
    ctx.lineTo(bX, bY);
    ctx.stroke();

    // Inner Fairway Stripe
    if (theme === 'freezing') {
      ctx.strokeStyle = '#475569';
    } else if (theme === 'autumn') {
      ctx.strokeStyle = '#854d0e';
    } else {
      ctx.strokeStyle = '#388e3c';
    }
    ctx.beginPath();
    ctx.moveTo(tX, tY);
    ctx.lineTo(bX, bY);
    ctx.stroke();

    // 4. Ice Sheets (Freezing Ski Resort Course)
    if (theme === 'freezing') {
      const iceSheets = [
        { x: -12, z: -298, w: 75, d: 75, name: 'ICE RAVINE' },
        { x: 78, z: -578, w: 55, d: 75, name: 'FROZEN LAKE' },
        { x: 40, z: -680, w: 40, d: 50, name: 'ICE POND' },
        { x: -48, z: -912, w: 55, d: 105, name: 'GLACIER' },
        { x: -32, z: -1132, w: 45, d: 65, name: 'ICE RINK' }
      ];
      iceSheets.forEach(sheet => {
        const sx = toMapX(sheet.x - sheet.w / 2);
        const sy = toMapY(sheet.z - sheet.d / 2);
        const sw = sheet.w * scale;
        const sh = sheet.d * scale;
        if (sx + sw >= 0 && sx <= w && sy + sh >= 0 && sy <= h) {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
          ctx.fillRect(sx, sy, sw, sh);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, sy, sw, sh);
          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 7.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`❄️ ${sheet.name}`, sx + sw * 0.5, sy + sh * 0.5 + 3);
        }
      });
    }

    // 4b. Mandatory (Mando) Hazard & Drop Zone
    if (hole.mando) {
      const m = hole.mando;
      const mX = toMapX(m.x);
      const mY = toMapY(m.planeZ);

      // Draw dashed red line for the forbidden / restricted plane
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (m.passSide === 'left') {
        // Must pass LEFT of tower, so right side is restricted
        ctx.moveTo(mX, mY);
        ctx.lineTo(toMapX(m.x + 36), mY);
      } else {
        ctx.moveTo(mX, mY);
        ctx.lineTo(toMapX(m.x - 36), mY);
      }
      ctx.stroke();

      // Mando Tower marker
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(mX, mY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      const arrowLabel = m.passSide === 'left' ? '⬅ MANDO' : 'MANDO ➡';
      ctx.fillText(arrowLabel, mX, mY - 8);

      // Drop Zone (DZ) Marker
      if (m.dropZone) {
        const dzX = toMapX(m.dropZone.x);
        const dzY = toMapY(m.dropZone.z);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(dzX - 4, dzY - 4, 8, 8);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.strokeRect(dzX - 4, dzY - 4, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DZ', dzX, dzY + 11);
      }
      ctx.setLineDash([]);
    }

    // 4. Water Hazards (Holes 6 Island & Pond) & Out of Bounds Lines
    if (hole.hasWaterOB) {
      // Shoreline Hazard Border (Red/White Dashed OB Line)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(toMapX(hole.waterCenter.x), toMapY(hole.waterCenter.z), (hole.waterRadius + 1.2) * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Water Body
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(toMapX(hole.waterCenter.x), toMapY(hole.waterCenter.z), hole.waterRadius * scale, 0, Math.PI * 2);
      ctx.fill();

      // Island Green (Safe Landing Zone)
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(toMapX(hole.islandCenter.x), toMapY(hole.islandCenter.z), hole.islandRadius * scale, 0, Math.PI * 2);
      ctx.fill();

      // Island Perimeter Chalk Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(toMapX(hole.islandCenter.x), toMapY(hole.islandCenter.z), hole.islandRadius * scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ISLAND GREEN', toMapX(hole.islandCenter.x), toMapY(hole.islandCenter.z) + 3);
      ctx.setLineDash([]);
    }

    // Hole 9 Paved Path OB Boundary Lines
    if (hole.hasPathOB) {
      const py = toMapY(hole.pathZ);
      const px1 = toMapX(-55);
      const px2 = toMapX(35);

      // Paved road body
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px1, py - 2.0 * scale, px2 - px1, 4.0 * scale);

      // Red/white dashed hazard lines
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px1, py - 2.15 * scale); ctx.lineTo(px2, py - 2.15 * scale);
      ctx.moveTo(px1, py + 2.15 * scale); ctx.lineTo(px2, py + 2.15 * scale);
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OB PATH HAZARD', (px1 + px2) * 0.5, py - 4);
      ctx.setLineDash([]);
    }

    // 5. Stylized Tree Stand Foliage Icons
    const obstacles = this.course.getObstacles();
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const ox = toMapX(obs.x);
      const oy = toMapY(obs.z);
      if (ox >= 0 && ox <= w && oy >= 0 && oy <= h) {
        if (obs.type === 'tree') {
          ctx.fillStyle = 'rgba(27, 67, 50, 0.7)';
          ctx.beginPath();
          ctx.arc(ox, oy, Math.max(3.5, obs.canopyRadius * scale * 0.55), 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === 'rock') {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.8)';
          ctx.fillRect(ox - 2.5, oy - 2.5, 5, 5);
        }
      }
    }

    // 6. Previous Shot History Trails & Badges
    if (this.shotHistory && this.shotHistory.length > 0) {
      this.shotHistory.forEach(shot => {
        const sx1 = toMapX(shot.from.x);
        const sy1 = toMapY(shot.from.z);
        const sx2 = toMapX(shot.to.x);
        const sy2 = toMapY(shot.to.z);

        // Dashed flight path
        ctx.strokeStyle = shot.isOB ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        // Past landing dot
        ctx.fillStyle = shot.isOB ? '#ef4444' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(sx2, sy2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Shot Distance Badge
        const midX = (sx1 + sx2) * 0.5;
        const midY = (sy1 + sy2) * 0.5;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(midX - 22, midY - 7, 44, 14);
        ctx.strokeStyle = shot.isOB ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - 22, midY - 7, 44, 14);

        ctx.fillStyle = shot.isOB ? '#fca5a5' : '#7dd3fc';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`S${shot.shotNum}: ${shot.throwDist}'`, midX, midY + 4);
      });
      ctx.setLineDash([]);
    }

    // 7. Tee Pad
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(tX - 5, tY - 5, 10, 10);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tX - 5, tY - 5, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TEE', tX, tY - 7);

    // 8. Circle 1 & Circle 2 Green Boundaries around Target Basket
    // Circle 2 (20m / 66 ft)
    const rC2 = 20.0 * scale;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(bX, bY, rC2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText("C2 (66')", bX + rC2 + 2, bY + 3);

    // Circle 1 (10m / 33 ft)
    const rC1 = 10.0 * scale;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.arc(bX, bY, rC1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText("C1 (33')", bX + rC1 + 2, bY + 3);
    ctx.setLineDash([]);

    // Target Basket Pin Dot
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(bX, bY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Red flag on basket
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(bX, bY);
    ctx.lineTo(bX + 7, bY - 4);
    ctx.lineTo(bX, bY - 8);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`PIN (${hole.distanceFeet}')`, bX, bY + 14);

    // 9. Current Lie Position with Pulsing Target Beacon
    const lX = toMapX(this.currentLie.x);
    const lY = toMapY(this.currentLie.z);

    // Pulsing outer beacon
    const pulseR = 8 + Math.sin(this.idleTimer * 6) * 3;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lX, lY, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    // Lie Center Dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(lX, lY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Live Lie Distance Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(lX - 36, lY - 24, 72, 16);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(lX - 36, lY - 24, 72, 16);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 ${distToBasketFeet} FT TO PIN`, lX, lY - 12);

    // 10. Aim Heading Ray
    const aimLength = 32;
    const aimX = this.currentLie.x - Math.sin(this.aimYaw) * aimLength;
    const aimZ = this.currentLie.z - Math.cos(this.aimYaw) * aimLength;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(lX, lY);
    ctx.lineTo(toMapX(aimX), toMapY(aimZ));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _animate() {
    requestAnimationFrame(this._animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.idleTimer += delta;

    // Update 3-Click Meter
    this._updateMeter(delta);

    // Update Wind Particles
    this._updateWindParticles(delta);

    // Update Falling Leaves Simulation (fluttering descent & ambient autumn breeze)
    if (this.course && this.course.updateLeaves) {
      this.course.updateLeaves(delta, this.windVector, this.camera ? this.camera.position : null);
    }

    // Render live detailed Hole Preview & Mini-Map
    this.renderMiniMap();

    // Animate Basket Wind Pennant Flags
    if (this.course && this.course.baskets) {
      for (let i = 0; i < this.course.baskets.length; i++) {
        const basket = this.course.baskets[i];
        const pennant = basket.getObjectByName('pennantFlag');
        if (pennant) {
          pennant.rotation.y = this.windAngle;
          pennant.rotation.z = Math.sin(this.idleTimer * 7.5 + i * 1.5) * (0.08 + this.windSpeedMph * 0.015);
        }
      }
    }

    // Update Flying Disc Physics
    const disc = this.physics.update(delta, this.course, this.windVector);

    if (disc) {
      if (!disc.isGrounded) {
        // --- 1. Disc in Flight or Rolling ---
        this.discMesh.visible = true;

        if (disc.isRolling) {
          // Disc is rolling along terrain on its rim!
          const rollHeading = Math.atan2(-disc.vel.x, -disc.vel.z);
          this.discMesh.position.copy(disc.pos);
          this.discMesh.rotation.order = 'YXZ';
          this.discMesh.rotation.set(0, rollHeading, disc.rollLean + Math.PI / 2);
          if (!disc._rollerToastShown) {
            disc._rollerToastShown = true;
            this.showToast('🌀 GROUND ROLLER (CURLING ON RIM)', '#38bdf8');
          }
        } else if (disc.isSliding) {
          // Disc is scooting / sliding along the turf before settling!
          const slideHeading = Math.atan2(-disc.vel.x, -disc.vel.z);
          this.discMesh.position.copy(disc.pos);
          this.discMesh.rotation.order = 'YXZ';
          this.discMesh.rotation.set(0, slideHeading, 0);
        } else {
          // Seamless flight orientation: matches launch preview exactly!
          const currentYaw = Math.atan2(-disc.vel.x, -disc.vel.z);
          this.applyDiscOrientation(
            this.discMesh,
            disc.pos.x,
            disc.pos.y,
            disc.pos.z,
            currentYaw,
            disc.pitch,
            disc.roll
          );
        }

        // Ground shadow
        const groundY = this.course.getTerrainHeight(disc.pos.x, disc.pos.z);
        this.discShadow.position.set(disc.pos.x, groundY + 0.02, disc.pos.z);
        const alt = Math.max(0, disc.pos.y - groundY);
        const shadowOpacity = Math.max(0.1, 0.45 - alt * 0.035);
        this.discShadow.material.opacity = shadowOpacity;
        this.discShadow.visible = true;

        // Chase Camera follows flying disc
        const flightDir = disc.vel.clone();
        flightDir.y = 0;
        if (flightDir.lengthSq() > 0.01) {
          flightDir.normalize();
          const targetCamPos = disc.pos.clone().addScaledVector(flightDir, -4.8);
          targetCamPos.y = Math.max(groundY + 1.2, disc.pos.y + 1.5);
          this.camera.position.lerp(targetCamPos, delta * 6.5);
          this.camera.lookAt(disc.pos.x + flightDir.x * 2.0, disc.pos.y + 0.2, disc.pos.z + flightDir.z * 2.0);
        }
      } else {
        // Disc has settled!
        this._handleDiscSettled(disc);
      }
    } else if (this.isFreeCam) {
      // --- Drone Free Cam / Hole Preview Flight ---
      this._updateFreeCam(delta);
    } else {
      // --- 2. Ready Mode (Before Throw): Show 3D Disc Angles Visually in Real Time! ---
      this._updateReadyDisc(delta);
      this._updateAimingCamera(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Visually render the 3D disc in front of the camera/lie with live Hyzer/Anhyzer & Nose pitch angles!
   */
  _updateReadyDisc(delta) {
    if (!this.discMesh) return;
    this.discMesh.visible = true;

    const fwdX = -Math.sin(this.aimYaw);
    const fwdZ = -Math.cos(this.aimYaw);
    const rightX = Math.cos(this.aimYaw);
    const rightZ = -Math.sin(this.aimYaw);

    const isForehand = this.throwStyle === 'forehand';
    const sideOffset = isForehand ? 0.38 : -0.12;

    const baseLaunchPos = this.currentLie.clone().add(new THREE.Vector3(
      fwdX * 0.95 + rightX * sideOffset,
      1.35,
      fwdZ * 0.95 + rightZ * sideOffset
    ));

    let readyPos;
    if (this.cameraMode === 'firstperson') {
      // First-person viewmodel position (held forward and to the side)
      readyPos = this.camera.position.clone()
        .add(new THREE.Vector3(fwdX * 0.95 + rightX * (sideOffset + 0.2), -0.26, fwdZ * 0.95 + rightZ * (sideOffset + 0.2)));
    } else {
      // Chase Cam: floating in launch position in front of player's lie
      readyPos = baseLaunchPos.clone();
    }

    // Subtle natural breathing sway for viewmodel
    const bobY = Math.sin(this.idleTimer * 2.4) * 0.02;
    readyPos.y += bobY;

    // Apply exact angles via unified function: perfectly aligned with release!
    const pitchRad = (this.noseAngle * 0.7 * Math.PI) / 180;
    const rollRad = (this.releaseAngle * Math.PI) / 180;
    this.applyDiscOrientation(this.discMesh, readyPos.x, readyPos.y, readyPos.z, this.aimYaw, pitchRad, rollRad);

    // Ground shadow directly underneath ready disc
    const groundY = this.course.getTerrainHeight(readyPos.x, readyPos.z);
    this.discShadow.position.set(readyPos.x, groundY + 0.02, readyPos.z);
    this.discShadow.material.opacity = 0.35;
    this.discShadow.visible = true;

    // --- Substantial, Glowing 3D Trajectory Tube & Landing Target Forecast ---
    // Synchronize power with active throw meter: locked power or oscillating power or full power
    let forecastPower = 1.0;
    if (this.throwState === 2) {
      forecastPower = this.powerLocked;
    } else if (this.throwState === 1) {
      forecastPower = Math.max(0.25, this.powerVal);
    }

    const discSpec = this.physics.getDiscByIndex(this.selectedDiscIndex);
    const predictedPoints = this.physics.predictTrajectory(
      discSpec,
      baseLaunchPos, // Uses exact physical launch origin!
      this.aimYaw,
      forecastPower, // Uses synchronized throw power!
      this.releaseAngle,
      this.noseAngle,
      this.course,
      this.windVector,
      160,
      this.throwStyle
    );

    if (predictedPoints && predictedPoints.length >= 3) {
      // Rebuild 3D Tube Geometry
      const curve = new THREE.CatmullRomCurve3(predictedPoints);
      if (this.trajectoryMesh.geometry) {
        this.trajectoryMesh.geometry.dispose();
      }
      // Substantial 7.5cm volumetric tube!
      this.trajectoryMesh.geometry = new THREE.TubeGeometry(
        curve,
        Math.min(96, predictedPoints.length * 2),
        0.075,
        8,
        false
      );
      this.trajectoryMesh.material.opacity = 0.95;
      this.trajectoryMesh.visible = true;

      // Update Landing Target Bullseye at touchdown point
      if (this.landingTargetGroup) {
        const lastPoint = predictedPoints[predictedPoints.length - 1];
        const distMeters = this.currentLie.distanceTo(lastPoint);
        const distFeet = Math.round(distMeters * 3.28084);
        const tY = this.course.getTerrainHeight(lastPoint.x, lastPoint.z);

        const hole = this.course.getCurrentHole();
        const pinDistFeet = Math.round(Math.hypot(hole.basket.x - lastPoint.x, hole.basket.z - lastPoint.z) * 3.28084);

        this.landingTargetGroup.position.set(lastPoint.x, tY + 0.04, lastPoint.z);
        this.landingTargetGroup.visible = true;

        // Redraw canvas text on landing placard
        const ctx = this.landingCanvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 96);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(8, 8, 240, 80, 12);
        else ctx.rect(8, 8, 240, 80);
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${distFeet} FT THROW`, 128, 42);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`(${pinDistFeet} FT TO PIN)`, 128, 74);

        this.landingTex.needsUpdate = true;
      }
    }
  }

  _updateAimingCamera(delta) {
    const fwdX = -Math.sin(this.aimYaw);
    const fwdZ = -Math.cos(this.aimYaw);
    const pitchRad = (this.noseAngle * 0.7 * Math.PI) / 180;
    const pitchOffset = Math.tan(pitchRad);

    if (this.cameraMode === 'firstperson') {
      this.camera.position.set(this.currentLie.x, this.currentLie.y + 1.65, this.currentLie.z);
      this.camera.lookAt(
        this.currentLie.x + fwdX * 20,
        this.currentLie.y + 1.65 + pitchOffset * 20,
        this.currentLie.z + fwdZ * 20
      );
    } else {
      const targetX = this.currentLie.x - fwdX * this.cameraDistance;
      const targetZ = this.currentLie.z - fwdZ * this.cameraDistance;
      const targetY = this.currentLie.y + this.cameraHeight;

      this.camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), delta * 8.0);
      this.camera.lookAt(
        this.currentLie.x + fwdX * 12,
        this.currentLie.y + 1.1 + pitchOffset * 12,
        this.currentLie.z + fwdZ * 12
      );
    }
  }

  _handleDiscSettled(disc) {
    if (!disc || this.isHoleCompleted || disc._handled) return;
    disc._handled = true;

    // Hide flight forecast once settled
    if (this.trajectoryMesh) this.trajectoryMesh.visible = false;
    if (this.landingTargetGroup) this.landingTargetGroup.visible = false;

    const hole = this.course.getCurrentHole();
    const prevLie = (this.lastShotOrigin || this.currentLie).clone();
    const throwDistFeet = Math.round(disc.pos.distanceTo(prevLie) * 3.28);

    if (disc.settledInBasket) {
      this.isHoleCompleted = true;
      this.shotHistory.push({
        shotNum: this.currentStroke,
        from: prevLie,
        to: disc.pos.clone(),
        throwDist: throwDistFeet,
        distToBasketAfter: 0,
        isOB: false
      });
      this._completeHole();
      return;
    }

    if (disc.isMandoMissed) {
      this.showToast('🚨 MISSED MANDO! (+1 PENALTY STROKE) • PROCEED TO DROP ZONE', '#f59e0b');
      const dz = (hole.mando && hole.mando.dropZone) ? hole.mando.dropZone : { x: disc.pos.x, z: disc.pos.z };
      const dzY = this.course.getTerrainHeight(dz.x, dz.z);
      const resetPoint = new THREE.Vector3(dz.x, dzY + 0.1, dz.z);
      const distToBasketAfter = Math.round(Math.hypot(hole.basket.x - resetPoint.x, hole.basket.z - resetPoint.z) * 3.28);

      this.shotHistory.push({
        shotNum: this.currentStroke,
        from: prevLie,
        to: disc.pos.clone(),
        throwDist: throwDistFeet,
        distToBasketAfter: distToBasketAfter,
        isOB: false,
        isMandoMissed: true
      });

      this.currentStroke += 2;

      setTimeout(() => {
        this.currentLie.copy(resetPoint);
        this.markerMesh.position.copy(this.currentLie);
        this.markerMesh.visible = true;
        this.physics.disc = null;
        this.throwState = 0;
        this._updateMeterDisplay();
        this.aimTowardBasket();
        this.updateHUD();
        this.renderMiniMap();
      }, 1400);
      return;
    }

    if (disc.isOB) {
      this.showToast('⚠️ OUT OF BOUNDS! (+1 STROKE PENALTY)', '#ef4444');
      const resetPoint = disc.obEntryPoint || this.currentLie.clone();
      const distToBasketAfter = Math.round(Math.hypot(hole.basket.x - resetPoint.x, hole.basket.z - resetPoint.z) * 3.28);

      this.shotHistory.push({
        shotNum: this.currentStroke,
        from: prevLie,
        to: disc.pos.clone(),
        throwDist: throwDistFeet,
        distToBasketAfter: distToBasketAfter,
        isOB: true
      });

      this.currentStroke += 2;

      setTimeout(() => {
        this.currentLie.copy(resetPoint);
        this.markerMesh.position.copy(this.currentLie);
        this.markerMesh.visible = true;
        this.physics.disc = null;
        this.throwState = 0;
        this._updateMeterDisplay();
        this.aimTowardBasket();
        this.updateHUD();
        this.renderMiniMap();
      }, 1400);
      return;
    }

    // Normal Fairway / Rough landing
    const distMetersAfter = Math.hypot(hole.basket.x - disc.pos.x, hole.basket.z - disc.pos.z);
    const distToBasketAfter = Math.round(distMetersAfter * 3.28);

    // Track regulation reach
    const regTargetStrokes = hole.par - 2;
    if (this.currentStroke <= regTargetStrokes) {
      if (distMetersAfter <= 10.0) {
        this.currentHoleStats.reachedC1InReg = true;
        this.currentHoleStats.reachedC2InReg = true;
      } else if (distMetersAfter <= 20.0) {
        this.currentHoleStats.reachedC2InReg = true;
      }
    }

    this.shotHistory.push({
      shotNum: this.currentStroke,
      from: prevLie,
      to: disc.pos.clone(),
      throwDist: throwDistFeet,
      distToBasketAfter: distToBasketAfter,
      isOB: false
    });

    this.currentStroke++;
    const skipText = disc.skips > 0 ? ` (${disc.skips}x SKIP!)` : '';
    this.showToast(`SHOT ${this.currentStroke - 1}: ${throwDistFeet} FT THROW • ${distToBasketAfter} FT TO BASKET${skipText}`, '#38bdf8');

    setTimeout(() => {
      this.currentLie.copy(disc.pos);
      this.markerMesh.position.copy(this.currentLie);
      this.markerMesh.visible = true;

      this.physics.disc = null;
      this.throwState = 0;
      this._updateMeterDisplay();

      // Re-aim toward basket
      this.aimTowardBasket();

      // Check distance for auto-disc recommendation
      if (distToBasketAfter < 55) {
        this.selectDisc(0); // Auto select Putter within 55 feet!
      } else if (distToBasketAfter < 200) {
        this.selectDisc(1); // Midrange
      }

      this.updateHUD();
      this.renderMiniMap();
    }, 1200);
  }

  _completeHole() {
    const hole = this.course.getCurrentHole();
    const finalStrokes = this.currentStroke;
    const diff = finalStrokes - hole.par;

    this.scorecard[this.course.currentHoleIndex] = finalStrokes;

    // Record DGPT tournament stats for this hole
    this.stats.c1InRegChances++;
    this.stats.c2InRegChances++;
    if (this.currentHoleStats.reachedC1InReg) this.stats.c1InRegHits++;
    if (this.currentHoleStats.reachedC2InReg) this.stats.c2InRegHits++;

    if (this.lastShotDistToBasket <= 10.0) {
      this.stats.c1PuttsMade++;
      this.currentHoleStats.c1PuttMade = true;
    } else if (this.lastShotDistToBasket <= 20.0) {
      this.stats.c2PuttsMade++;
      this.currentHoleStats.c2PuttMade = true;
    }

    if (!this.currentHoleStats.reachedC2InReg) {
      this.stats.scrambleChances++;
      if (finalStrokes <= hole.par) {
        this.stats.scrambleSaves++;
      }
    }
    this.holeStats[this.course.currentHoleIndex] = { ...this.currentHoleStats, strokes: finalStrokes };

    let title = "PAR";
    let isUnderPar = diff <= 0;
    if (finalStrokes === 1) title = "💥 ACE! (HOLE IN ONE!)";
    else if (diff <= -2) title = "🦅 EAGLE!";
    else if (diff === -1) title = "🐦 BIRDIE!";
    else if (diff === 0) title = "PAR";
    else if (diff === 1) title = "BOGEY";
    else title = `+${diff} DOUBLE BOGEY`;

    this.audio.playCelebration(isUnderPar);
    this.showCelebrationBanner(title, finalStrokes, hole.par);

    setTimeout(() => {
      if (this.course.currentHoleIndex < 8) {
        this.startHole(this.course.currentHoleIndex + 1);
        this.physics.disc = null;
      } else {
        this._showGameOverSummary();
      }
    }, 3200);
  }

  showToast(message, color = '#38bdf8') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = color;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2200);
  }

  showCelebrationBanner(title, strokes, par) {
    const banner = document.getElementById('celebration-banner');
    if (!banner) return;
    document.getElementById('celeb-title').textContent = title;
    document.getElementById('celeb-details').textContent = `Hole ${this.course.currentHoleIndex + 1} completed in ${strokes} strokes (Par ${par})`;
    banner.classList.remove('hidden');
    banner.classList.add('show');
    setTimeout(() => {
      banner.classList.remove('show');
      setTimeout(() => banner.classList.add('hidden'), 400);
    }, 2800);
  }

  _showGameOverSummary() {
    this.roundCompleted = true;
    const modal = document.getElementById('modal-gameover');
    if (!modal) return;

    let totalStrokes = 0;
    let totalPar = 0;
    let aces = 0;
    let birdies = 0;
    let pars = 0;
    let bogeys = 0;

    this.course.holes.forEach((h, idx) => {
      const s = this.scorecard[idx];
      totalPar += h.par;
      if (s) {
        totalStrokes += s;
        const diff = s - h.par;
        if (s === 1) aces++;
        else if (diff < 0) birdies++;
        else if (diff === 0) pars++;
        else bogeys++;
      }
    });

    const diff = totalStrokes - totalPar;
    const diffText = diff > 0 ? `+${diff}` : (diff < 0 ? `${diff}` : 'E (Even Par)');
    const estimatedRating = Math.max(650, Math.min(1080, 1000 - (diff + 3) * 12));

    document.getElementById('go-final-score').textContent = `${totalStrokes} (${diffText})`;
    document.getElementById('go-rating').textContent = `${estimatedRating} PDGA`;
    document.getElementById('go-stat-aces').textContent = aces;
    document.getElementById('go-stat-birdies').textContent = birdies;
    document.getElementById('go-stat-pars').textContent = pars;
    document.getElementById('go-stat-bogeys').textContent = bogeys;

    // Advanced Circle 1 & 2 Tournament Stats
    const c1rPct = this.stats.c1InRegChances > 0 ? Math.round((this.stats.c1InRegHits / this.stats.c1InRegChances) * 100) : 0;
    const c2rPct = this.stats.c2InRegChances > 0 ? Math.round((this.stats.c2InRegHits / this.stats.c2InRegChances) * 100) : 0;
    const c1xPct = this.stats.c1PuttsAttempted > 0 ? Math.round((this.stats.c1PuttsMade / this.stats.c1PuttsAttempted) * 100) : 0;

    const elGoC1R = document.getElementById('go-stat-c1r');
    if (elGoC1R) elGoC1R.textContent = `${c1rPct}%`;
    const elGoC2R = document.getElementById('go-stat-c2r');
    if (elGoC2R) elGoC2R.textContent = `${c2rPct}%`;
    const elGoC1X = document.getElementById('go-stat-c1x');
    if (elGoC1X) elGoC1X.textContent = `${c1xPct}%`;
    const elGoC2P = document.getElementById('go-stat-c2putt');
    if (elGoC2P) elGoC2P.textContent = `${this.stats.c2PuttsMade}`;

    modal.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.discGolfApp = new DiscGolfGame();
});

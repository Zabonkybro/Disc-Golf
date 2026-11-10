/**
 * Disc Golf Championship Courses & Environment Engine
 * Supports 3 championship courses:
 *  1. Pine Valley Championship (Par 30, 3,405 ft - Evergreen Pacific Northwest Park)
 *  2. Maple Ridge Autumn Glen (Par 31, 3,490 ft - Sunny Fall Foliage, Falling Leaves, Covered Bridge & Red Barn)
 *  3. Frost Peak Ski Resort (Par 31, 3,500 ft - Alpine Snow, Long Ice Slides, Chairlifts, Chalet & Mandatory Hazard)
 *
 * Features:
 *  - Strict Tee Pad & Launch Corridor Clearance Protection (no obstacles on or near any tee)
 *  - Interactive Falling Leaves & Snow Particle System (fluttering descent on tree collisions)
 *  - Realistic Ice Surface physics (low-friction long slides and skips)
 *  - Mandatory (Mando) Course Rules & 3D Visual Indicators with Drop Zone (DZ)
 *  - Procedural rolling terrain with custom elevation profiles per course
 *  - Realistic dual-tier chain baskets, concrete tee pads with tee signs, C1/C2 circles
 */

class FallingLeafSystem {
  constructor(scene, courseGroup, theme = 'autumn') {
    this.scene = scene;
    this.courseGroup = courseGroup;
    this.theme = theme;
    this.maxLeaves = 260;
    this.ambientTimer = 0;

    // Palette based on theme: autumn foliage or alpine snow crystals
    if (this.theme === 'freezing') {
      this.palette = [
        0xffffff, // Pure Snow White
        0xf8fafc, // Snow Silver
        0xf1f5f9, // Powder Snow
        0xe2e8f0, // Icy White
        0xdbeafe, // Pale Ice Blue
        0xbfdbfe, // Glacial Frost
        0x93c5fd  // Ice Crystal
      ];
    } else {
      this.palette = [
        0xdc2626, // Scarlet Maple Red
        0xef4444, // Vibrant Crimson
        0xf97316, // Burnt Orange
        0xea580c, // Deep Autumn Orange
        0xfacc15, // Golden Birch Yellow
        0xf59e0b, // Warm Amber
        0xb45309, // Russet Oak
        0x9a3412  // Auburn
      ];
    }

    // Geometry: smaller compact flakes for snow, diamond quads for leaves
    const w = this.theme === 'freezing' ? 0.16 : 0.22;
    const h = this.theme === 'freezing' ? 0.16 : 0.32;
    this.leafGeo = new THREE.PlaneGeometry(w, h);
    this.leafGeo.rotateX(Math.PI / 2);

    this.pool = [];
    for (let i = 0; i < this.maxLeaves; i++) {
      const color = this.palette[i % this.palette.length];
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: this.theme === 'freezing' ? 0.3 : 0.85,
        metalness: this.theme === 'freezing' ? 0.4 : 0.05,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(this.leafGeo, mat);
      mesh.visible = false;
      this.courseGroup.add(mesh);

      this.pool.push({
        mesh: mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        flutterPhase: Math.random() * Math.PI * 2,
        flutterSpeed: 3.5 + Math.random() * 4.0,
        settled: false,
        settleTimer: 0,
        maxSettleTime: 12 + Math.random() * 8
      });
    }
  }

  spawnBurst(x, y, z, count = 35) {
    let spawned = 0;
    for (let i = 0; i < this.pool.length && spawned < count; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.settled = false;
        p.settleTimer = 0;
        p.mesh.visible = true;

        const radius = 0.4 + Math.random() * 2.2;
        const angle = Math.random() * Math.PI * 2;
        p.pos.set(
          x + Math.cos(angle) * radius,
          y + (Math.random() - 0.2) * 1.8,
          z + Math.sin(angle) * radius
        );
        p.mesh.position.copy(p.pos);

        p.vel.set(
          Math.cos(angle) * (0.8 + Math.random() * 1.8),
          -0.5 - Math.random() * 1.2,
          Math.sin(angle) * (0.8 + Math.random() * 1.8)
        );

        p.rotVel.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 6
        );

        p.flutterPhase = Math.random() * Math.PI * 2;
        spawned++;
      }
    }
  }

  spawnAmbient(cameraPos, windVector) {
    if (!cameraPos) return;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.settled = false;
        p.settleTimer = 0;
        p.mesh.visible = true;

        const upwindX = -(windVector ? windVector.x : 0) * 8 + (Math.random() - 0.5) * 24;
        const upwindZ = -(windVector ? windVector.z : 0) * 8 + (Math.random() - 0.5) * 24;
        p.pos.set(
          cameraPos.x + upwindX,
          cameraPos.y + 4 + Math.random() * 7,
          cameraPos.z + upwindZ
        );
        p.mesh.position.copy(p.pos);

        p.vel.set(
          (windVector ? windVector.x : 0) * 0.7 + (Math.random() - 0.5) * 0.5,
          -0.6 - Math.random() * 0.7,
          (windVector ? windVector.z : 0) * 0.7 + (Math.random() - 0.5) * 0.5
        );

        p.rotVel.set(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 3
        );
        break;
      }
    }
  }

  update(delta, windVector, getTerrainHeight, cameraPos, shouldDriftAmbient) {
    if (shouldDriftAmbient) {
      this.ambientTimer += delta;
      if (this.ambientTimer > 1.2) {
        this.ambientTimer = 0;
        this.spawnAmbient(cameraPos, windVector);
      }
    }

    const windX = windVector ? windVector.x : 0;
    const windZ = windVector ? windVector.z : 0;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      if (p.settled) {
        p.settleTimer += delta;
        if (p.settleTimer > p.maxSettleTime) {
          p.active = false;
          p.mesh.visible = false;
        }
        continue;
      }

      p.flutterPhase += delta * p.flutterSpeed;
      const flutterX = Math.cos(p.flutterPhase) * 0.65;
      const flutterZ = Math.sin(p.flutterPhase) * 0.65;

      p.pos.x += (p.vel.x + windX * 0.6 + flutterX) * delta;
      p.pos.y += p.vel.y * delta;
      p.pos.z += (p.vel.z + windZ * 0.6 + flutterZ) * delta;

      p.vel.x *= Math.pow(0.85, delta * 30);
      p.vel.z *= Math.pow(0.85, delta * 30);

      p.mesh.rotation.x += p.rotVel.x * delta;
      p.mesh.rotation.y += p.rotVel.y * delta;
      p.mesh.rotation.z += p.rotVel.z * delta;

      p.mesh.position.copy(p.pos);

      const groundY = getTerrainHeight(p.pos.x, p.pos.z);
      if (p.pos.y <= groundY + 0.04) {
        p.pos.y = groundY + 0.03;
        p.mesh.position.y = p.pos.y;
        p.settled = true;
        p.settleTimer = 0;
        p.mesh.rotation.x = 0;
        p.mesh.rotation.z = 0;
      }
    }
  }

  dispose() {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      if (p.mesh.material) p.mesh.material.dispose();
    }
    this.pool = [];
    if (this.leafGeo) this.leafGeo.dispose();
  }
}

class DiscGolfCourse {
  // Course Specifications Catalog
  static COURSES = {
    pineValley: {
      id: 'pineValley',
      name: "Pine Valley Championship",
      theme: "summer",
      par: 30,
      totalDistanceFeet: 3405,
      totalDistanceMeters: 1038,
      atmosphere: {
        skyColor: 0x87ceeb,
        fogColor: 0xa0d8ef,
        fogDensity: 0.0022,
        hemiSky: 0xffffff,
        hemiGround: 0x445533,
        dirColor: 0xfffaed,
        dirIntensity: 1.3,
        dirPos: [60, 120, 40],
        exposure: 1.05
      },
      holes: [
        {
          number: 1,
          name: "Pine Valley Meadow",
          par: 3,
          distanceFeet: 245,
          distanceMeters: 75,
          tee: { x: 0, z: 0 },
          basket: { x: 6, z: -74 },
          description: "Gentle downhill pine corridor ace run with a slight tailwind draft (-14 ft drop).",
          fairwayWidth: 22
        },
        {
          number: 2,
          name: "Granite Shelf Dogleg",
          par: 3,
          distanceFeet: 315,
          distanceMeters: 96,
          tee: { x: 20, z: -90 },
          basket: { x: 74, z: -160 },
          dogleg: { x: 38, z: -132 },
          description: "Sharp dogleg right carving around an uphill granite cliff shelf (+11 ft rise). Built for forehand flex or turnover.",
          fairwayWidth: 26
        },
        {
          number: 3,
          name: "Overlook Bluff",
          par: 3,
          distanceFeet: 410,
          distanceMeters: 125,
          tee: { x: 88, z: -185 },
          basket: { x: 18, z: -290 },
          description: "Spectacular elevated tee bluff with a plunging -39 ft cliff drop into a boulder-strewn canyon basin.",
          fairwayWidth: 32
        },
        {
          number: 4,
          name: "Whispering Oaks",
          par: 4,
          distanceFeet: 520,
          distanceMeters: 158,
          tee: { x: 0, z: -308 },
          basket: { x: -68, z: -455 },
          dogleg: { x: -45, z: -385 },
          description: "Long championship Par 4 double-dogleg S-curve through ancient oak stands and undulating knolls.",
          fairwayWidth: 28
        },
        {
          number: 5,
          name: "The Gauntlet Tunnel",
          par: 3,
          distanceFeet: 220,
          distanceMeters: 67,
          tee: { x: -82, z: -475 },
          basket: { x: -92, z: -541 },
          description: "Tight 14-meter wooded timber tunnel requiring pinpoint midrange control. Clean line yields a birdie putt.",
          fairwayWidth: 14
        },
        {
          number: 6,
          name: "Emerald Island",
          par: 3,
          distanceFeet: 280,
          distanceMeters: 85,
          tee: { x: -80, z: -560 },
          basket: { x: -35, z: -632 },
          description: "Signature island green surrounded by a crystal water hazard pond and footbridge. Penalty stroke for water landings!",
          fairwayWidth: 22,
          hasWaterOB: true,
          waterCenter: { x: -40, z: -625 },
          waterRadius: 32,
          islandCenter: { x: -35, z: -632 },
          islandRadius: 13
        },
        {
          number: 7,
          name: "Hyzer Gulch Side-Hill",
          par: 3,
          distanceFeet: 365,
          distanceMeters: 111,
          tee: { x: -15, z: -660 },
          basket: { x: -95, z: -735 },
          dogleg: { x: -40, z: -710 },
          description: "Sweeping downhill dogleg left (-34 ft drop) hugging a steep granite side-hill. Demands a committed hyzer angle.",
          fairwayWidth: 26
        },
        {
          number: 8,
          name: "Thunder Hill Fortress",
          par: 4,
          distanceFeet: 485,
          distanceMeters: 148,
          tee: { x: -85, z: -760 },
          basket: { x: -10, z: -890 },
          dogleg: { x: -45, z: -825 },
          description: "Grueling Par 4 climbing +46 ft up a steep mountain ridge into a rock-walled hilltop crown.",
          fairwayWidth: 32
        },
        {
          number: 9,
          name: "Grand Finale",
          par: 4,
          distanceFeet: 550,
          distanceMeters: 168,
          tee: { x: -15, z: -915 },
          basket: { x: -25, z: -1080 },
          dogleg: { x: -10, z: -995 },
          description: "550 ft championship par 4 finishing hole rolling downhill (-20 ft) across a paved path hazard to the clubhouse green.",
          fairwayWidth: 36,
          hasPathOB: true,
          pathZ: -1005
        }
      ]
    },

    mapleRidge: {
      id: 'mapleRidge',
      name: "Maple Ridge Autumn Glen",
      theme: "autumn",
      par: 31,
      totalDistanceFeet: 3490,
      totalDistanceMeters: 1064,
      atmosphere: {
        skyColor: 0x7eb8e8,
        fogColor: 0xf5deb3,
        fogDensity: 0.0019,
        hemiSky: 0xffedd5,
        hemiGround: 0x78350f,
        dirColor: 0xffe4b5,
        dirIntensity: 1.45,
        dirPos: [75, 95, 55],
        exposure: 1.15
      },
      holes: [
        {
          number: 1,
          name: "Cider Hill Orchard",
          par: 3,
          distanceFeet: 255,
          distanceMeters: 78,
          tee: { x: 0, z: 0 },
          basket: { x: -8, z: -76 },
          description: "Sunny apple orchard corridor through golden birches and scarlet maples (-12 ft gentle drop).",
          fairwayWidth: 22
        },
        {
          number: 2,
          name: "Amber Ridge Dogleg",
          par: 4,
          distanceFeet: 465,
          distanceMeters: 142,
          tee: { x: -24, z: -94 },
          basket: { x: 48, z: -215 },
          dogleg: { x: -5, z: -160 },
          description: "Uphill right dogleg carving past fiery sugar maples to a scenic rocky terrace (+32 ft rise).",
          fairwayWidth: 28
        },
        {
          number: 3,
          name: "Covered Bridge Canyon",
          par: 3,
          distanceFeet: 330,
          distanceMeters: 101,
          tee: { x: 62, z: -235 },
          basket: { x: -12, z: -328 },
          description: "Plunging canyon ace run (-36 ft drop) crossing over a rustic covered wooden bridge and creek.",
          fairwayWidth: 26
        },
        {
          number: 4,
          name: "Colonial Stone Wall",
          par: 4,
          distanceFeet: 530,
          distanceMeters: 162,
          tee: { x: -28, z: -350 },
          basket: { x: -95, z: -498 },
          dogleg: { x: -75, z: -425 },
          description: "Long double-dogleg S-curve framed by historic dry-stone New England farm walls and glowing oaks.",
          fairwayWidth: 30
        },
        {
          number: 5,
          name: "Pumpkin Run Gap",
          par: 3,
          distanceFeet: 215,
          distanceMeters: 66,
          tee: { x: -110, z: -520 },
          basket: { x: -118, z: -584 },
          description: "Tight 13-meter wooded tunnel gap through dense sugar maples demanding laser-straight control.",
          fairwayWidth: 14
        },
        {
          number: 6,
          name: "Reflecting Pond Island",
          par: 3,
          distanceFeet: 285,
          distanceMeters: 87,
          tee: { x: -105, z: -605 },
          basket: { x: -55, z: -682 },
          fairwayWidth: 24,
          hasWaterOB: true,
          waterCenter: { x: -58, z: -675 },
          waterRadius: 30,
          islandCenter: { x: -55, z: -682 },
          islandRadius: 13,
          description: "Island green in a scenic autumn pond with weeping golden willows and floating red leaves (+8 ft rise)."
        },
        {
          number: 7,
          name: "Scarlet Bowl Hyzer",
          par: 3,
          distanceFeet: 350,
          distanceMeters: 107,
          tee: { x: -30, z: -710 },
          basket: { x: -105, z: -795 },
          dogleg: { x: -50, z: -765 },
          fairwayWidth: 28,
          description: "Sweeping downhill dogleg left (-16 ft drop) into a vibrant red maple bowl. Built for a booming hyzer."
        },
        {
          number: 8,
          name: "Sugarloaf Summit",
          par: 4,
          distanceFeet: 515,
          distanceMeters: 157,
          tee: { x: -95, z: -825 },
          basket: { x: -15, z: -965 },
          dogleg: { x: -55, z: -900 },
          fairwayWidth: 32,
          description: "Grueling climb (+34 ft) up the Maple Ridge crest, dodging granite boulders to reach the summit crown."
        },
        {
          number: 9,
          name: "The Red Barn Estate",
          par: 4,
          distanceFeet: 545,
          distanceMeters: 166,
          tee: { x: -20, z: -990 },
          basket: { x: -30, z: -1150 },
          dogleg: { x: -12, z: -1070 },
          fairwayWidth: 36,
          hasPathOB: true,
          pathZ: -1075,
          description: "Championship finish curving downhill (-18 ft) past a historic red timber barn, silo, and estate green."
        }
      ]
    },

    frostPeak: {
      id: 'frostPeak',
      name: "Frost Peak Ski Resort",
      theme: "freezing",
      par: 31,
      totalDistanceFeet: 3500,
      totalDistanceMeters: 1067,
      atmosphere: {
        skyColor: 0x93c5fd, // Alpine crisp winter sky
        fogColor: 0xdbeafe, // Frost mountain mist
        fogDensity: 0.0021,
        hemiSky: 0xe0f2fe,
        hemiGround: 0x93c5fd,
        dirColor: 0xffffff, // Brilliant cool winter sunlight
        dirIntensity: 1.45,
        dirPos: [70, 110, 45],
        exposure: 1.15
      },
      holes: [
        {
          number: 1,
          name: "Bunny Hill Glade",
          par: 3,
          distanceFeet: 240,
          distanceMeters: 73,
          tee: { x: 0, z: 0 },
          basket: { x: 5, z: -73 },
          fairwayWidth: 24,
          description: "Gentle downhill beginner ski slope ace run (-16 ft drop) weaving through snow-covered spruce trees."
        },
        {
          number: 2,
          name: "Chairlift Ridge",
          par: 4,
          distanceFeet: 485,
          distanceMeters: 148,
          tee: { x: 25, z: -92 },
          basket: { x: -45, z: -220 },
          dogleg: { x: -8, z: -155 },
          fairwayWidth: 28,
          description: "Uphill fairway (+28 ft climb) carving alongside the ski resort quad chairlift towers and cables."
        },
        {
          number: 3,
          name: "Glacier Ravine",
          par: 3,
          distanceFeet: 315,
          distanceMeters: 96,
          tee: { x: -60, z: -240 },
          basket: { x: 10, z: -332 },
          fairwayWidth: 26,
          description: "Spectacular bluff plunge (-38 ft cliff) into an icy glacial ravine with slick blue ice patches."
        },
        {
          number: 4,
          name: "The Black Diamond",
          par: 4,
          distanceFeet: 535,
          distanceMeters: 163,
          tee: { x: 25, z: -355 },
          basket: { x: 95, z: -505 },
          dogleg: { x: 68, z: -430 },
          fairwayWidth: 32,
          description: "Steep black diamond ski run (-22 ft) with mogul mounds and wide slick ice chutes that give massive skips and 80+ ft slides!"
        },
        {
          number: 5,
          name: "Frozen Lake Mando",
          par: 3,
          distanceFeet: 265,
          distanceMeters: 81,
          tee: { x: 85, z: -530 },
          basket: { x: 75, z: -608 },
          fairwayWidth: 22,
          description: "Signature Mando hole! Players MUST PASS LEFT OF THE COMMUNICATIONS TOWER [ ⬅ MANDO ]. Missing on the right incurs a 1-stroke penalty to the Drop Zone!",
          mando: {
            x: 78,
            z: -568,
            passSide: 'left',
            planeZ: -568,
            arrowDirection: 'left',
            dropZone: { x: 74, z: -565 }
          }
        },
        {
          number: 6,
          name: "Mogul Basin",
          par: 3,
          distanceFeet: 275,
          distanceMeters: 84,
          tee: { x: 65, z: -630 },
          basket: { x: 15, z: -708 },
          fairwayWidth: 24,
          description: "Technical downhill shot (-8 ft) weaving through undulating snow moguls and a frozen skating pond."
        },
        {
          number: 7,
          name: "Halfpipe Slalom",
          par: 3,
          distanceFeet: 340,
          distanceMeters: 104,
          tee: { x: 0, z: -730 },
          basket: { x: -70, z: -818 },
          dogleg: { x: -30, z: -780 },
          fairwayWidth: 28,
          description: "Carving down a banked halfpipe snow gully (-14 ft) flanked by ski slalom racing flags and powder snow drifts."
        },
        {
          number: 8,
          name: "Summit Peak Blizzard",
          par: 4,
          distanceFeet: 510,
          distanceMeters: 155,
          tee: { x: -85, z: -840 },
          basket: { x: -15, z: -985 },
          dogleg: { x: -45, z: -915 },
          fairwayWidth: 32,
          description: "High alpine climb (+36 ft) up the windy summit crown exposed to icy crusts and frost-covered boulders."
        },
        {
          number: 9,
          name: "Chalet Grand Run",
          par: 4,
          distanceFeet: 535,
          distanceMeters: 163,
          tee: { x: -20, z: -1010 },
          basket: { x: -30, z: -1170 },
          dogleg: { x: -15, z: -1090 },
          fairwayWidth: 36,
          hasPathOB: true,
          pathZ: -1095,
          description: "Scenic finishing drive down the main resort trail, sliding past the Alpine Ski Lodge, chairlift base station, and ski racks onto the resort green."
        }
      ]
    }
  };

  constructor(scene) {
    this.scene = scene;
    this.currentCourseId = 'pineValley';
    this.courseGroup = new THREE.Group();
    this.scene.add(this.courseGroup);

    this.obstacles = [];
    this.baskets = [];
    this.teePads = [];
    this.waterMeshes = [];
    this.currentHoleIndex = 0;

    // Load initial default course
    this.loadCourse('pineValley');
  }

  get courseSpec() {
    return DiscGolfCourse.COURSES[this.currentCourseId];
  }

  get totalPar() {
    return this.courseSpec.par;
  }

  getCurrentHole() {
    return this.holes[this.currentHoleIndex];
  }

  setHole(index) {
    this.currentHoleIndex = Math.max(0, Math.min(this.holes.length - 1, index));
  }

  getCurrentHoleBasket() {
    return this.baskets[this.currentHoleIndex];
  }

  getObstacles() {
    return this.obstacles;
  }

  /**
   * Identifies slick ice surfaces where discs experience super-low friction and extended slides
   */
  isIceSurface(x, z) {
    if (this.currentCourseId !== 'frostPeak') return false;

    // 1. Hole 3: Glacial ravine ice sheet
    if (z < -260 && z > -335 && x > -50 && x < 25) return true;
    // 2. Hole 4: Black Diamond ice slide chute
    if (z < -365 && z > -505 && Math.abs((x - 65) + (z + 430) * 0.28) < 16) return true;
    // 3. Hole 5: Frozen Lake (near and around the basket)
    if (z < -540 && z > -615 && x > 50 && x < 105) return true;
    // 4. Hole 6: Skating pond
    if (z < -655 && z > -705 && x > 20 && x < 60) return true;
    // 5. Hole 8: Summit ice glacier
    if (z < -860 && z > -965 && x > -75 && x < -20) return true;
    // 6. Hole 9: Base village ice rink
    if (z < -1100 && z > -1165 && x > -55 && x < -10) return true;

    return false;
  }

  /**
   * Universal Tee Pad & Corridor Safety Checker:
   * GUARANTEES that no tree, bush, or boulder ever spawns on or near ANY tee pad,
   * nor inside the immediate 38m forward launch corridor of any hole!
   */
  _isObstacleLocationSafe(x, z, holes) {
    for (let i = 0; i < holes.length; i++) {
      const hole = holes[i];
      const distToTee = Math.hypot(x - hole.tee.x, z - hole.tee.z);

      // 1. Strict 22-meter radial clearance bubble around ANY tee pad
      if (distToTee < 22.0) {
        return false;
      }

      // 2. Strict 38-meter forward launch corridor cone in front of ANY tee pad
      const targetX = hole.dogleg ? hole.dogleg.x : hole.basket.x;
      const targetZ = hole.dogleg ? hole.dogleg.z : hole.basket.z;
      const teeHeading = Math.atan2(targetX - hole.tee.x, targetZ - hole.tee.z);
      const obsAngle = Math.atan2(x - hole.tee.x, z - hole.tee.z);

      let angleDiff = Math.abs(obsAngle - teeHeading);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      if (distToTee < 38.0 && angleDiff < 0.68) {
        return false;
      }

      // 3. Clear direct basket drop zone
      const distToBasket = Math.hypot(x - hole.basket.x, z - hole.basket.z);
      if (distToBasket < 5.0) {
        return false;
      }

      // 4. Clear dogleg turning apex
      if (hole.dogleg) {
        const distToDogleg = Math.hypot(x - hole.dogleg.x, z - hole.dogleg.z);
        if (distToDogleg < 6.0) return false;
      }

      // 5. Clear Mando path & Drop Zone
      if (hole.mando) {
        const distToMando = Math.hypot(x - hole.mando.x, z - hole.mando.z);
        if (distToMando < 7.0) return false;
        const distToDZ = Math.hypot(x - hole.mando.dropZone.x, z - hole.mando.dropZone.z);
        if (distToDZ < 8.0) return false;
      }
    }
    return true;
  }

  loadCourse(courseId) {
    if (!DiscGolfCourse.COURSES[courseId]) {
      courseId = 'pineValley';
    }
    this.currentCourseId = courseId;
    this.holes = DiscGolfCourse.COURSES[courseId].holes;
    this.currentHoleIndex = 0;

    // Dispose old elements
    this._disposeCourseMeshes();

    // Reset collections
    this.obstacles = [];
    this.baskets = [];
    this.teePads = [];
    this.waterMeshes = [];

    // Rebuild course environment
    this._createTerrainMesh();
    this._createWaterFeatures();
    this._createOBVisuals();
    this._createHoleElements();
    this._createObstacles();

    if (courseId === 'mapleRidge') {
      this._createMapleRidgeLandmarks();
    } else if (courseId === 'frostPeak') {
      this._createFrostPeakLandmarks();
    } else {
      this._createClubhouse();
    }

    // Initialize interactive falling particle system (leaves or snow)
    if (this.leafSystem) {
      this.leafSystem.dispose();
    }
    const theme = DiscGolfCourse.COURSES[courseId].theme;
    this.leafSystem = new FallingLeafSystem(this.scene, this.courseGroup, theme);
  }

  _disposeCourseMeshes() {
    while (this.courseGroup.children.length > 0) {
      const obj = this.courseGroup.children[0];
      this.courseGroup.remove(obj);
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }

  spawnFallingLeaves(x, y, z, count = 35) {
    if (this.leafSystem) {
      this.leafSystem.spawnBurst(x, y, z, count);
    }
  }

  updateLeaves(delta, windVector, cameraPos) {
    if (this.leafSystem) {
      const isAmbientDrift = this.currentCourseId === 'mapleRidge' || this.currentCourseId === 'frostPeak';
      this.leafSystem.update(
        delta,
        windVector,
        (x, z) => this.getTerrainHeight(x, z),
        cameraPos,
        isAmbientDrift
      );
    }
  }

  /**
   * Terrain Elevation function:
   * Returns ground height at any coordinate (x, z) for the active course
   */
  getTerrainHeight(x, z) {
    if (this.currentCourseId === 'frostPeak') {
      // --- Frost Peak Ski Resort Topography ---
      let h = Math.sin(x * 0.012) * Math.cos(z * 0.01) * 3.5 + Math.sin(x * 0.025 + z * 0.015) * 1.8;

      // Hole 1: Bunny Hill gentle ski slope (-16 ft / -4.8m drop)
      if (z > -80 && z <= 10) {
        h -= (Math.abs(z) / 73.0) * 4.8;
      }

      // Hole 2: Chairlift Ridge climb (+28 ft / +8.5m rise)
      if (z <= -80 && z > -230) {
        const prog = (-80 - z) / 150.0;
        h += Math.min(1.0, Math.max(0.0, prog)) * 8.5;
      }

      // Hole 3: Glacier Ravine bluff drop (-38 ft / -11.5m drop)
      const distBluff3 = Math.hypot(x - (-60), z - (-240));
      if (distBluff3 < 32) {
        h += Math.cos((distBluff3 / 32.0) * Math.PI * 0.5) * 7.5;
      }
      if (z < -265 && z > -335 && x > -50 && x < 25) {
        const t = (z - (-300)) / 35.0;
        h -= Math.exp(-t * t) * 4.5;
      }

      // Hole 4: The Black Diamond steep ski run (-22 ft / -6.7m descent)
      if (z <= -350 && z > -510) {
        const prog = (-350 - z) / 160.0;
        h -= prog * 6.7;
        // Mogul mounds
        h += Math.sin(x * 0.28) * Math.cos(z * 0.28) * 0.85;
      }

      // Hole 5: Frozen Lake Mando
      if (z <= -525 && z > -615) {
        h += 1.8;
      }

      // Hole 6: Mogul Basin (-8 ft)
      if (z <= -625 && z > -715) {
        const prog = (-625 - z) / 90.0;
        h -= prog * 2.4;
        h += Math.sin(x * 0.25) * Math.sin(z * 0.25) * 0.95;
      }

      // Hole 7: Halfpipe Slalom (-14 ft)
      if (z <= -725 && z > -825) {
        const prog = (-725 - z) / 100.0;
        h -= prog * 4.2;
        // Halfpipe banks
        const distFromCenter = Math.abs(x - (-35));
        h += Math.min(3.5, Math.pow(distFromCenter / 14.0, 2) * 2.0);
      }

      // Hole 8: Summit Peak climb (+36 ft / +11m climb)
      if (z <= -835 && z > -990) {
        const prog = (-835 - z) / 155.0;
        h += Math.min(1.0, Math.max(0.0, prog)) * 11.0;
      }

      // Hole 9: Chalet Grand Run (-18 ft / -5.5m)
      if (z <= -1000) {
        const prog = (-1000 - z) / 175.0;
        h += 11.0 - prog * 5.5;
        h += Math.cos(z * 0.025) * 1.2;
      }

      return h;
    }

    if (this.currentCourseId === 'mapleRidge') {
      // --- Maple Ridge Autumn Glen Topography ---
      let h = Math.sin(x * 0.014) * Math.cos(z * 0.012) * 3.0 + Math.cos(x * 0.032 + z * 0.019) * 1.4;

      // Hole 1: Cider Hill gentle drop (-12 ft / -3.6m)
      if (z > -85 && z <= 10) {
        h -= (Math.abs(z) / 78.0) * 3.6;
      }

      // Hole 2: Amber Ridge uphill terrace rise (+32 ft / +9.8m)
      if (z <= -85 && z > -225) {
        const prog = (-85 - z) / 130.0;
        h += Math.min(1.0, Math.max(0.0, prog)) * 9.8;
      }

      // Hole 3: Canyon Bluff plunging over Creek & Covered Bridge (-36 ft / -11m drop)
      const distBluff3 = Math.hypot(x - 62, z - (-235));
      if (distBluff3 < 32) {
        h += Math.cos((distBluff3 / 32.0) * Math.PI * 0.5) * 8.5;
      }
      if (z < -260 && z > -340 && x < 40) {
        const t = (z - (-300)) / 40.0;
        h -= Math.exp(-t * t) * 5.0;
      }

      // Hole 4: Colonial Stone Wall rolling pastures (+10 ft undulations)
      if (z <= -340 && z > -505) {
        h += Math.sin(z * 0.035) * 2.2;
      }

      // Hole 6: Reflecting Pond Basin and Raised Island Green
      const h6 = this.holes[5];
      const distWater = Math.hypot(x - h6.waterCenter.x, z - h6.waterCenter.z);
      if (distWater < 38) {
        h -= Math.cos((distWater / 38.0) * Math.PI * 0.5) * 3.4;
        const distIsland = Math.hypot(x - h6.islandCenter.x, z - h6.islandCenter.z);
        if (distIsland < 14) {
          h += Math.cos((distIsland / 14.0) * Math.PI * 0.5) * 3.8;
        }
      }

      // Hole 7: Scarlet Bowl downhill depression (-16 ft)
      if (z <= -700 && z > -810) {
        const prog = (-700 - z) / 100.0;
        h -= prog * 4.8;
      }

      // Hole 8: Sugarloaf Summit climb (+34 ft / +10.4m rise)
      if (z <= -810 && z > -975) {
        const prog = (-810 - z) / 150.0;
        h += Math.min(1.0, Math.max(0.0, prog)) * 10.4;
      }

      // Hole 9: Red Barn Estate gentle descent
      if (z <= -975) {
        const prog = (-975 - z) / 175.0;
        h += 10.4 - prog * 5.5;
        h += Math.cos(z * 0.025) * 1.4;
      }

      return h;
    }

    // --- Pine Valley Championship Topography ---
    let h = Math.sin(x * 0.012) * Math.cos(z * 0.01) * 2.8 + Math.sin(x * 0.035 + z * 0.02) * 1.2;

    // Hole 1: Gentle downhill (-14 ft drop)
    if (z > -80 && z <= 10) {
      h -= (Math.abs(z) / 75.0) * 3.2;
    }

    // Hole 2: Uphill granite shelf climb (+11 ft rise)
    if (z < -80 && z >= -170) {
      const prog = (-80 - z) / 80.0;
      h += prog * 3.2;
    }

    // Hole 3: Spectacular cliff bluff at tee plunging to canyon floor (-39 ft drop)
    const distBluff = Math.hypot(x - 88, z - (-190));
    if (distBluff < 35) {
      h += Math.cos((distBluff / 35.0) * Math.PI * 0.5) * 8.8;
    }
    if (z < -230 && z > -320 && x < 55) {
      const t = (z - (-285)) / 45.0;
      h -= Math.exp(-t * t) * 5.2;
    }

    // Hole 4: Rolling oak knolls
    if (z < -300 && z > -460) {
      h += Math.sin(z * 0.04) * 2.0;
    }

    // Hole 6: Depressed water hazard basin and raised island green
    const h6 = this.holes[5];
    const distWater = Math.hypot(x - h6.waterCenter.x, z - h6.waterCenter.z);
    if (distWater < 40) {
      h -= Math.cos((distWater / 40.0) * Math.PI * 0.5) * 3.6;
      const distIsland = Math.hypot(x - h6.islandCenter.x, z - h6.islandCenter.z);
      if (distIsland < 14) {
        h += Math.cos((distIsland / 14.0) * Math.PI * 0.5) * 4.0;
      }
    }

    // Hole 7: Hyzer Gulch steep side-hill slope (-34 ft drop)
    if (z < -650 && z > -750) {
      h += (x + 55) * 0.08;
      h -= (-650 - z) * 0.07;
    }

    // Hole 8: Thunder Hill steep climb (+46 ft mountain ridge)
    if (z < -750 && z > -905) {
      const prog = (-750 - z) / 140.0;
      h += Math.max(0.0, Math.min(1.0, prog)) * 14.0;
    }

    // Hole 9: Rolling descent toward the clubhouse green
    if (z < -905) {
      const prog = (-905 - z) / 175.0;
      h += 14.0 - prog * 8.5;
      h += Math.cos(z * 0.03) * 1.5;
    }

    return h;
  }

  /**
   * Check if coordinates land in Out-Of-Bounds (water hazard or paved walking path)
   */
  checkOB(x, z) {
    const h6 = this.holes[5];
    if (h6 && h6.hasWaterOB) {
      const dxWater = x - h6.waterCenter.x;
      const dzWater = z - h6.waterCenter.z;
      const distWater = Math.hypot(dxWater, dzWater);

      const dxIsland = x - h6.islandCenter.x;
      const dzIsland = z - h6.islandCenter.z;
      const distIsland = Math.hypot(dxIsland, dzIsland);

      if (distWater <= h6.waterRadius && distIsland > h6.islandRadius) {
        const angle = Math.atan2(dzWater, dxWater);
        const entryX = h6.waterCenter.x + Math.cos(angle) * (h6.waterRadius + 1.5);
        const entryZ = h6.waterCenter.z + Math.sin(angle) * (h6.waterRadius + 1.5);
        const entryY = this.getTerrainHeight(entryX, entryZ);
        return {
          isOB: true,
          type: 'water',
          message: '💦 WATER HAZARD (+1 STROKE PENALTY)',
          entryPoint: new THREE.Vector3(entryX, entryY + 0.1, entryZ)
        };
      }
    }

    const h9 = this.holes[8];
    if (h9 && h9.hasPathOB) {
      const pathDistZ = Math.abs(z - h9.pathZ);
      if (pathDistZ <= 2.1 && x > -55 && x < 35) {
        const safeZ = z > h9.pathZ ? h9.pathZ + 3.2 : h9.pathZ - 3.2;
        const entryY = this.getTerrainHeight(x, safeZ);
        return {
          isOB: true,
          type: 'path',
          message: '🚶 RESORT SERVICE ROAD OB (+1 STROKE)',
          entryPoint: new THREE.Vector3(x, entryY + 0.1, safeZ)
        };
      }
    }

    return { isOB: false };
  }

  _distToLineSegment(px, pz, x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) return Math.hypot(px - x1, pz - z1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;
    return Math.hypot(px - projX, pz - projZ);
  }

  _createTerrainMesh() {
    const width = 460;
    const depth = 1260;
    const segX = 140;
    const segZ = 340;

    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -560);

    const pos = geo.attributes.position;
    const colors = [];

    const isFreezing = this.currentCourseId === 'frostPeak';
    const isAutumn = this.currentCourseId === 'mapleRidge';
    const colorFairway = isFreezing ? new THREE.Color(0xf1f5f9) : (isAutumn ? new THREE.Color(0x658238) : new THREE.Color(0x388e3c));
    const colorRough = isFreezing ? new THREE.Color(0xdbeafe) : (isAutumn ? new THREE.Color(0x8c6b32) : new THREE.Color(0x2e7d32));
    const colorRock = isFreezing ? new THREE.Color(0x64748b) : (isAutumn ? new THREE.Color(0x64748b) : new THREE.Color(0x757575));

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = this.getTerrainHeight(vx, vz);
      pos.setY(i, vy);

      let minDistToFairway = 999;
      for (const hole of this.holes) {
        const d = this._distToLineSegment(vx, vz, hole.tee.x, hole.tee.z, hole.basket.x, hole.basket.z);
        if (d < minDistToFairway) minDistToFairway = d;
      }

      if (minDistToFairway < 12) {
        colors.push(colorFairway.r, colorFairway.g, colorFairway.b);
      } else if (minDistToFairway < 22) {
        const blend = (minDistToFairway - 12) / 10;
        const r = THREE.MathUtils.lerp(colorFairway.r, colorRough.r, blend);
        const g = THREE.MathUtils.lerp(colorFairway.g, colorRough.g, blend);
        const b = THREE.MathUtils.lerp(colorFairway.b, colorRough.b, blend);
        colors.push(r, g, b);
      } else {
        if (vy > 6.5) {
          colors.push(colorRock.r, colorRock.g, colorRock.b);
        } else {
          colors.push(colorRough.r, colorRough.g, colorRough.b);
        }
      }
    }

    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: isFreezing ? 0.6 : 0.88,
      metalness: isFreezing ? 0.2 : 0.05,
      flatShading: true
    });

    const terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    this.courseGroup.add(terrainMesh);
  }

  _createWaterFeatures() {
    const h6 = this.holes[5];
    if (this.currentCourseId === 'frostPeak') {
      // In Frost Peak, water features are frozen ice sheets! Created in _createIceSheets
      return;
    }

    const waterGeo = new THREE.CircleGeometry(h6.waterRadius, 36);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.65,
      transparent: true,
      opacity: 0.85
    });

    const waterY = this.getTerrainHeight(h6.waterCenter.x, h6.waterCenter.z) + 0.85;
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(h6.waterCenter.x, waterY, h6.waterCenter.z);
    this.courseGroup.add(waterMesh);
    this.waterMeshes.push(waterMesh);

    // Footbridge to island green
    const bridgeGeo = new THREE.BoxGeometry(2.4, 0.25, 18);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const bridge = new THREE.Mesh(bridgeGeo, woodMat);
    const bridgeZ = h6.islandCenter.z + 16;
    const bridgeX = h6.islandCenter.x - 3;
    bridge.position.set(bridgeX, waterY + 0.25, bridgeZ);
    bridge.rotation.y = -0.35;
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    this.courseGroup.add(bridge);

    // Hole 9 Paved Walking Path
    const h9 = this.holes[8];
    const pathGeo = new THREE.PlaneGeometry(90, 4.2);
    pathGeo.rotateX(-Math.PI / 2);
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.9 });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    const pathY = this.getTerrainHeight(-15, h9.pathZ) + 0.08;
    pathMesh.position.set(-15, pathY, h9.pathZ);
    pathMesh.receiveShadow = true;
    this.courseGroup.add(pathMesh);
  }

  _createTerrainRibbon(points, width, color, opacity = 0.9, isClosed = true) {
    if (!points || points.length < 2) return null;
    const halfW = width * 0.5;
    const vertices = [];
    const count = points.length;

    for (let i = 0; i < count; i++) {
      const p = points[i];
      let next, prev;
      if (isClosed) {
        next = points[(i + 1) % count];
        prev = points[(i - 1 + count) % count];
      } else {
        next = i < count - 1 ? points[i + 1] : points[i];
        prev = i > 0 ? points[i - 1] : points[i];
      }

      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;

      const p1x = p.x + nx * halfW;
      const p1z = p.z + nz * halfW;
      const p1y = this.getTerrainHeight(p1x, p1z) + 0.035;

      const p2x = p.x - nx * halfW;
      const p2z = p.z - nz * halfW;
      const p2y = this.getTerrainHeight(p2x, p2z) + 0.035;

      vertices.push(p1x, p1y, p1z);
      vertices.push(p2x, p2y, p2z);
    }

    const indices = [];
    const segmentCount = isClosed ? count : count - 1;
    for (let i = 0; i < segmentCount; i++) {
      const i0 = i * 2;
      const i1 = i * 2 + 1;
      const nextIdx = (i + 1) % count;
      const i2 = nextIdx * 2;
      const i3 = nextIdx * 2 + 1;

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: opacity,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = false;
    this.courseGroup.add(mesh);
    return mesh;
  }

  _createOBStake(x, z, label) {
    const y = this.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 0.36;
    post.castShadow = true;
    group.add(post);

    const capGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.22, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.61;
    group.add(cap);

    this.courseGroup.add(group);
    return group;
  }

  _createGreenFlag(x, z, color) {
    const y = this.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.65, 6);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.y = 0.325;
    group.add(rod);

    const flagGeo = new THREE.PlaneGeometry(0.32, 0.16);
    flagGeo.translate(0.16, 0, 0);
    const flagMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, 0.50, 0);
    group.add(flag);

    this.courseGroup.add(group);
    return group;
  }

  _createGreenCircles(hole, basketY) {
    const pointsC1 = [];
    const countC1 = 48;
    for (let i = 0; i < countC1; i++) {
      const angle = (i / countC1) * Math.PI * 2;
      pointsC1.push({
        x: hole.basket.x + Math.cos(angle) * 10.0,
        z: hole.basket.z + Math.sin(angle) * 10.0
      });
    }
    const c1Color = this.currentCourseId === 'frostPeak' ? 0x38bdf8 : 0x38bdf8;
    this._createTerrainRibbon(pointsC1, 0.16, c1Color, 0.85, true);

    const angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    angles.forEach(a => {
      const fx = hole.basket.x + Math.cos(a) * 10.0;
      const fz = hole.basket.z + Math.sin(a) * 10.0;
      this._createGreenFlag(fx, fz, c1Color);
    });

    const pointsC2 = [];
    const countC2 = 64;
    for (let i = 0; i < countC2; i++) {
      const angle = (i / countC2) * Math.PI * 2;
      pointsC2.push({
        x: hole.basket.x + Math.cos(angle) * 20.0,
        z: hole.basket.z + Math.sin(angle) * 20.0
      });
    }
    const c2Color = this.currentCourseId === 'frostPeak' ? 0x0ea5e9 : 0xf59e0b;
    this._createTerrainRibbon(pointsC2, 0.14, c2Color, 0.75, true);

    angles.forEach(a => {
      const fx = hole.basket.x + Math.cos(a + 0.38) * 20.0;
      const fz = hole.basket.z + Math.sin(a + 0.38) * 20.0;
      this._createGreenFlag(fx, fz, c2Color);
    });
  }

  _createOBVisuals() {
    const h6 = this.holes[5];
    if (h6 && h6.hasWaterOB) {
      const islandBoundary = [];
      const steps = 40;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        islandBoundary.push({
          x: h6.islandCenter.x + Math.cos(a) * (h6.islandRadius + 0.15),
          z: h6.islandCenter.z + Math.sin(a) * (h6.islandRadius + 0.15)
        });
      }
      this._createTerrainRibbon(islandBoundary, 0.22, 0xffffff, 0.95, true);

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const sx = h6.islandCenter.x + Math.cos(a) * (h6.islandRadius + 0.18);
        const sz = h6.islandCenter.z + Math.sin(a) * (h6.islandRadius + 0.18);
        this._createOBStake(sx, sz, 'OB ISLAND');
      }

      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const sx = h6.waterCenter.x + Math.cos(a) * (h6.waterRadius + 0.85);
        const sz = h6.waterCenter.z + Math.sin(a) * (h6.waterRadius + 0.85);
        this._createOBStake(sx, sz, 'OB WATER');
      }
    }

    const h9 = this.holes[8];
    if (h9 && h9.hasPathOB) {
      const pathNorth = [];
      const pathSouth = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = -55 + t * 90;
        pathNorth.push({ x: px, z: h9.pathZ - 2.15 });
        pathSouth.push({ x: px, z: h9.pathZ + 2.15 });
      }
      this._createTerrainRibbon(pathNorth, 0.20, 0xffffff, 0.95, false);
      this._createTerrainRibbon(pathSouth, 0.20, 0xffffff, 0.95, false);

      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const px = -55 + t * 90;
        this._createOBStake(px, h9.pathZ - 2.25, 'OB PATH');
        this._createOBStake(px, h9.pathZ + 2.25, 'OB PATH');
      }
    }
  }

  _createHoleElements() {
    this.holes.forEach(hole => {
      // Concrete Tee Pad
      const teeY = this.getTerrainHeight(hole.tee.x, hole.tee.z);
      const teeGeo = new THREE.BoxGeometry(2.2, 0.14, 4.2);
      const teeMat = new THREE.MeshStandardMaterial({
        color: this.currentCourseId === 'frostPeak' ? 0x94a3b8 : 0xb0bec5,
        roughness: 0.85
      });
      const teePad = new THREE.Mesh(teeGeo, teeMat);
      teePad.position.set(hole.tee.x, teeY + 0.06, hole.tee.z);

      const angle = Math.atan2(hole.basket.x - hole.tee.x, hole.basket.z - hole.tee.z);
      teePad.rotation.y = angle;
      teePad.receiveShadow = true;
      this.courseGroup.add(teePad);
      this.teePads.push(teePad);

      // Tee Sign Board
      this._createTeeSign(hole, teeY, angle);

      // 3D Disc Golf Basket Target
      const basketY = this.getTerrainHeight(hole.basket.x, hole.basket.z);
      const basketGroup = this._createRealisticBasket(hole.number);
      basketGroup.position.set(hole.basket.x, basketY, hole.basket.z);
      this.courseGroup.add(basketGroup);
      this.baskets.push(basketGroup);

      // Circle 1 & 2 Turf Rings
      this._createGreenCircles(hole, basketY);
    });
  }

  _createTeeSign(hole, teeY, angle) {
    const signGroup = new THREE.Group();
    signGroup.position.set(hole.tee.x - Math.cos(angle) * 1.8, teeY, hole.tee.z + Math.sin(angle) * 1.8);

    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 0.65;
    post.castShadow = true;
    signGroup.add(post);

    const boardGeo = new THREE.BoxGeometry(0.7, 0.5, 0.05);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 1.25, 0);
    board.rotation.y = angle + Math.PI / 2;
    board.castShadow = true;
    signGroup.add(board);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 180);

    let accentColor = '#f59e0b';
    if (this.currentCourseId === 'mapleRidge') accentColor = '#f97316';
    if (this.currentCourseId === 'frostPeak') accentColor = '#38bdf8';

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 172);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`HOLE ${hole.number}`, 20, 42);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`PAR ${hole.par}`, 20, 78);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`${hole.distanceFeet} FT`, 20, 124);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`${hole.distanceMeters} METERS`, 20, 154);

    const tex = new THREE.CanvasTexture(canvas);
    const placardGeo = new THREE.PlaneGeometry(0.66, 0.46);
    const placardMat = new THREE.MeshBasicMaterial({ map: tex });
    const placard = new THREE.Mesh(placardGeo, placardMat);
    placard.position.set(0, 1.25, 0.03);
    placard.rotation.y = angle + Math.PI / 2;
    signGroup.add(placard);

    this.courseGroup.add(signGroup);
  }

  _createRealisticBasket(holeNumber) {
    const basket = new THREE.Group();

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.3
    });

    // Center Steel Pole
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.05, 12);
    const pole = new THREE.Mesh(poleGeo, steelMat);
    pole.position.y = 1.025;
    pole.castShadow = true;
    basket.add(pole);

    // Top Chain Band
    const bandGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.13, 24, 1, true);
    const bandColor = this.currentCourseId === 'frostPeak' ? 0x0284c7 : 0xef4444;
    const bandMat = new THREE.MeshStandardMaterial({
      color: bandColor,
      metalness: 0.6,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 1.62;
    band.castShadow = true;
    basket.add(band);

    const bandCapGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.02, 24);
    const bandCapMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const bandCap = new THREE.Mesh(bandCapGeo, bandCapMat);
    bandCap.position.y = 1.68;
    basket.add(bandCap);

    // Wind Pennant Flag
    const pennantGroup = new THREE.Group();
    pennantGroup.name = 'pennantFlag';
    pennantGroup.position.set(0, 1.74, 0);

    const pennantPoleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6);
    const pennantPole = new THREE.Mesh(pennantPoleGeo, steelMat);
    pennantPole.position.y = 0.18;
    pennantGroup.add(pennantPole);

    let flagColor = 0xfacc15;
    if (this.currentCourseId === 'mapleRidge') flagColor = 0xf97316;
    if (this.currentCourseId === 'frostPeak') flagColor = 0x38bdf8;

    const flagGeo = new THREE.PlaneGeometry(0.35, 0.18);
    flagGeo.translate(0.175, 0, 0);
    const flagMat = new THREE.MeshBasicMaterial({ color: flagColor, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.y = 0.26;
    pennantGroup.add(flag);
    basket.add(pennantGroup);

    // Chains
    const chainMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.95,
      roughness: 0.2
    });

    for (let c = 0; c < 14; c++) {
      const angle = (c / 14) * Math.PI * 2;
      const chainGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.58, 6);
      const chain = new THREE.Mesh(chainGeo, chainMat);
      chain.position.set(Math.cos(angle) * 0.38, 1.28, Math.sin(angle) * 0.38);
      chain.castShadow = true;
      basket.add(chain);
    }

    for (let c = 0; c < 10; c++) {
      const angle = (c / 10) * Math.PI * 2 + 0.15;
      const chainGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.52, 6);
      const chain = new THREE.Mesh(chainGeo, chainMat);
      chain.position.set(Math.cos(angle) * 0.22, 1.30, Math.sin(angle) * 0.22);
      chain.castShadow = true;
      basket.add(chain);
    }

    // Lower Tray
    const trayRimGeo = new THREE.TorusGeometry(0.48, 0.024, 10, 28);
    trayRimGeo.rotateX(Math.PI / 2);
    const trayRim = new THREE.Mesh(trayRimGeo, steelMat);
    trayRim.position.y = 0.94;
    trayRim.castShadow = true;
    basket.add(trayRim);

    const traySideGeo = new THREE.CylinderGeometry(0.48, 0.38, 0.22, 24, 1, true);
    const traySideMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: true
    });
    const traySide = new THREE.Mesh(traySideGeo, traySideMat);
    traySide.position.y = 0.83;
    traySide.castShadow = true;
    basket.add(traySide);

    const trayBottomGeo = new THREE.CylinderGeometry(0.38, 0.045, 0.05, 20);
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0x78909c,
      metalness: 0.8,
      roughness: 0.4,
      wireframe: true
    });
    const trayBottom = new THREE.Mesh(trayBottomGeo, wireMat);
    trayBottom.position.y = 0.74;
    basket.add(trayBottom);

    return basket;
  }

  _createObstacles() {
    const isAutumn = this.currentCourseId === 'mapleRidge';
    const isFreezing = this.currentCourseId === 'frostPeak';

    this.holes.forEach(hole => {
      const countTrees = hole.number === 4 ? 50 : (hole.number === 5 ? 65 : 36);
      const countBushes = hole.number === 4 ? 36 : (hole.number === 5 ? 42 : 26);
      const countRocks = (hole.number === 3 || hole.number === 4 || hole.number === 8) ? 14 : 6;

      // Trees lining fairway corridors
      for (let i = 0; i < countTrees; i++) {
        const t = Math.random();
        const centerX = THREE.MathUtils.lerp(hole.tee.x, hole.basket.x, t);
        const centerZ = THREE.MathUtils.lerp(hole.tee.z, hole.basket.z, t);

        const side = Math.random() > 0.5 ? 1 : -1;
        const offsetDist = (hole.fairwayWidth * 0.48) + (Math.random() * 24) + 2.0;

        const heading = Math.atan2(hole.basket.x - hole.tee.x, hole.basket.z - hole.tee.z);
        const perp = heading + Math.PI / 2;

        const tx = centerX + Math.cos(perp) * offsetDist * side + (Math.random() - 0.5) * 8;
        const tz = centerZ + Math.sin(perp) * offsetDist * side + (Math.random() - 0.5) * 8;

        if (!this._isObstacleLocationSafe(tx, tz, this.holes)) {
          continue;
        }

        const ty = this.getTerrainHeight(tx, tz);
        this._spawnTree(tx, ty, tz, isAutumn, isFreezing);
      }

      // Bushes / Snow Mounds
      for (let i = 0; i < countBushes; i++) {
        const t = Math.random();
        const centerX = THREE.MathUtils.lerp(hole.tee.x, hole.basket.x, t);
        const centerZ = THREE.MathUtils.lerp(hole.tee.z, hole.basket.z, t);

        const side = Math.random() > 0.5 ? 1 : -1;
        const offsetDist = (hole.fairwayWidth * 0.42) + (Math.random() * 18) + 1.5;

        const heading = Math.atan2(hole.basket.x - hole.tee.x, hole.basket.z - hole.tee.z);
        const perp = heading + Math.PI / 2;

        const bx = centerX + Math.cos(perp) * offsetDist * side + (Math.random() - 0.5) * 6;
        const bz = centerZ + Math.sin(perp) * offsetDist * side + (Math.random() - 0.5) * 6;

        if (!this._isObstacleLocationSafe(bx, bz, this.holes)) {
          continue;
        }

        const by = this.getTerrainHeight(bx, bz);
        this._spawnBush(bx, by, bz, isAutumn, isFreezing);
      }

      // Granite & Ice Boulders
      for (let i = 0; i < countRocks; i++) {
        const t = 0.2 + Math.random() * 0.75;
        const rx = THREE.MathUtils.lerp(hole.tee.x, hole.basket.x, t) + (Math.random() - 0.5) * (hole.fairwayWidth * 0.85);
        const rz = THREE.MathUtils.lerp(hole.tee.z, hole.basket.z, t) + (Math.random() - 0.5) * 10;

        if (!this._isObstacleLocationSafe(rx, rz, this.holes)) {
          continue;
        }

        const ry = this.getTerrainHeight(rx, rz);
        this._spawnRock(rx, ry, rz, isFreezing);
      }
    });
  }

  _spawnTree(x, y, z, isAutumn = false, isFreezing = false) {
    const treeVariant = Math.floor(Math.random() * 3);
    const height = 9.5 + Math.random() * 7.5;
    const trunkHeight = height * (treeVariant === 2 ? 0.52 : 0.42);
    const trunkRadius = (treeVariant === 2 ? 0.26 : 0.38) + Math.random() * 0.22;
    const canopyRadius = 2.4 + Math.random() * 1.8;

    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    let trunkColor = 0x4e342e;
    if (treeVariant === 2) trunkColor = isFreezing ? 0xe2e8f0 : 0xf3f4f6;

    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.72, trunkRadius, trunkHeight, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.95 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // Branch struts
    const branchMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    for (let b = 0; b < 3; b++) {
      const bAngle = (b / 3) * Math.PI * 2 + Math.random() * 0.5;
      const bLen = trunkRadius * 2.8;
      const branchGeo = new THREE.CylinderGeometry(trunkRadius * 0.25, trunkRadius * 0.4, bLen, 5);
      const branch = new THREE.Mesh(branchGeo, branchMat);
      branch.position.set(
        Math.cos(bAngle) * bLen * 0.4,
        trunkHeight * 0.85 + Math.random() * 0.4,
        Math.sin(bAngle) * bLen * 0.4
      );
      branch.rotation.z = Math.cos(bAngle) * 0.55;
      branch.rotation.x = Math.sin(bAngle) * 0.55;
      treeGroup.add(branch);
    }

    if (isFreezing) {
      // --- Snow-Dusted Alpine Evergreens & Frosted Birches (Frost Peak) ---
      if (treeVariant === 0 || treeVariant === 1) {
        // Coniferous Pine with heavy snow caps on each tier
        const pineColors = [0x164e3f, 0x14532d, 0x1e3a2f];
        for (let tier = 0; tier < 3; tier++) {
          const coneRadius = canopyRadius * (1.0 - tier * 0.24);
          const coneHeight = (height - trunkHeight) * 0.52;
          const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 7);
          const coneMat = new THREE.MeshStandardMaterial({
            color: pineColors[tier % pineColors.length],
            roughness: 0.85,
            flatShading: true
          });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          const tierY = trunkHeight + tier * (coneHeight * 0.58) + coneHeight * 0.5;
          cone.position.y = tierY;
          cone.castShadow = true;
          cone.receiveShadow = true;
          treeGroup.add(cone);

          // Heavy snow cap resting on top of each pine cone tier
          const snowCapGeo = new THREE.ConeGeometry(coneRadius * 1.04, coneHeight * 0.35, 7);
          const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, flatShading: true });
          const snowCap = new THREE.Mesh(snowCapGeo, snowCapMat);
          snowCap.position.y = tierY + coneHeight * 0.22;
          snowCap.castShadow = true;
          treeGroup.add(snowCap);
        }
      } else {
        // Frosted Alpine Paper Birch
        const birchMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6, flatShading: true });
        const birchGeo = new THREE.DodecahedronGeometry(canopyRadius * 0.85, 1);
        const birchFoliage = new THREE.Mesh(birchGeo, birchMat);
        birchFoliage.position.y = trunkHeight + canopyRadius * 0.95;
        birchFoliage.scale.set(0.9, 1.45, 0.9);
        birchFoliage.castShadow = true;
        birchFoliage.receiveShadow = true;
        treeGroup.add(birchFoliage);
      }
    } else if (isAutumn) {
      // --- Rich Autumn Tree Foliage (Maple Ridge) ---
      if (treeVariant === 0) {
        const mapleScarlets = [0xdc2626, 0xef4444, 0xb91c1c];
        const clusterOffsets = [
          { x: 0, y: trunkHeight + canopyRadius * 0.95, z: 0, r: canopyRadius * 0.95 },
          { x: canopyRadius * 0.45, y: trunkHeight + canopyRadius * 0.8, z: canopyRadius * 0.25, r: canopyRadius * 0.74 },
          { x: -canopyRadius * 0.4, y: trunkHeight + canopyRadius * 0.85, z: -canopyRadius * 0.3, r: canopyRadius * 0.70 },
          { x: 0, y: trunkHeight + canopyRadius * 1.4, z: 0, r: canopyRadius * 0.65 }
        ];

        clusterOffsets.forEach((c, idx) => {
          const mat = new THREE.MeshStandardMaterial({
            color: mapleScarlets[idx % mapleScarlets.length],
            roughness: 0.85,
            flatShading: true
          });
          const geo = new THREE.DodecahedronGeometry(c.r, 1);
          const cluster = new THREE.Mesh(geo, mat);
          cluster.position.set(c.x, c.y, c.z);
          cluster.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
          cluster.castShadow = true;
          cluster.receiveShadow = true;
          treeGroup.add(cluster);
        });
      } else if (treeVariant === 1) {
        const orangeColors = [0xf97316, 0xea580c, 0xf59e0b];
        const clusterOffsets = [
          { x: 0, y: trunkHeight + canopyRadius * 0.9, z: 0, r: canopyRadius * 0.92 },
          { x: canopyRadius * 0.4, y: trunkHeight + canopyRadius * 0.75, z: canopyRadius * 0.3, r: canopyRadius * 0.70 },
          { x: -canopyRadius * 0.4, y: trunkHeight + canopyRadius * 0.8, z: -canopyRadius * 0.25, r: canopyRadius * 0.68 },
          { x: 0, y: trunkHeight + canopyRadius * 1.35, z: 0, r: canopyRadius * 0.60 }
        ];

        clusterOffsets.forEach((c, idx) => {
          const mat = new THREE.MeshStandardMaterial({
            color: orangeColors[idx % orangeColors.length],
            roughness: 0.85,
            flatShading: true
          });
          const geo = new THREE.DodecahedronGeometry(c.r, 1);
          const cluster = new THREE.Mesh(geo, mat);
          cluster.position.set(c.x, c.y, c.z);
          cluster.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
          cluster.castShadow = true;
          cluster.receiveShadow = true;
          treeGroup.add(cluster);
        });
      } else {
        const birchColors = [0xfacc15, 0xfde047, 0xeab308];
        const birchMat = new THREE.MeshStandardMaterial({
          color: birchColors[Math.floor(Math.random() * birchColors.length)],
          roughness: 0.82,
          flatShading: true
        });
        const birchGeo = new THREE.DodecahedronGeometry(canopyRadius * 0.88, 1);
        const birchFoliage = new THREE.Mesh(birchGeo, birchMat);
        birchFoliage.position.y = trunkHeight + canopyRadius * 0.95;
        birchFoliage.scale.set(0.9, 1.45, 0.9);
        birchFoliage.castShadow = true;
        birchFoliage.receiveShadow = true;
        treeGroup.add(birchFoliage);
      }
    } else {
      // --- Summer Evergreen & Hardwoods (Pine Valley) ---
      if (treeVariant === 0) {
        const pineColors = [0x1b4332, 0x2d6a4f, 0x1e3a2f];
        for (let tier = 0; tier < 3; tier++) {
          const coneRadius = canopyRadius * (1.0 - tier * 0.24);
          const coneHeight = (height - trunkHeight) * 0.52;
          const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 7);
          const coneMat = new THREE.MeshStandardMaterial({
            color: pineColors[tier % pineColors.length],
            roughness: 0.85,
            flatShading: true
          });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.position.y = trunkHeight + tier * (coneHeight * 0.58) + coneHeight * 0.5;
          cone.castShadow = true;
          cone.receiveShadow = true;
          treeGroup.add(cone);
        }
      } else if (treeVariant === 1) {
        const oakColors = [0x2d6a4f, 0x386641, 0x4f772d];
        const clusterOffsets = [
          { x: 0, y: trunkHeight + canopyRadius * 0.9, z: 0, r: canopyRadius * 0.95 },
          { x: canopyRadius * 0.45, y: trunkHeight + canopyRadius * 0.75, z: canopyRadius * 0.25, r: canopyRadius * 0.72 },
          { x: -canopyRadius * 0.4, y: trunkHeight + canopyRadius * 0.8, z: -canopyRadius * 0.3, r: canopyRadius * 0.68 },
          { x: 0, y: trunkHeight + canopyRadius * 1.35, z: 0, r: canopyRadius * 0.62 }
        ];

        clusterOffsets.forEach((c, idx) => {
          const oakMat = new THREE.MeshStandardMaterial({
            color: oakColors[idx % oakColors.length],
            roughness: 0.85,
            flatShading: true
          });
          const oakGeo = new THREE.DodecahedronGeometry(c.r, 1);
          const cluster = new THREE.Mesh(oakGeo, oakMat);
          cluster.position.set(c.x, c.y, c.z);
          cluster.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
          cluster.castShadow = true;
          cluster.receiveShadow = true;
          treeGroup.add(cluster);
        });
      } else {
        const birchMat = new THREE.MeshStandardMaterial({ color: 0x52b788, roughness: 0.82, flatShading: true });
        const birchGeo = new THREE.DodecahedronGeometry(canopyRadius * 0.85, 1);
        const birchFoliage = new THREE.Mesh(birchGeo, birchMat);
        birchFoliage.position.y = trunkHeight + canopyRadius * 0.95;
        birchFoliage.scale.set(0.9, 1.45, 0.9);
        birchFoliage.castShadow = true;
        birchFoliage.receiveShadow = true;
        treeGroup.add(birchFoliage);
      }
    }

    this.courseGroup.add(treeGroup);

    this.obstacles.push({
      type: 'tree',
      x: x,
      z: z,
      baseY: y,
      trunkRadius: trunkRadius,
      trunkHeight: trunkHeight,
      canopyRadius: canopyRadius,
      totalHeight: height
    });
  }

  _spawnBush(x, y, z, isAutumn = false, isFreezing = false) {
    const radius = 0.8 + Math.random() * 0.8;
    const height = radius * (0.8 + Math.random() * 0.4);

    const bushGroup = new THREE.Group();
    bushGroup.position.set(x, y, z);

    let bushColors;
    if (isFreezing) {
      bushColors = [0xf8fafc, 0xf1f5f9, 0xe2e8f0, 0xdbeafe]; // Snow drifts
    } else if (isAutumn) {
      bushColors = [0xf59e0b, 0xea580c, 0xb45309, 0xd97706];
    } else {
      bushColors = [0x2d6a4f, 0x40916c, 0x52b788, 0x74c69d];
    }

    const clusterCount = 2 + Math.floor(Math.random() * 2);

    for (let c = 0; c < clusterCount; c++) {
      const cRadius = radius * (0.65 + Math.random() * 0.35);
      const bushGeo = new THREE.DodecahedronGeometry(cRadius, 1);
      const bushMat = new THREE.MeshStandardMaterial({
        color: bushColors[(c + Math.floor(x)) % bushColors.length],
        roughness: isFreezing ? 0.4 : 0.9,
        flatShading: true
      });
      const mesh = new THREE.Mesh(bushGeo, bushMat);
      const ox = (Math.random() - 0.5) * radius * 0.7;
      const oz = (Math.random() - 0.5) * radius * 0.7;
      mesh.position.set(ox, cRadius * 0.75, oz);
      mesh.scale.set(1.0 + Math.random() * 0.25, 0.8 + Math.random() * 0.3, 1.0 + Math.random() * 0.25);
      mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      bushGroup.add(mesh);
    }

    this.courseGroup.add(bushGroup);

    this.obstacles.push({
      type: 'bush',
      x: x,
      z: z,
      baseY: y,
      radius: radius * 1.05,
      height: height
    });
  }

  _spawnRock(x, y, z, isFreezing = false) {
    const radius = 1.2 + Math.random() * 1.5;
    const height = radius * (0.8 + Math.random() * 0.5);

    const rockGeo = new THREE.DodecahedronGeometry(radius, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: isFreezing ? 0x64748b : 0x64748b,
      roughness: isFreezing ? 0.7 : 0.9,
      metalness: isFreezing ? 0.2 : 0.1,
      flatShading: true
    });

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, y + height * 0.4, z);
    rock.scale.set(1.0 + Math.random() * 0.3, height / radius, 1.0 + Math.random() * 0.3);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.courseGroup.add(rock);

    if (isFreezing) {
      // Snow cap on top of boulder
      const snowGeo = new THREE.DodecahedronGeometry(radius * 0.95, 1);
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, flatShading: true });
      const snowMesh = new THREE.Mesh(snowGeo, snowMat);
      snowMesh.position.set(x, y + height * 0.78, z);
      snowMesh.scale.set(1.0, 0.35, 1.0);
      snowMesh.castShadow = true;
      this.courseGroup.add(snowMesh);
    }

    this.obstacles.push({
      type: 'rock',
      x: x,
      z: z,
      baseY: y,
      radius: radius * 1.1,
      height: height
    });
  }

  _createClubhouse() {
    const chGroup = new THREE.Group();
    const chZ = -1105;
    const chX = -25;
    const chY = this.getTerrainHeight(chX, chZ);
    chGroup.position.set(chX, chY, chZ);

    const lodgeGeo = new THREE.BoxGeometry(26, 8.0, 18);
    const lodgeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
    const lodge = new THREE.Mesh(lodgeGeo, lodgeMat);
    lodge.position.y = 4.0;
    lodge.castShadow = true;
    chGroup.add(lodge);

    const roofGeo = new THREE.ConeGeometry(18, 5.0, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 10.2;
    roof.scale.set(1.15, 1.0, 0.8);
    roof.castShadow = true;
    chGroup.add(roof);

    const patioGeo = new THREE.BoxGeometry(30, 0.4, 9);
    const patioMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.85 });
    const patio = new THREE.Mesh(patioGeo, patioMat);
    patio.position.set(0, 0.2, 13);
    patio.receiveShadow = true;
    chGroup.add(patio);

    this.courseGroup.add(chGroup);
  }

  _createMapleRidgeLandmarks() {
    // 1. Covered Wooden Bridge (Hole 3 Canyon)
    const bridgeGroup = new THREE.Group();
    const bX = 25;
    const bZ = -285;
    const bY = this.getTerrainHeight(bX, bZ) + 0.3;
    bridgeGroup.position.set(bX, bY, bZ);
    bridgeGroup.rotation.y = 0.45;

    const deckGeo = new THREE.BoxGeometry(4.8, 0.4, 22);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const deck = new THREE.Mesh(deckGeo, woodMat);
    deck.position.y = 0.2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    const wallGeo = new THREE.BoxGeometry(0.3, 3.2, 22);
    const redSidingMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.75 });
    const wallL = new THREE.Mesh(wallGeo, redSidingMat);
    wallL.position.set(-2.25, 1.8, 0);
    wallL.castShadow = true;
    bridgeGroup.add(wallL);

    const wallR = new THREE.Mesh(wallGeo, redSidingMat);
    wallR.position.set(2.25, 1.8, 0);
    wallR.castShadow = true;
    bridgeGroup.add(wallR);

    const roofGeo = new THREE.ConeGeometry(3.8, 1.8, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.8 });
    const bridgeRoof = new THREE.Mesh(roofGeo, roofMat);
    bridgeRoof.position.set(0, 4.0, 0);
    bridgeRoof.scale.set(1.4, 1.0, 3.5);
    bridgeRoof.castShadow = true;
    bridgeGroup.add(bridgeRoof);

    this.courseGroup.add(bridgeGroup);

    // 2. Colonial Dry-Stone Walls (Hole 4 & 5)
    const stoneWallMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95, flatShading: true });
    for (let s = 0; s < 18; s++) {
      const sx = -55 + Math.sin(s * 0.4) * 2;
      const sz = -360 - s * 12;
      const sy = this.getTerrainHeight(sx, sz);
      const wallBlockGeo = new THREE.BoxGeometry(0.8, 0.9, 10);
      const wallBlock = new THREE.Mesh(wallBlockGeo, stoneWallMat);
      wallBlock.position.set(sx, sy + 0.45, sz);
      wallBlock.rotation.y = (Math.random() - 0.5) * 0.1;
      wallBlock.castShadow = true;
      wallBlock.receiveShadow = true;
      this.courseGroup.add(wallBlock);
    }

    // 3. Historic Red Timber Barn & Silo (Hole 9 Estate Finish)
    const barnGroup = new THREE.Group();
    const barnX = -58;
    const barnZ = -1085;
    const barnY = this.getTerrainHeight(barnX, barnZ);
    barnGroup.position.set(barnX, barnY, barnZ);
    barnGroup.rotation.y = 0.25;

    const barnBodyGeo = new THREE.BoxGeometry(24, 10, 18);
    const barnMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 });
    const barnBody = new THREE.Mesh(barnBodyGeo, barnMat);
    barnBody.position.y = 5.0;
    barnBody.castShadow = true;
    barnGroup.add(barnBody);

    const barnRoofGeo = new THREE.ConeGeometry(17, 6.5, 4);
    barnRoofGeo.rotateY(Math.PI / 4);
    const barnRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const barnRoof = new THREE.Mesh(barnRoofGeo, barnRoofMat);
    barnRoof.position.y = 13.0;
    barnRoof.scale.set(1.15, 1.0, 0.82);
    barnRoof.castShadow = true;
    barnGroup.add(barnRoof);

    const doorGeo = new THREE.PlaneGeometry(6.0, 7.0);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 3.5, 9.05);
    barnGroup.add(door);

    const siloGeo = new THREE.CylinderGeometry(3.5, 3.5, 16, 16);
    const siloMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
    const silo = new THREE.Mesh(siloGeo, siloMat);
    silo.position.set(16, 8.0, -2);
    silo.castShadow = true;
    barnGroup.add(silo);

    const siloDomeGeo = new THREE.SphereGeometry(3.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const siloDomeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const siloDome = new THREE.Mesh(siloDomeGeo, siloDomeMat);
    siloDome.position.set(16, 16.0, -2);
    siloDome.castShadow = true;
    barnGroup.add(siloDome);

    this.courseGroup.add(barnGroup);

    // 4. Apple Orchard Trees on Hole 1
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    for (let row = 0; row < 6; row++) {
      const ox = (row % 2 === 0 ? 1 : -1) * 16;
      const oz = -15 - row * 10;
      const oy = this.getTerrainHeight(ox, oz);

      const treeGrp = new THREE.Group();
      treeGrp.position.set(ox, oy, oz);

      const oTrunkGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.8, 6);
      const oTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
      const oTrunk = new THREE.Mesh(oTrunkGeo, oTrunkMat);
      oTrunk.position.y = 1.4;
      treeGrp.add(oTrunk);

      const oCanopyGeo = new THREE.DodecahedronGeometry(1.8, 1);
      const oCanopyMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.85, flatShading: true });
      const oCanopy = new THREE.Mesh(oCanopyGeo, oCanopyMat);
      oCanopy.position.y = 3.2;
      treeGrp.add(oCanopy);

      for (let a = 0; a < 6; a++) {
        const appleGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const apple = new THREE.Mesh(appleGeo, appleMat);
        const aAngle = (a / 6) * Math.PI * 2;
        apple.position.set(Math.cos(aAngle) * 1.4, 2.8 + Math.random() * 0.8, Math.sin(aAngle) * 1.4);
        treeGrp.add(apple);
      }

      this.courseGroup.add(treeGrp);
    }
  }

  /**
   * Signature Landmarks for Frost Peak Ski Resort:
   * 1. High-Speed Quad Chairlift Towers & Cables
   * 2. Glossy Ice Sheets & Ice Chutes
   * 3. Hole 5 Mandatory (Mando) Tower & Drop Zone (DZ)
   * 4. Alpine Ski Chalet / Lodge & Base Terminal on Hole 9
   * 5. Slalom Racing Gates on Hole 7
   */
  _createFrostPeakLandmarks() {
    this._createIceSheets();
    this._createSkiLift();
    this._createMandoFeature();
    this._createAlpineChalet();
    this._createSlalomGates();
  }

  _createIceSheets() {
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.05,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88
    });

    const iceLocations = [
      // Hole 3: Glacial Crevasse ice pond
      { x: -12, z: -298, radiusX: 32, radiusZ: 32 },
      // Hole 4: Black Diamond Ice Chute
      { x: 65, z: -435, radiusX: 16, radiusZ: 65, rot: 0.28 },
      // Hole 5: Frozen Lake Basin (right of Mando tower)
      { x: 82, z: -572, radiusX: 28, radiusZ: 35 },
      // Hole 6: Skating Pond
      { x: 40, z: -680, radiusX: 20, radiusZ: 25 },
      // Hole 8: Summit Glacier
      { x: -48, z: -912, radiusX: 28, radiusZ: 50 },
      // Hole 9: Chalet Base Ice Rink
      { x: -32, z: -1135, radiusX: 22, radiusZ: 32 }
    ];

    iceLocations.forEach(loc => {
      const geo = new THREE.PlaneGeometry(loc.radiusX * 2, loc.radiusZ * 2, 8, 8);
      geo.rotateX(-Math.PI / 2);
      if (loc.rot) geo.rotateY(loc.rot);

      const y = this.getTerrainHeight(loc.x, loc.z) + 0.08;
      const mesh = new THREE.Mesh(geo, iceMat);
      mesh.position.set(loc.x, y, loc.z);
      mesh.receiveShadow = true;
      this.courseGroup.add(mesh);
    });
  }

  _createSkiLift() {
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.4 });

    const pylonPositions = [
      { x: 40, z: -110 },
      { x: 10, z: -170 },
      { x: -25, z: -230 },
      { x: 15, z: -380 },
      { x: 45, z: -460 },
      { x: -15, z: -1110 }
    ];

    pylonPositions.forEach((pos, idx) => {
      const y = this.getTerrainHeight(pos.x, pos.z);
      const pylonGrp = new THREE.Group();
      pylonGrp.position.set(pos.x, y, pos.z);

      // Steel tubular pylon
      const colGeo = new THREE.CylinderGeometry(0.35, 0.45, 12, 10);
      const col = new THREE.Mesh(colGeo, pylonMat);
      col.position.y = 6.0;
      col.castShadow = true;
      pylonGrp.add(col);

      // T-Bar crossarm
      const crossGeo = new THREE.BoxGeometry(6.0, 0.4, 0.5);
      const cross = new THREE.Mesh(crossGeo, pylonMat);
      cross.position.y = 11.8;
      pylonGrp.add(cross);

      // Cable pulleys
      [-2.6, 2.6].forEach(px => {
        const pulGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12);
        pulGeo.rotateZ(Math.PI / 2);
        const pul = new THREE.Mesh(pulGeo, pylonMat);
        pul.position.set(px, 11.5, 0);
        pylonGrp.add(pul);
      });

      // Hanging chairlift chair
      const chairGrp = new THREE.Group();
      chairGrp.position.set(2.6, 8.5, 0);

      const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.0, 6);
      const rod = new THREE.Mesh(rodGeo, pylonMat);
      rod.position.y = 1.5;
      chairGrp.add(rod);

      const seatGeo = new THREE.BoxGeometry(1.6, 0.15, 0.7);
      const seat = new THREE.Mesh(seatGeo, chairMat);
      seat.position.y = 0.1;
      chairGrp.add(seat);

      const backGeo = new THREE.BoxGeometry(1.6, 0.8, 0.1);
      const back = new THREE.Mesh(backGeo, chairMat);
      back.position.set(0, 0.5, -0.3);
      chairGrp.add(back);

      pylonGrp.add(chairGrp);
      this.courseGroup.add(pylonGrp);
    });
  }

  /**
   * Hole 5 Mandatory Feature:
   * Communications Tower + Flashing Illuminated Mando Arrow + Restricted Plane + Drop Zone (DZ)
   */
  _createMandoFeature() {
    const h5 = this.holes[4];
    if (!h5 || !h5.mando) return;
    const m = h5.mando;
    const mY = this.getTerrainHeight(m.x, m.z);

    const mandoGroup = new THREE.Group();
    mandoGroup.position.set(m.x, mY, m.z);

    // 1. Tall Communications Lattice Tower
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.75, roughness: 0.3 });
    const colGeo = new THREE.CylinderGeometry(0.3, 0.5, 13, 8);
    const col = new THREE.Mesh(colGeo, towerMat);
    col.position.y = 6.5;
    col.castShadow = true;
    mandoGroup.add(col);

    // Red beacon light on top
    const beaconGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 13.2;
    mandoGroup.add(beacon);

    // 2. High-Visibility Illuminated Mando Signboard
    const signBoardGeo = new THREE.BoxGeometry(2.4, 1.2, 0.12);
    const signBoardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const signBoard = new THREE.Mesh(signBoardGeo, signBoardMat);
    signBoard.position.set(0, 4.2, 0.25);
    mandoGroup.add(signBoard);

    // Canvas texture with high-contrast bold chevron arrow
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 14;
    ctx.strokeRect(8, 8, 496, 240);

    ctx.fillStyle = '#facc15';
    ctx.font = '900 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⬅ MANDO', 256, 95);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('PASS LEFT OF TOWER', 256, 160);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '24px sans-serif';
    ctx.fillText('MISSED MANDO ➜ DROP ZONE (+1)', 256, 215);

    const tex = new THREE.CanvasTexture(canvas);
    const placardGeo = new THREE.PlaneGeometry(2.3, 1.15);
    const placardMat = new THREE.MeshBasicMaterial({ map: tex });
    const placard = new THREE.Mesh(placardGeo, placardMat);
    placard.position.set(0, 4.2, 0.32);
    mandoGroup.add(placard);

    this.courseGroup.add(mandoGroup);

    // 3. Restricted Mando Boundary Laser Line on ground (from Tower towards right lake edge)
    const ribbonPoints = [
      { x: m.x, z: m.planeZ },
      { x: m.x + 12, z: m.planeZ },
      { x: m.x + 28, z: m.planeZ },
      { x: m.x + 48, z: m.planeZ }
    ];
    this._createTerrainRibbon(ribbonPoints, 0.30, 0xef4444, 0.9, false);

    // Warning stakes along the restricted plane
    for (let i = 1; i <= 4; i++) {
      const sx = m.x + i * 11;
      this._createOBStake(sx, m.planeZ, 'MANDO RESTRICTED');
    }

    // 4. Marked Drop Zone (DZ) Pad
    const dzX = m.dropZone.x;
    const dzZ = m.dropZone.z;
    const dzY = this.getTerrainHeight(dzX, dzZ);

    const dzPadGeo = new THREE.BoxGeometry(2.0, 0.12, 3.2);
    const dzPadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const dzPad = new THREE.Mesh(dzPadGeo, dzPadMat);
    dzPad.position.set(dzX, dzY + 0.05, dzZ);
    this.courseGroup.add(dzPad);

    // DZ Flag
    const dzFlagGrp = this._createGreenFlag(dzX - 1.2, dzZ, 0xfacc15);
    const dzLabelGeo = new THREE.PlaneGeometry(0.5, 0.3);
    const dzCanvas = document.createElement('canvas');
    dzCanvas.width = 128;
    dzCanvas.height = 80;
    const dzCtx = dzCanvas.getContext('2d');
    dzCtx.fillStyle = '#facc15';
    dzCtx.fillRect(0, 0, 128, 80);
    dzCtx.fillStyle = '#0f172a';
    dzCtx.font = 'bold 44px sans-serif';
    dzCtx.textAlign = 'center';
    dzCtx.fillText('DZ', 64, 56);
    const dzTex = new THREE.CanvasTexture(dzCanvas);
    const dzLabelMat = new THREE.MeshBasicMaterial({ map: dzTex, side: THREE.DoubleSide });
    const dzLabel = new THREE.Mesh(dzLabelGeo, dzLabelMat);
    dzLabel.position.set(dzX - 1.2, dzY + 1.1, dzZ);
    this.courseGroup.add(dzLabel);
  }

  _createAlpineChalet() {
    const chaletGroup = new THREE.Group();
    const chX = -45;
    const chZ = -1125;
    const chY = this.getTerrainHeight(chX, chZ);
    chaletGroup.position.set(chX, chY, chZ);
    chaletGroup.rotation.y = 0.2;

    // Main Chalet Timber Lodge
    const lodgeGeo = new THREE.BoxGeometry(26, 9.0, 18);
    const lodgeMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
    const lodge = new THREE.Mesh(lodgeGeo, lodgeMat);
    lodge.position.y = 4.5;
    lodge.castShadow = true;
    chaletGroup.add(lodge);

    // Steep Alpine A-Frame Roof covered in thick snow
    const roofGeo = new THREE.ConeGeometry(18, 7.5, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 12.0;
    roof.scale.set(1.18, 1.0, 0.82);
    roof.castShadow = true;
    chaletGroup.add(roof);

    // Stone Chimney
    const chimGeo = new THREE.BoxGeometry(1.6, 12, 1.6);
    const chimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 });
    const chim = new THREE.Mesh(chimGeo, chimMat);
    chim.position.set(8.0, 8.0, 0);
    chaletGroup.add(chim);

    // Outdoor Ski Racks
    for (let r = -2; r <= 2; r++) {
      const rackGeo = new THREE.BoxGeometry(0.12, 1.6, 2.4);
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(16, 0.8, r * 2.8);
      chaletGroup.add(rack);
    }

    this.courseGroup.add(chaletGroup);
  }

  _createSlalomGates() {
    const h7 = this.holes[6];
    if (!h7) return;

    for (let g = 0; g < 6; g++) {
      const t = 0.15 + (g / 6) * 0.7;
      const gx = THREE.MathUtils.lerp(h7.tee.x, h7.basket.x, t) + (g % 2 === 0 ? 6 : -6);
      const gz = THREE.MathUtils.lerp(h7.tee.z, h7.basket.z, t);
      const gy = this.getTerrainHeight(gx, gz);

      const color = g % 2 === 0 ? 0xef4444 : 0x0284c7;

      const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(gx, gy + 1.1, gz);
      pole.castShadow = true;
      this.courseGroup.add(pole);

      const flagGeo = new THREE.PlaneGeometry(0.5, 0.35);
      flagGeo.translate(0.25, 0, 0);
      const flagMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(gx, gy + 1.8, gz);
      this.courseGroup.add(flag);
    }
  }
}

window.DiscGolfCourse = DiscGolfCourse;

/**
 * Aerodynamics module for EUC+rider system.
 *
 * 2D potential flow (inviscid) for streamline / pressure visualization.
 * Uses doublet superposition over cylindrical body approximation (side view).
 *
 * Important note: inviscid potential flow has zero drag (D'Alembert's paradox).
 * Actual drag is computed separately from empirical CdA data.
 * The flow visualization shows pressure topology — where separation WOULD occur
 * and how wake size correlates with posture.
 */

export const RHO   = 1.225   // kg/m³ air density (sea level, 15 °C)
export const G     = 9.81    // m/s²
export const CRR   = 0.010   // rolling resistance coefficient (good asphalt)

// ---------------------------------------------------------------------------
// Rider body model
// ---------------------------------------------------------------------------

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/**
 * Build simplified rider body as array of cylinders for 2D potential flow.
 *
 * Coordinate system (side view, rider facing left = into the wind):
 *   x = forward direction of travel (positive = forward / into wind)
 *   y = vertical (positive = up), ground at y = 0
 *
 * Returns array of { x, y, r, label } in metres.
 *
 * @param {number} leanDeg     Forward lean of whole body (0 = upright, 25 = aggressive)
 * @param {number} crouchFactor  0 = upright, 1 = full tuck (hip flex + chin down)
 * @param {number} heightM     Rider height in metres (default 1.75)
 */
export function riderCylinders(leanDeg = 0, crouchFactor = 0, heightM = 1.75) {
  const θ = (leanDeg * Math.PI) / 180
  const scale = heightM / 1.75
  const crouchFlex = crouchFactor * 0.28  // extra hip forward flex (rad)

  // Segment lengths scaled to rider height
  const shinL   = 0.43 * scale
  const thighL  = 0.41 * scale
  const torsoL  = 0.52 * scale

  // Fixed ankle position (above pedal)
  const ankle = [0, 0.344 * scale]

  // Joint positions computed from lean angle
  const knee = [
    ankle[0] + shinL * Math.sin(θ),
    ankle[1] + shinL * Math.cos(θ),
  ]
  const hip = [
    knee[0] + thighL * Math.sin(θ + 0.04),
    knee[1] + thighL * Math.cos(θ + 0.04),
  ]
  // Torso angles more upright than legs, crouch adds forward flex
  const torsoAngle = θ * 0.52 + crouchFlex
  const shoulder = [
    hip[0] + torsoL * Math.sin(torsoAngle),
    hip[1] + torsoL * Math.cos(torsoAngle),
  ]
  const headAngle = torsoAngle * 0.62
  const headC = [
    shoulder[0] + 0.17 * scale * Math.sin(headAngle),
    shoulder[1] + 0.17 * scale * Math.cos(headAngle),
  ]
  // Arms hang forward, increasingly so when tucked
  const armAng = torsoAngle + 1.25 + crouchFactor * 0.5
  const elbowC = [
    shoulder[0] + 0.29 * scale * Math.sin(armAng),
    shoulder[1] - 0.29 * scale * Math.cos(armAng) * 0.55,
  ]

  const s = 0.95 * scale  // radius scale factor

  return [
    // EUC: wheel + shell
    { x: 0,          y: 0.254,                            r: 0.254,      label: 'Колесо'  },
    { x: 0.07,       y: 0.44,                             r: 0.09 * s,   label: 'Корпус'  },

    // Rider lower body
    { x: ankle[0] + 0.06, y: ankle[1] - 0.02,            r: 0.043 * s,  label: 'Стопа'   },
    { ...xy(lerp(ankle, knee, 0.32)),                      r: 0.051 * s,  label: 'Голень'  },
    { ...xy(lerp(ankle, knee, 0.70)),                      r: 0.057 * s,  label: 'Голень'  },
    { ...xy(knee),                                         r: 0.063 * s,  label: 'Колено'  },
    { ...xy(lerp(knee, hip, 0.38)),                        r: 0.071 * s,  label: 'Бедро'   },
    { ...xy(lerp(knee, hip, 0.74)),                        r: 0.074 * s,  label: 'Бедро'   },

    // Rider upper body
    { ...xy(hip),                                          r: 0.115 * s,  label: 'Таз'     },
    { ...xy(lerp(hip, shoulder, 0.34)),                    r: 0.126 * s,  label: 'Торс'    },
    { ...xy(lerp(hip, shoulder, 0.70)),                    r: 0.112 * s,  label: 'Торс'    },
    { ...xy(shoulder),                                     r: 0.096 * s,  label: 'Плечо'   },
    { ...xy(headC),                                        r: 0.099 * s,  label: 'Голова'  },
    { ...xy(elbowC),                                       r: 0.037 * s,  label: 'Рука'    },
  ]
}

const xy = ([x, y]) => ({ x, y })

// ---------------------------------------------------------------------------
// Potential flow
// ---------------------------------------------------------------------------

/**
 * Velocity field at (wx, wy) from uniform flow U0 + doublet superposition.
 * Each cylinder contributes a doublet perturbation.
 *
 * Returns { u, v } — velocity components (m/s).
 * Returns { u:0, v:0 } for points inside any cylinder.
 */
export function flowVelocity(wx, wy, cylinders, U0 = 1) {
  let u = U0, v = 0
  for (const c of cylinders) {
    const dx = wx - c.x
    const dy = wy - c.y
    const r2 = dx * dx + dy * dy
    if (r2 < c.r * c.r * 0.09) return { u: 0, v: 0 }
    const R2 = c.r * c.r
    const r4 = r2 * r2
    u += U0 * R2 * (dy * dy - dx * dx) / r4
    v -= 2 * U0 * R2 * dx * dy / r4
  }
  return { u, v }
}

/** Pressure coefficient: Cp = 1 − |V|²/U0² */
export function pressureCoeff(u, v, U0) {
  return 1 - (u * u + v * v) / (U0 * U0)
}

// ---------------------------------------------------------------------------
// Empirical aerodynamics
// ---------------------------------------------------------------------------

/**
 * Estimate CdA (m²) for EUC + rider from posture.
 *
 * Based on cycling / motorcycle literature adapted for standing EUC rider:
 *   upright    CdA ≈ 0.45 m²
 *   full tuck  CdA ≈ 0.26 m²
 *
 * leanDeg reduces frontal projection area.
 * crouchFactor additionally reduces both area and form drag.
 */
export function estimateCdA(leanDeg, crouchFactor, heightM = 1.75) {
  const base   = 0.45
  const leanEffect  = 0.0055 * leanDeg        // ~0.14 m² at 25°
  const crouchEffect = 0.115 * crouchFactor   // ~0.115 m² at full tuck
  const heightScale  = (heightM / 1.75) ** (2/3)
  return Math.max(0.19, (base - leanEffect - crouchEffect) * heightScale)
}

// ---------------------------------------------------------------------------
// Motor + drag force models
// ---------------------------------------------------------------------------

/**
 * Peak motor drive force at the contact patch (N).
 * Piecewise: constant torque → constant power above corner speed.
 */
export function motorForce(speedMs, opts = {}) {
  const {
    peakTorqueNm = 80,
    peakPowerW   = 8000,
    wheelR       = 0.254,
  } = opts
  if (speedMs < 0.5) return peakTorqueNm / wheelR
  const cornerSpeed = (peakPowerW * wheelR) / peakTorqueNm
  if (speedMs <= cornerSpeed) return peakTorqueNm / wheelR
  return peakPowerW / speedMs
}

/** Aerodynamic drag force (N) */
export const aeroDrag = (speedMs, CdA) =>
  0.5 * RHO * CdA * speedMs * speedMs

/** Rolling resistance (N) */
export const rollingResist = (massKg, crr = CRR) =>
  crr * massKg * G

/** Total opposing force (N) */
export const totalDrag = (speedMs, CdA, massKg) =>
  aeroDrag(speedMs, CdA) + rollingResist(massKg)

/**
 * Physics-limited top speed (m/s): where P_motor = F_drag × v.
 * Note: real EUC top speed is firmware-limited (tilt-back) at a lower value.
 */
export function physicsVmax(CdA, massKg, peakPowerW = 8000, crr = CRR) {
  const Froll = rollingResist(massKg, crr)
  for (let v = 0.5; v < 90; v += 0.05) {
    const Fdrag = 0.5 * RHO * CdA * v * v + Froll
    if (Fdrag * v >= peakPowerW) return v
  }
  return 90
}

/**
 * Max lean-limited acceleration (m/s²).
 * The rider sets the acceleration demand by leaning — physics limit is tan(θ)×g.
 */
export const leanAccel = (leanDeg) =>
  G * Math.tan((leanDeg * Math.PI) / 180)

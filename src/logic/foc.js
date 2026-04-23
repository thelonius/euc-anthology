/**
 * FOC Transformation Library
 * Implements Clarke and Park transforms for Field Oriented Control
 */

export const clarke = (ia, ib, ic) => {
    // ia + ib + ic = 0
    const alpha = ia;
    const beta = (ia + 2 * ib) / Math.sqrt(3);
    return { alpha, beta };
};

export const park = (alpha, beta, angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const d = alpha * cos + beta * sin;
    const q = -alpha * sin + beta * cos;
    return { d, q };
};

export const invPark = (d, q, angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const alpha = d * cos - q * sin;
    const beta = d * sin + q * cos;
    return { alpha, beta };
};

export const invClarke = (alpha, beta) => {
    const a = alpha;
    const b = -0.5 * alpha + (Math.sqrt(3) / 2) * beta;
    const c = -0.5 * alpha - (Math.sqrt(3) / 2) * beta;
    return { a, b, c };
};

export const getModulationIndex = (vd, vq, vbat) => {
    return Math.sqrt(vd * vd + vq * vq) / vbat;
};

// Simple motor physics integration
export class Motor {
    constructor() {
        this.angle = 0;
        this.omega = 0;
        this.torque = 0;
        this.inertia = 0.5;
        this.friction = 0.05;
    }

    update(dt, iq) {
        this.torque = iq * 0.1; // Simple kt
        const acceleration = (this.torque - this.omega * this.friction) / this.inertia;
        this.omega += acceleration * dt;
        this.angle += this.omega * dt;
        while (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
        while (this.angle < 0) this.angle += Math.PI * 2;
    }
}

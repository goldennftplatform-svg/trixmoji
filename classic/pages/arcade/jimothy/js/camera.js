/**
 * Smooth GTA-style third-person orbit camera.
 * Mouse orbits 360°; position eases so motion never feels choppy.
 */
(function (global) {
  "use strict";

  function FollowCamera(camera) {
    this.camera = camera;
    this.yaw = Math.PI * 0.15;
    this.pitch = 0.32;
    this.dist = 7.2;
    this.minDist = 3.2;
    this.maxDist = 16;
    this.lookH = 1.15;
    this.minPitch = 0.06;
    this.maxPitch = 1.2;
    this._shake = 0;
    // Smoothed state
    this._cx = 0;
    this._cy = 4;
    this._cz = 8;
    this._lx = 0;
    this._ly = 1.15;
    this._lz = 0;
    this._ready = false;
    this.follow = 14; // higher = snappier, still smooth
    this.lookFollow = 16;
  }

  FollowCamera.prototype.addLook = function (dyaw, dpitch) {
    this.yaw += dyaw;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dpitch));
  };

  FollowCamera.prototype.addZoom = function (delta) {
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist + delta));
  };

  FollowCamera.prototype.snapTo = function (tx, ty, tz) {
    const pitch = this.pitch;
    const yaw = this.yaw;
    const dist = this.dist;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    this._cx = tx + Math.sin(yaw) * dist * cp;
    this._cy = ty + this.lookH + dist * sp * 0.85 + 1.25;
    this._cz = tz + Math.cos(yaw) * dist * cp;
    this._lx = tx;
    this._ly = ty + this.lookH;
    this._lz = tz;
    this._ready = true;
    this.camera.position.set(this._cx, this._cy, this._cz);
    this.camera.lookAt(this._lx, this._ly, this._lz);
  };

  /**
   * Smooth sphere-orbit around target (GTA third person).
   */
  FollowCamera.prototype.update = function (dt, tx, ty, tz) {
    const pitch = this.pitch;
    const yaw = this.yaw;
    const dist = this.dist + this._shake * 0.12;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);

    const wantX = tx + Math.sin(yaw) * dist * cp;
    const wantY = ty + this.lookH + dist * sp * 0.85 + 1.25;
    const wantZ = tz + Math.cos(yaw) * dist * cp;
    const wantLx = tx;
    const wantLy = ty + this.lookH;
    const wantLz = tz;

    if (!this._ready) {
      this._cx = wantX;
      this._cy = wantY;
      this._cz = wantZ;
      this._lx = wantLx;
      this._ly = wantLy;
      this._lz = wantLz;
      this._ready = true;
    } else {
      // Exponential ease — framerate-independent smooth follow
      const k = 1 - Math.exp(-dt * this.follow);
      const kl = 1 - Math.exp(-dt * this.lookFollow);
      this._cx += (wantX - this._cx) * k;
      this._cy += (wantY - this._cy) * k;
      this._cz += (wantZ - this._cz) * k;
      this._lx += (wantLx - this._lx) * kl;
      this._ly += (wantLy - this._ly) * kl;
      this._lz += (wantLz - this._lz) * kl;
    }

    this.camera.position.set(this._cx, this._cy, this._cz);
    this.camera.lookAt(this._lx, this._ly, this._lz);

    if (this._shake > 0) this._shake = Math.max(0, this._shake - dt * 8);
  };

  FollowCamera.prototype.shake = function (amt) {
    this._shake = Math.max(this._shake, amt || 1);
  };

  global.JIMPTHY_FollowCamera = FollowCamera;
})(window);

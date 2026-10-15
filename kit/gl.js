'use strict';
// Thin WebGL2 helpers: programs with reflected uniform setters, render targets.

function glCreateShader(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = src.split('\n').map((l, i) => `${String(i + 1).padStart(3)}| ${l}`).join('\n');
    console.error(`[${label}] shader compile error:\n${log}\n${numbered}`);
    throw new Error(`Shader compile failed: ${label}: ${log}`);
  }
  return sh;
}

// Creates a program and returns {prog, set(uniforms), use()}. Uniform setters are
// generated from the program's active uniforms, so callers pass plain values.
function glProgram(gl, vs, fs, label = 'prog') {
  const prog = gl.createProgram();
  gl.attachShader(prog, glCreateShader(gl, gl.VERTEX_SHADER, vs, label + ':vs'));
  gl.attachShader(prog, glCreateShader(gl, gl.FRAGMENT_SHADER, fs, label + ':fs'));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${label}: ${gl.getProgramInfoLog(prog)}`);
  }
  const setters = {};
  let texUnit = 0;
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/, '');
    const loc = gl.getUniformLocation(prog, info.name);
    switch (info.type) {
      case gl.FLOAT: setters[name] = info.size > 1 ? (v) => gl.uniform1fv(loc, v) : (v) => gl.uniform1f(loc, v); break;
      case gl.FLOAT_VEC2: setters[name] = (v) => gl.uniform2fv(loc, v); break;
      case gl.FLOAT_VEC3: setters[name] = (v) => gl.uniform3fv(loc, v); break;
      case gl.FLOAT_VEC4: setters[name] = (v) => gl.uniform4fv(loc, v); break;
      case gl.INT: case gl.BOOL: setters[name] = (v) => gl.uniform1i(loc, v); break;
      case gl.FLOAT_MAT4: setters[name] = (v) => gl.uniformMatrix4fv(loc, false, v); break;
      case gl.SAMPLER_2D: {
        const unit = texUnit++;
        setters[name] = (tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
        break;
      }
      default: console.warn('unhandled uniform type', name, info.type);
    }
  }
  return {
    prog,
    use() { gl.useProgram(prog); return this; },
    set(u) {
      for (const k in u) { const s = setters[k]; if (s) s(u[k]); }
      return this;
    },
  };
}

// Render target with a single color texture.
function glTarget(gl, w, h, { float = true, linear = true } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const canFloat = float && gl.__hasFloat;
  gl.texImage2D(gl.TEXTURE_2D, 0, canFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, canFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  const filt = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}
function glDeleteTarget(gl, t) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
}

// Instanced quad batch: a static unit quad plus a growable per-instance buffer.
// `layout` is a list of [location, size] for per-instance attributes.
class InstanceBatch {
  constructor(gl, layout, corners) {
    this.gl = gl;
    this.stride = layout.reduce((s, l) => s + l[1], 0);
    this.cap = 4096;
    this.data = new Float32Array(this.cap * this.stride);
    this.count = 0;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(corners), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    let off = 0;
    for (const [loc, size] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, this.stride * 4, off * 4);
      gl.vertexAttribDivisor(loc, 1);
      off += size;
    }
    gl.bindVertexArray(null);
    this.ibBytes = this.data.byteLength;
  }
  // Reserve room for one instance and return its float offset.
  alloc() {
    if (this.count >= this.cap) {
      this.cap *= 2;
      const d = new Float32Array(this.cap * this.stride);
      d.set(this.data);
      this.data = d;
    }
    return this.count++ * this.stride;
  }
  draw() {
    const gl = this.gl;
    if (!this.count) return;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
    const bytes = this.count * this.stride * 4;
    if (bytes > this.ibBytes) {
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      this.ibBytes = this.data.byteLength;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * this.stride);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
    this.count = 0;
  }
}

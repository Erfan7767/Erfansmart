import { useEffect, useRef } from 'react';

/*
 * Animated WebGL "plasma waves" background, adapted from the MIT-licensed
 * 21st.dev community shader component. See CREDITS.md for attribution.
 */
const vertexShader = `
attribute vec2 aVertexPosition;
void main(){ gl_Position=vec4(aVertexPosition,0.0,1.0); }
`;
const fragmentShader = `
precision highp float;
uniform vec2 iResolution;
uniform float iFlow;
uniform float iVoiceIntensity;
float randomWave(float t){ return (cos(t)+cos(t*1.3+1.3)+cos(t*1.4+1.4))/3.0; }
float line(float d,float w){ return 1.0-smoothstep(0.0,w,abs(d)); }
void main(){
 vec2 uv=gl_FragCoord.xy/iResolution.xy;
 vec2 p=(gl_FragCoord.xy-iResolution.xy*.5)/iResolution.x*10.0;
 float fade=1.0-(cos(uv.x*6.283)*.5+.5);
 p.y+=randomWave(p.x*.4+iFlow*.033)*1.6*(.5+fade);
 p.x+=randomWave(p.y*.4+iFlow*.033+2.0)*1.6*fade;
 vec3 bg=mix(vec3(.004,.013,.024),vec3(.009,.032,.046),smoothstep(.08,.8,length(uv-vec2(.5,.48))));
 float alpha=0.0;
 vec3 wave=vec3(0.0);
 for(int i=0;i<10;i++){
   float fi=float(i);
   float offset=randomWave(fi+p.x*.45+iFlow*.05)*mix(.7,2.4,fade);
   float pos=randomWave(p.x*.14+iFlow*.11)*(.65*(1.0+iVoiceIntensity*1.2))+offset;
   float width=mix(.025,.16,randomWave(fi+p.x*.5+iFlow*.08)*.5+.5);
   float stroke=line(p.y-pos,width)*(.22+fade*.45);
   vec3 tint=mix(vec3(.025,.2,.28),vec3(.04,.36,.42),uv.y);
   wave+=tint*stroke;
 }
 gl_FragColor=vec4(bg+wave,1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Erfan ambient shader could not compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function ShaderBackground({ opacity = .12, voiceActive = false }: { opacity?: number; voiceActive?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speakingRef = useRef(voiceActive);
  useEffect(() => { speakingRef.current = voiceActive; }, [voiceActive]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aVertexPosition');
    const resolution = gl.getUniformLocation(program, 'iResolution');
    const flow = gl.getUniformLocation(program, 'iFlow');
    const voice = gl.getUniformLocation(program, 'iVoiceIntensity');
    let frame = 0;
    let start = performance.now();
    let active = true;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };
    resize();
    const render = (now: number) => {
      if (!active) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(position);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(flow, (now - start) / 1000);
      gl.uniform1f(voice, speakingRef.current ? .75 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    window.addEventListener('resize', resize);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none' }} />;
}

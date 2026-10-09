import * as THREE from "../node_modules/three/build/three.module.js";
export function procedural(kind) {
  const uniforms = {
    time: { value: 0 },
    energy: { value: 0 },
    bass: { value: 0 },
    mode: { value: 1 },
    aspect: { value: 1 },
    deform: { value: 1 },
    palette: { value: 0 },
    first: { value: new THREE.Color("#65dbc6") },
    second: { value: new THREE.Color("#a674ec") },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:
      "varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `
 precision highp float;varying vec2 uv0;uniform float time,energy,bass,mode,aspect,deform,palette;uniform vec3 first,second;
 vec2 hash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 vec3 rainbow(float h){return .55+.45*cos(6.28318*(h+vec3(0.,.33,.67)));}
 void main(){vec2 p=(uv0-.5)*vec2(aspect,1.)*5.;float t=time*.35;float f=0.;
 ${
   kind === "cells"
     ? `vec2 g=floor(p),v=fract(p);float d1=10.,d2=10.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 seed=hash(g+o);vec2 pos=o+.5+.4*sin(t+6.28318*seed)-v;float d=length(pos);if(d<d1){d2=d1;d1=d;}else d2=min(d2,d);}f=exp(-abs(d2-d1)*(25.-energy*10.))+exp(-d1*12.)*.4;`
     : kind === "blobs"
       ? `float field=0.;for(int i=0;i<7;i++){float a=float(i)*2.3999;vec2 pos=vec2(sin(t*.8+a),cos(t*.6+a*1.3))*1.6;field+=(.13+bass*.15)/max(.035,dot(p-pos,p-pos));}f=smoothstep(.65,.85,field)+exp(-abs(field-.7)*14.)*.7;`
       : kind === "kaleidoscope"
         ? `float r=length(p);float a=atan(p.y,p.x);a=abs(mod(a+.2618,.5236)-.2618);vec2 q=vec2(cos(a),sin(a))*r;float z=sin(q.x*6.+t*3.)*cos(q.y*12.-t)+sin(r*9.-t*2.);f=exp(-abs(z)*(8.-energy*3.))*(.5+.5*sin(r*2.-t))+exp(-abs(r-(1.+bass))*14.);`
         : `float z=sin(p.x*2.+t)+sin(p.y*3.-t*1.2)+sin(length(p)*4.-t)+cos((p.x+p.y)*2.+t*.5);f=exp(-abs(sin(z*deform+energy*2.))*12.);`
 }
 f=clamp(f,0.,1.5);vec3 color=palette>.5?mix(first,second,.5+.5*sin(length(p)-t)):rainbow(length(p)*.16+t*.05);if(mod(mode,2.)<.5)color=vec3(1.);vec3 outColor=mode<2.?color*f:mix(vec3(.95),color*.35,clamp(f,0.,1.));gl_FragColor=vec4(outColor,1.);}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

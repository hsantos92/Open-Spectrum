// Bloom can make intermediate targets opaque. Recover coverage from the final
// light intensity so empty pixels remain clear and the glow keeps its color.
export const alphaOutputShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main(){
      vec3 linearColor=max(texture2D(tDiffuse,vUv).rgb,vec3(0.));
      vec3 color=vec3(1.)-exp(-linearColor*1.15);
      float coverage=clamp(max(color.r,max(color.g,color.b))*1.25,0.,1.);
      gl_FragColor=coverage<.005?vec4(0.):vec4(color/max(coverage,.001),coverage);
    }`,
};

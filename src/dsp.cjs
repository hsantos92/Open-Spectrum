'use strict';
function spectrum(samples, rate=48000) {
  const n=samples.length, re=new Float64Array(n), im=new Float64Array(n);
  let rms=0;
  for(let i=0;i<n;i++){rms+=samples[i]*samples[i];re[i]=samples[i]*(0.5-0.5*Math.cos(2*Math.PI*i/(n-1)));}
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
  for(let len=2;len<=n;len*=2){for(let i=0;i<n;i+=len){for(let j=0;j<len/2;j++){const a=-2*Math.PI*j/len,c=Math.cos(a),s=Math.sin(a),k=i+j,h=k+len/2,tr=re[h]*c-im[h]*s,ti=re[h]*s+im[h]*c;re[h]=re[k]-tr;im[h]=im[k]-ti;re[k]+=tr;im[k]+=ti;}}}
  const bins=new Array(96).fill(0);
  for(let b=0;b<96;b++){const lo=Math.max(1,Math.floor(30*Math.pow(600,b/96)*n/rate)),hi=Math.min(n/2,Math.max(lo+1,Math.ceil(30*Math.pow(600,(b+1)/96)*n/rate)));let v=0;for(let k=lo;k<hi;k++)v=Math.max(v,Math.hypot(re[k],im[k])*4/n);bins[b]=Math.min(1,Math.log1p(v*40)/Math.log(41));}
  return {bins,rms:Math.sqrt(rms/n)};
}
class PCMFrames {
  constructor(onFrame,size=2048){this.pending=Buffer.alloc(0);this.size=size;this.onFrame=onFrame;}
  push(chunk){this.pending=Buffer.concat([this.pending,chunk]);const bytes=this.size*4;while(this.pending.length>=bytes){const samples=new Float32Array(this.size);for(let i=0;i<this.size;i++){const x=this.pending.readFloatLE(i*4);samples[i]=Number.isFinite(x)?x:0;}this.pending=this.pending.subarray(bytes);this.onFrame(samples);}}
}
module.exports={spectrum,PCMFrames};

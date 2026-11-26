import { finishU2 } from './u2-finish.ts';

/** Adapt the established Sticker preset using the already-computed BiSeNet regions.
 * Red=hair/hat, green=facial features, blue=outer edge. Preserve head alpha.
 * Never synthesize features. Unknown areas and unreliable region maps fall back
 * to Sticker. Hair can only lose ink, detail can only gain supported ink.
 */
export function finishAdaptive(
  rgba: Uint8ClampedArray, w: number, h: number, regions: Uint8ClampedArray | null,
  cutoff = 180, thickness = 0, hairRelief = 1, detailStrength = 1,
): Uint8ClampedArray {
  const base = finishU2(rgba, w, h, 'sticker', cutoff, thickness);
  if (!regions || regions.length !== rgba.length) return base;
  const n = w * h;
  const hair = Math.max(0, Math.min(2, hairRelief));
  const detail = Math.max(0, Math.min(2, detailStrength));
  if (!hair && !detail) return base;
  const gray = new Float32Array(n);
  for (let i=0;i<n;i++) {
    const p=i*4, a=rgba[p+3]/255;
    gray[i]=(0.299*rgba[p]+0.587*rgba[p+1]+0.114*rgba[p+2])*a+255*(1-a);
  }
  // Stronger hair relief lowers the cutoff only in classified hair.
  // Keep the dark core of each stroke and preserve the natural silhouette.
  const hairInk = hair ? finishU2(rgba,w,h,'sticker',Math.max(90,cutoff-15*hair),0) : base;
  const out = new Uint8ClampedArray(base);
  const supportedLimit=Math.min(245,Math.max(30,cutoff+28+12*detail));
  for (let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=y*w+x,p=i*4;
    if(base[p+3]!==255 || regions[p+2]>=128) continue;
    if(regions[p]>=128) {
      if(hair && hairInk[p]===255) out[p]=out[p+1]=out[p+2]=255;
      continue;
    }
    if(!detail || regions[p+1]<128 || base[p]===0 || gray[i]>=supportedLimit) continue;
    let light=gray[i], blackNeighbor=false, blackCount=0;
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-2,0],[2,0],[0,-2],[0,2]]) {
      const nx=x+dx,ny=y+dy;
      if(nx<0||nx>=w||ny<0||ny>=h) continue;
      const j=ny*w+nx;
      if(base[j*4+3]!==255) continue;
      light=Math.max(light,gray[j]);
      if(Math.abs(dx)+Math.abs(dy)===1 && base[j*4]===0) {blackNeighbor=true;blackCount++;}
    }
    // Don't fill tiny white gaps enclosed by ink (eye highlights, teeth).
    if(blackNeighbor && blackCount<3 && light-gray[i]>=Math.max(8,24-6*detail)) out[p]=out[p+1]=out[p+2]=0;
  }
  return out;
}

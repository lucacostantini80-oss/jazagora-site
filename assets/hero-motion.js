/* Jazagora hero motion. Approved original raster layers, prepared before deployment. */
(() => {
  'use strict';
  const W = 1280, H = 720, CX = 424, CY = 366;
  const RING_SCALE = 1;
  const CIRCLE_PERIOD = 52;
  const WAVE_SPEED = 1.56;
  const WORDMARK_RECT = {x:680,y:328,w:560,h:88};
  const BAR_OPACITY = { 'frequency-left': 1, 'frequency-middle': 1, 'frequency-top': 1, 'frequency-bottom': 1, 'frequency-right-top': 1, 'frequency-right-bottom': 1 };
  const art = document.querySelector('.hero-art');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const assetBase = new URL("hero-motion/", document.currentScript.src);
  const originalURL = new URL("jazagora-universe-hero.webp", document.currentScript.src).href;
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const smooth = (lo, hi, v) => { const n = clamp((v-lo)/(hi-lo)); return n*n*(3-2*n); };
  const makeCanvas = (w = W, h = H) => { const c = document.createElement('canvas'); c.width=w; c.height=h; return c; };
  const load = src => new Promise((resolve, reject) => { const img = new Image(); img.onload=()=>resolve(img); img.onerror=()=>reject(new Error('Asset unavailable: '+src)); img.src=src; });
  // Coordinates measured on the 1280x720 original, not newly drawn replacements.
  const groups = [
    {key:'frequency-left', phase:0, bars:[
      [143,352,10,27],[161,324,11,91],[178,352,11,28],[194,337,11,55],
      [212,309,11,112],[230,274,12,183],[249,307,11,114],
      [266,323,11,84],[283,341,11,49],[300,352,11,27]]},
    {key:'frequency-middle', phase:1.2, bars:[
      [529,352,11,28],[547,344,11,42],[565,330,11,69],
      [583,307,12,111],[601,344,11,44],[618,334,11,69],[636,352,11,29]]},
    {key:'frequency-top', phase:.6, bars:[[400,185,9,53],[420,151,12,89],[439,180,10,59]]},
    {key:'frequency-bottom', phase:2.1, bars:[[399,486,11,68],[419,486,12,85],[440,486,11,59]]},
    {key:'frequency-right-top', phase:2.8, bars:[
      [793,266,9,37],[811,280,9,33],[830,239,10,74],[848,265,9,53],
      [864,221,10,97],[882,272,9,51],[891,251,8,61],[905,206,12,108],
      [923,246,10,65],[940,257,10,52],[955,281,9,36]]},
    {key:'frequency-right-bottom', phase:3.3, bars:[
      [793,445,9,40],[810,430,9,90],[829,448,10,115],
      [848,448,9,75],[865,434,11,143],[882,430,9,112],
      [904,416,12,147],[923,431,10,103],[940,438,10,81]]}
  ];
  const allBars = groups.flatMap(group => group.bars);
  let elapsed=0, last=0, playing=!reduced.matches, originalMode=false, ready=false, inView=true, raf=0;
  const bg = makeCanvas(); bg.className='motion-background'; bg.setAttribute('aria-hidden','true');
  const fg = makeCanvas(); fg.className='motion-foreground'; fg.setAttribute('aria-hidden','true');
  const ctx = fg.getContext('2d');
  art.append(bg,fg);
  function barTexture(original, bar) {
    const [x,y,w,h] = bar;
    const c=makeCanvas(w,h), cctx=c.getContext('2d');
    cctx.beginPath(); cctx.roundRect(0,0,w,h,Math.min(5,w/2)); cctx.clip();
    // Preserve the complete vertical shading and exact source RGB values.
    // Fixed texture coordinates during animation also keep captured ribbon
    // intersections at their original height, instead of stretching them.
    cctx.drawImage(original,x,y,w,h,0,0,w,h);
    return c;
  }
  function verifyBarColours(originalPixels,barLayers) {
    const audit={opaquePixelsCompared:0,rgbMismatches:0,edgeAntialiasingExcluded:true};
    for(const group of barLayers) for(const bar of group.bars) {
      const [sx,sy,w,h]=bar.rect, texels=bar.texture.getContext('2d').getImageData(0,0,w,h).data;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        const t=(y*w+x)*4;
        if(texels[t+3]!==255)continue;
        const s=((sy+y)*W+sx+x)*4;
        audit.opaquePixelsCompared++;
        if(texels[t]!==originalPixels[s] || texels[t+1]!==originalPixels[s+1] || texels[t+2]!==originalPixels[s+2])audit.rgbMismatches++;
      }
    }
    if(audit.rgbMismatches)throw new Error('Bar texture colours differ from the original');
    return audit;
  }
  function ribbonFrontMask(plate) {
    const plateCtx=plate.getContext('2d'), pixels=plateCtx.getImageData(0,0,W,H).data;
    const mask=makeCanvas(), mctx=mask.getContext('2d'), output=mctx.createImageData(W,H);
    const mix=(a,b,t)=>a+(b-a)*t;
    function upper(x) {
      if(x<.14)return mix(.448,.374,smooth(0,.14,x));
      if(x<.34)return mix(.374,.507,smooth(.14,.34,x));
      if(x<.52)return mix(.507,.390,smooth(.34,.52,x));
      if(x<.73)return mix(.390,.448,smooth(.52,.73,x));
      return mix(.448,.300,smooth(.73,1,x));
    }
    function lower(x) {
      if(x<.16)return mix(.572,.672,smooth(0,.16,x));
      if(x<.37)return mix(.672,.607,smooth(.16,.37,x));
      if(x<.53)return mix(.607,.652,smooth(.37,.53,x));
      if(x<.70)return mix(.652,.721,smooth(.53,.70,x));
      return mix(.721,.617,smooth(.70,1,x));
    }
    for(let x=0;x<W;x++) {
      const px=x/W, side=Math.max(1-smooth(.205,.260,px),smooth(.480,.570,px));
      if(side===0)continue;
      const top=upper(px),bottom=lower(px);
      for(let y=0;y<H;y++) {
        const py=y/H, band=Math.max(1-smooth(.012,.047,Math.abs(py-top)),1-smooth(.012,.052,Math.abs(py-bottom)));
        if(band===0)continue;
        const i=(y*W+x)*4;
        const warm=pixels[i]-pixels[i+2]+.12*(pixels[i+1]-pixels[i+2]);
        const alpha=side*band*smooth(-72,-26,warm);
        output.data[i]=255;output.data[i+1]=255;output.data[i+2]=255;output.data[i+3]=Math.round(alpha*255);
      }
    }
    mctx.putImageData(output,0,0);return mask;
  }
  function prepareWaveRenderer(plate) {
    const gl=bg.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
    if(!gl) {
      bg.remove();
      const fallback=makeCanvas(); fallback.className='motion-background'; fallback.setAttribute('aria-hidden','true');
      fallback.getContext('2d').drawImage(plate,0,0); art.insertBefore(fallback,fg);
      return ()=>{};
    }
    const vertex=`attribute vec2 point; varying vec2 uv; void main(){uv=point*.5+.5; gl_Position=vec4(point,0.,1.);}`;
    const fragment=`precision highp float;
      uniform sampler2D picture; uniform float time; varying vec2 uv;
      float upper(float x){
        if(x<.14) return mix(.448,.374,smoothstep(0.,.14,x));
        if(x<.34) return mix(.374,.507,smoothstep(.14,.34,x));
        if(x<.52) return mix(.507,.390,smoothstep(.34,.52,x));
        if(x<.73) return mix(.390,.448,smoothstep(.52,.73,x));
        return mix(.448,.300,smoothstep(.73,1.,x));
      }
      float lower(float x){
        if(x<.16) return mix(.572,.672,smoothstep(0.,.16,x));
        if(x<.37) return mix(.672,.607,smoothstep(.16,.37,x));
        if(x<.53) return mix(.607,.652,smoothstep(.37,.53,x));
        if(x<.70) return mix(.652,.721,smoothstep(.53,.70,x));
        return mix(.721,.617,smoothstep(.70,1.,x));
      }
      vec4 flow(vec2 p,float band,float direction){
        float cycle=fract(time*${WAVE_SPEED.toFixed(2)}/10.);
        float blend=.5-.5*cos(cycle*3.14159265);
        float a=p.x-direction*cycle*.044;
        float b=p.x-direction*(cycle-1.)*.044;
        float yy=band<.5?upper(p.x):lower(p.x);
        float ya=band<.5?upper(a):lower(a);
        float yb=band<.5?upper(b):lower(b);
        vec4 first=texture2D(picture,vec2(clamp(a,0.,1.),p.y+ya-yy));
        vec4 second=texture2D(picture,vec2(clamp(b,0.,1.),p.y+yb-yy));
        return mix(first,second,blend);
      }
      void main(){
        vec2 p=vec2(uv.x,1.-uv.y);
        vec4 base=texture2D(picture,p);
        float u=upper(p.x), l=lower(p.x);
        float left=1.-smoothstep(.205,.260,p.x);
        float right=smoothstep(.480,.570,p.x);
        float side=max(left,right);
        float maskUpper=(1.-smoothstep(.025,.093,abs(p.y-u)))*side;
        float maskLower=(1.-smoothstep(.025,.096,abs(p.y-l)))*side;
        float direction=p.x<.33?-1.:1.;
        vec4 moving=mix(base,flow(p,0.,direction),maskUpper*.82);
        moving=mix(moving,flow(p,1.,direction),maskLower*.82);
        // The wordmark is an independent alpha layer above this background.
        // Preserve the central region and image edges.
        float safe=smoothstep(0.,.045,p.x)*(1.-smoothstep(.955,1.,p.x));
        gl_FragColor=mix(base,moving,safe);
      }`;
    function shader(type,source) { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    const program=gl.createProgram(); gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex)); gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment)); gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const location=gl.getAttribLocation(program,'point'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,plate);
    gl.uniform1i(gl.getUniformLocation(program,'picture'),0); const clock=gl.getUniformLocation(program,'time'); gl.viewport(0,0,W,H);
    return time => { gl.uniform1f(clock,time); gl.drawArrays(gl.TRIANGLES,0,6); };
  }
  Promise.all([load(originalURL),load(new URL('background.d76b84edbaf3.png',assetBase).href),load(new URL('circle-core.16fc8a5a2b39.png',assetBase).href),load(new URL('circle-rings.b7e14c76708e.png',assetBase).href),load(new URL('wordmark.5041b750f1a6.png',assetBase).href)]).then(([original,preparedBackground,core,rings,preparedWordmark])=>{
    const source=makeCanvas(), sourceCtx=source.getContext('2d'); sourceCtx.drawImage(original,0,0,W,H);
    const pixels=sourceCtx.getImageData(0,0,W,H).data;
    const wordmark={texture:preparedWordmark,geometry:{"sourceRect":[680,328,560,88],"sourceInkBounds":[685,332,1218,413],"offsetX":40,"offsetY":0,"position":[720,328],"sweptRadius":278.9928314491252,"sweptRight":704,"minimumGap":21,"rightMargin":22,"opaqueSourcePixels":11733,"background":"transparent","shadow":"soft alpha shadow; no rectangle"}};
    const barLayers=groups.map(group=>({...group,bars:group.bars.map(bar=>({rect:bar,texture:barTexture(original,bar)}))}));
    const colourAudit=verifyBarColours(pixels,barLayers);
    const plate=makeCanvas(); plate.getContext('2d').drawImage(preparedBackground,0,0,W,H);
    let renderWaves=prepareWaveRenderer(plate), contextLost=false, pageActive=true;
    const ribbons=ribbonFrontMask(plate), ribbonFrame=makeCanvas(), ribbonCtx=ribbonFrame.getContext('2d');
    function draw(time) {
      renderWaves(time);
      ctx.clearRect(0,0,W,H);
      for(const group of barLayers) {
        ctx.save();ctx.globalAlpha=BAR_OPACITY[group.key];ctx.filter='none';
        group.bars.forEach((bar,index)=>{
        const [x,y,w,h]=bar.rect;
        const rhythm=Math.sin(time*2.7+index*.62+group.phase)*.5+.5;
        const detail=Math.sin(time*4.1+index*1.31+group.phase)*.5+.5;
        const scale=1+smooth(0,2,time)*(-.22+.32*(rhythm-.5)+.12*(detail-.5));
        const height=h*scale, middle=y+h/2;
        ctx.save();ctx.beginPath();ctx.roundRect(x,middle-height/2,w,height,Math.min(5,w/2));ctx.clip();
        ctx.drawImage(bar.texture,x,y,w,h);ctx.restore();
        });
        ctx.restore();
      }
      // Repaint the flowing ribbon pixels in front of the recessed bars.
      ribbonCtx.clearRect(0,0,W,H);ribbonCtx.globalCompositeOperation='source-over';
      ribbonCtx.drawImage(bg.isConnected?bg:plate,0,0);
      ribbonCtx.globalCompositeOperation='destination-in';ribbonCtx.drawImage(ribbons,0,0);
      ribbonCtx.globalCompositeOperation='source-over';ctx.drawImage(ribbonFrame,0,0);
      // A single rotation keeps the original alignment between core and rings.
      ctx.save();
      ctx.translate(CX,CY);ctx.rotate(time*Math.PI*2/CIRCLE_PERIOD);
      ctx.save();ctx.scale(RING_SCALE,RING_SCALE);ctx.drawImage(rings,-280,-280);ctx.restore();
      ctx.save();ctx.shadowColor='rgba(56,24,105,.32)';ctx.shadowBlur=6;ctx.shadowOffsetY=3;ctx.drawImage(core,-280,-280);ctx.restore();ctx.restore();
      ctx.save();ctx.shadowColor='rgba(44,20,86,.32)';ctx.shadowBlur=4;ctx.shadowOffsetX=1;ctx.shadowOffsetY=4;ctx.drawImage(wordmark.texture,...wordmark.geometry.position);ctx.restore();
      art.dataset.motionTime=time.toFixed(2);
      art.dataset.motionAngle=(time*360/CIRCLE_PERIOD%360).toFixed(1);
      art.dataset.motionLayers=String(3+allBars.length);
    }
    function tick(timestamp) {
      raf=0;
      if(!playing||originalMode||!pageActive||!inView||document.hidden)return;
      if(!last) last=timestamp;
      if(timestamp-last>=1000/30) {
        const delta=Math.min((timestamp-last)/1000,.1); last=timestamp;
        if(playing&&!originalMode&&inView&&!document.hidden) { elapsed+=delta; draw(elapsed); }
      }
      raf=requestAnimationFrame(tick);
    }
    function stopLoop() {
      if(raf)cancelAnimationFrame(raf);
      raf=0;last=0;
    }
    function startLoop() {
      if(ready&&playing&&pageActive&&inView&&!document.hidden&&!raf) {
        last=0;raf=requestAnimationFrame(tick);
      }
    }
    function syncMotion() {
      playing=!reduced.matches&&!contextLost;
      art.classList.toggle('motion-ready',playing);
      art.dataset.motionState=contextLost?'static-context-lost':reduced.matches?'reduced-motion':'playing';
      stopLoop();startLoop();
    }
    ready=true; art.dataset.motionRevision='mobile-resume-8'; art.dataset.wordmarkGeometry=JSON.stringify(wordmark.geometry); art.dataset.circlePeriod=String(CIRCLE_PERIOD); art.dataset.ringsScale=String(RING_SCALE); art.dataset.waveSpeed=String(WAVE_SPEED); art.dataset.barColourMismatches=String(colourAudit.rgbMismatches); art.dataset.barColourPixels=String(colourAudit.opaquePixelsCompared); draw(0);
    syncMotion();
    reduced.addEventListener('change',syncMotion);
    bg.addEventListener('webglcontextlost',event=>{
      event.preventDefault();contextLost=true;syncMotion();
    });
    bg.addEventListener('webglcontextrestored',()=>{
      try {
        // Android may discard the GPU resources while the page is suspended.
        // Rebuild the shader and texture before resuming the same composition.
        renderWaves=prepareWaveRenderer(plate);contextLost=false;draw(elapsed);syncMotion();
      } catch(error) {
        contextLost=true;art.dataset.motionError=error.message;syncMotion();
      }
    });
    new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting;
      if(inView)startLoop();else stopLoop();
    },{threshold:0}).observe(art);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLoop();else startLoop();});
    // Back/forward navigation can restore this document from the browser cache.
    // A cancelled animation frame must be explicitly restarted on pageshow.
    window.addEventListener('pagehide',()=>{pageActive=false;stopLoop();});
    window.addEventListener('pageshow',()=>{pageActive=true;startLoop();});
  }).catch(error=>{ art.dataset.motionError=error.message; bg.remove(); fg.remove(); art.classList.remove('motion-ready'); art.dataset.motionState='static-fallback'; console.error(error); });
})();

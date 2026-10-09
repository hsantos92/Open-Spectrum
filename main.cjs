const {app,BrowserWindow,ipcMain,dialog,protocol,net}=require('electron');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const {spectrum,PCMFrames}=require('./src/dsp.cjs');const exec=promisify(execFile);
let win,capture,lastFrame={bins:new Array(96).fill(0),rms:0},allowedFiles=new Map();
const verify=process.argv.includes('--verify');let peak=0,packets=0,errors=[];
app.setName('Open Spectrum');app.commandLine.appendSwitch('disable-features','Vulkan,VulkanFromANGLE,DefaultANGLEVulkan');app.commandLine.appendSwitch('use-angle','gl');if(verify)app.setPath('userData',path.join(__dirname,'.verify-profile'));
protocol.registerSchemesAsPrivileged([{scheme:'spectrum-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true,corsEnabled:true}}]);
async function sources(){const [{stdout},{stdout:sink}]=await Promise.all([exec('pactl',['-f','json','list','sources']),exec('pactl',['get-default-sink'])]);return {sources:JSON.parse(stdout).map(s=>({name:s.name,label:s.description,monitor:!!s.monitor_source||s.name.endsWith('.monitor')})),defaultMonitor:sink.trim()+'.monitor'};}
function stop(){if(capture){const old=capture;capture=null;old.kill();}}
function status(message){if(win&&!win.isDestroyed())win.webContents.send('audio-status',message);}
async function start(name){stop();const list=await sources();if(!list.sources.some(s=>s.name===name))throw Error('Audio source is no longer available. Refresh the source list.');lastFrame={bins:new Array(96).fill(0),rms:0};
 const child=spawn('parec',['--device='+name,'--format=float32le','--rate=48000','--channels=1','--latency-msec=30'],{stdio:['ignore','pipe','pipe']});capture=child;
 const frames=new PCMFrames(samples=>{if(child!==capture)return;lastFrame=spectrum(samples);peak=Math.max(peak,lastFrame.rms);packets++;if(win&&!win.isDestroyed())win.webContents.send('audio-frame',lastFrame);});
 child.stdout.on('data',b=>frames.push(b));child.stderr.on('data',b=>{if(child===capture)status(b.toString().trim());});child.on('error',e=>status(e.message));child.on('exit',code=>{if(child===capture){capture=null;status('Audio capture stopped ('+code+'). Select a source to retry.');}});return true;
}
ipcMain.handle('sources',()=>sources());ipcMain.handle('capture',(_,name)=>start(name));ipcMain.handle('stop',()=>stop());ipcMain.handle('fullscreen',()=>{win.setFullScreen(!win.isFullScreen());return win.isFullScreen();});
ipcMain.handle('music',async()=>{const result=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'Audio',extensions:['mp3','flac','wav','ogg','m4a','opus','aac']}]});return result.filePaths.map(p=>{const id=require('node:crypto').randomUUID();allowedFiles.set(id,p);return {name:path.basename(p),url:'spectrum-media://track/'+id};});});
ipcMain.handle('diagnostics',async()=>({features:app.getGPUFeatureStatus(),gpu:await app.getGPUInfo('complete')}));
app.whenReady().then(async()=>{
 protocol.handle('spectrum-media',async request=>{const p=allowedFiles.get(new URL(request.url).pathname.slice(1));if(!p)return new Response('Not found',{status:404});const response=await net.fetch(pathToFileURL(p).href);const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin','*');return new Response(response.body,{status:response.status,headers});});
 win=new BrowserWindow({width:1280,height:850,minWidth:800,minHeight:550,backgroundColor:'#000000',title:'Open Spectrum',icon:path.join(__dirname,'assets/icon.svg'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.setMenuBarVisibility(false);
 win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('console-message',details=>{if(details.level==='error'){errors.push(details.message);console.error(details.message);}});
 win.webContents.on('render-process-gone',(_e,d)=>console.error('Renderer exit',d));
 await win.loadFile('index.html');
 if(verify){try{
  await new Promise(r=>setTimeout(r,2500));
  const result=await win.webContents.executeJavaScript('window.verifyAll()');
  await win.webContents.executeJavaScript("document.querySelector('#demo').click()");
  await new Promise(r=>setTimeout(r,500));
  fs.writeFileSync(path.join(__dirname,'preview.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.querySelector('#galleryButton').click()");
  await new Promise(r=>setTimeout(r,800));fs.writeFileSync(path.join(__dirname,'gallery.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.querySelector('#demo').click()");
  await new Promise(r=>setTimeout(r,500));
  // Play a quiet deterministic tone through the real desktop output to verify monitor capture.
  const n=48000*2,buf=Buffer.alloc(44+n*2);buf.write('RIFF');buf.writeUInt32LE(36+n*2,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(48000,24);buf.writeUInt32LE(96000,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)buf.writeInt16LE(Math.round(800*Math.sin(i*2*Math.PI*440/48000)),44+i*2);fs.writeFileSync('/tmp/open-spectrum-test.wav',buf);
  const before=packets;peak=0;await exec('paplay',['/tmp/open-spectrum-test.wav']);await new Promise(r=>setTimeout(r,400));
  allowedFiles.set('verification', '/tmp/open-spectrum-test.wav');
  const playback=await win.webContents.executeJavaScript("window.verifyPlayback('spectrum-media://track/verification')");
  const report={...result,playback,audio:{packets:packets-before,peak,passed:packets>before&&peak>0.001},features:app.getGPUFeatureStatus(),gpu:await app.getGPUInfo('complete'),errors};fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.audio.passed&&result.passed&&playback.passed&&errors.length===0?0:1);
 }catch(e){console.error(e);app.exit(1);}}
});app.on('window-all-closed',()=>app.quit());app.on('before-quit',stop);

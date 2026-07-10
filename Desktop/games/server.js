const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const os = require('os');

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const PLAYER_RADIUS = 18;
const TICK_RATE = 30;
const MAX_STAMINA = 100;
const STAMINA_DRAIN_PER_TICK = 1.4;
const STAMINA_RECHARGE_PER_TICK = 0.8;

let users = {};
let gameRunning = false;
let activeMapKey = 'crypt';

const gameMaps = {
  crypt: {
    key: 'crypt', name: 'The Crypt',
    theme: { floor: '#101316', grid: '#1b2228', wall: '#26313a', wallStroke: '#3d4a54', hiding: 'rgba(78,113,85,.42)' },
    walls: [
      {x:0,y:0,w:2000,h:35},{x:0,y:1965,w:2000,h:35},{x:0,y:0,w:35,h:2000},{x:1965,y:0,w:35,h:2000},
      {x:190,y:120,w:45,h:310},{x:190,y:620,w:45,h:330},{x:190,y:1140,w:45,h:330},{x:190,y:1650,w:45,h:240},
      {x:430,y:240,w:45,h:320},{x:430,y:760,w:45,h:330},{x:430,y:1290,w:45,h:330},
      {x:670,y:90,w:45,h:300},{x:670,y:590,w:45,h:330},{x:670,y:1120,w:45,h:330},{x:670,y:1620,w:45,h:280},
      {x:920,y:260,w:45,h:320},{x:920,y:780,w:45,h:330},{x:920,y:1300,w:45,h:330},
      {x:1170,y:90,w:45,h:300},{x:1170,y:610,w:45,h:330},{x:1170,y:1125,w:45,h:330},{x:1170,y:1630,w:45,h:270},
      {x:1420,y:260,w:45,h:330},{x:1420,y:790,w:45,h:330},{x:1420,y:1320,w:45,h:330},
      {x:1670,y:120,w:45,h:310},{x:1670,y:620,w:45,h:330},{x:1670,y:1140,w:45,h:330},{x:1670,y:1650,w:45,h:240},
      {x:300,y:300,w:240,h:45},{x:790,y:300,w:250,h:45},{x:1280,y:300,w:250,h:45},
      {x:65,y:520,w:250,h:45},{x:540,y:520,w:260,h:45},{x:1040,y:520,w:260,h:45},{x:1530,y:520,w:250,h:45},
      {x:300,y:820,w:240,h:45},{x:790,y:820,w:250,h:45},{x:1280,y:820,w:250,h:45},
      {x:65,y:1040,w:250,h:45},{x:540,y:1040,w:260,h:45},{x:1040,y:1040,w:260,h:45},{x:1530,y:1040,w:250,h:45},
      {x:300,y:1340,w:240,h:45},{x:790,y:1340,w:250,h:45},{x:1280,y:1340,w:250,h:45},
      {x:65,y:1560,w:250,h:45},{x:540,y:1560,w:260,h:45},{x:1040,y:1560,w:260,h:45},{x:1530,y:1560,w:250,h:45}
    ],
    hidingSpots: [{x:70,y:70,w:90,h:90},{x:455,y:380,w:100,h:90},{x:705,y:910,w:120,h:95},{x:1115,y:560,w:95,h:120},{x:1645,y:180,w:110,h:100},{x:1725,y:1510,w:110,h:120},{x:500,y:1800,w:120,h:95},{x:1160,y:1810,w:105,h:100}],
    spawns: [{x:90,y:90},{x:1810,y:90},{x:90,y:1810},{x:1810,y:1810},{x:505,y:650},{x:760,y:1260},{x:1410,y:690},{x:1780,y:1280}]
  },
  library: {
    key: 'library', name: 'The Library',
    theme: { floor: '#15110e', grid: '#241d18', wall: '#4a3525', wallStroke: '#6a4a31', hiding: 'rgba(92,66,110,.42)' },
    walls: [
      {x:0,y:0,w:2000,h:35},{x:0,y:1965,w:2000,h:35},{x:0,y:0,w:35,h:2000},{x:1965,y:0,w:35,h:2000},
      ...[260,520,780,1090,1350,1610].flatMap(x => [260,560,920,1280,1610].map(y => ({x,y,w:130,h:130}))),
      {x:930,y:760,w:140,h:480},{x:780,y:112,w:440,h:44},{x:780,y:1844,w:440,h:44}
    ],
    hidingSpots: [{x:80,y:430,w:110,h:110},{x:80,y:1450,w:110,h:110},{x:1810,y:430,w:110,h:110},{x:1810,y:1450,w:110,h:110},{x:935,y:170,w:130,h:100},{x:935,y:1730,w:130,h:100},{x:440,y:760,w:100,h:110},{x:1460,y:1120,w:100,h:110}],
    spawns: [{x:110,y:110},{x:1890,y:110},{x:110,y:1890},{x:1890,y:1890},{x:1000,y:210},{x:1000,y:1790},{x:160,y:1000},{x:1840,y:1000}]
  },
  courtyard: {
    key: 'courtyard', name: 'The Courtyard',
    theme: { floor: '#111915', grid: '#1d2a22', wall: '#344030', wallStroke: '#546449', hiding: 'rgba(55,102,88,.42)' },
    walls: [
      {x:0,y:0,w:2000,h:45},{x:0,y:1955,w:2000,h:45},{x:0,y:0,w:45,h:2000},{x:1955,y:0,w:45,h:2000},
      {x:240,y:230,w:560,h:40},{x:1200,y:230,w:560,h:40},{x:240,y:1730,w:560,h:40},{x:1200,y:1730,w:560,h:40},
      {x:230,y:240,w:40,h:420},{x:230,y:1340,w:40,h:420},{x:1730,y:240,w:40,h:420},{x:1730,y:1340,w:40,h:420},
      {x:520,y:520,w:380,h:35},{x:1100,y:520,w:380,h:35},{x:520,y:1445,w:380,h:35},{x:1100,y:1445,w:380,h:35},
      {x:520,y:520,w:35,h:260},{x:520,y:1220,w:35,h:260},{x:1445,y:520,w:35,h:260},{x:1445,y:1220,w:35,h:260},
      {x:860,y:820,w:280,h:35},{x:860,y:1145,w:280,h:35},{x:860,y:820,w:35,h:180},{x:1105,y:1000,w:35,h:180},
      {x:80,y:920,w:430,h:35},{x:1490,y:920,w:430,h:35},{x:80,y:1045,w:430,h:35},{x:1490,y:1045,w:430,h:35}
    ],
    hidingSpots: [{x:325,y:325,w:130,h:130},{x:1545,y:325,w:130,h:130},{x:325,y:1545,w:130,h:130},{x:1545,y:1545,w:130,h:130},{x:695,y:650,w:120,h:120},{x:1185,y:650,w:120,h:120},{x:695,y:1230,w:120,h:120},{x:1185,y:1230,w:120,h:120}],
    spawns: [{x:120,y:120},{x:1880,y:120},{x:120,y:1880},{x:1880,y:1880},{x:1000,y:360},{x:1000,y:1640},{x:360,y:1000},{x:1640,y:1000}]
  }
};

function getActiveMap() { return gameMaps[activeMapKey] || gameMaps.crypt; }
function publicMapPayload(mapKey = activeMapKey) {
  const map = gameMaps[mapKey] || gameMaps.crypt;
  return { key: map.key, name: map.name, width: WORLD_WIDTH, height: WORLD_HEIGHT, walls: map.walls, hidingSpots: map.hidingSpots, theme: map.theme };
}
function createGameData(role = 'unassigned', lifeState = 'spectating') {
  return {
    x: 100,
    y: 100,
    role,
    lifeState,
    spectateTargetId: null,
    stamina: MAX_STAMINA,
    hiddenFromGhost: false,
    input: { w: false, a: false, s: false, d: false, shift: false }
  };
}
function buildVisibleStateFor(viewer, allUsers) {
  const visibleState = {};
  if (!viewer?.gameData) return visibleState;

  Object.values(allUsers).forEach(target => {
    if (target.status !== 'approved' || !target.gameData) return;

    const viewerData = viewer.gameData;
    const targetData = target.gameData;
    let isVisible = true;

    if (viewerData.role === 'ghost' && targetData.role === 'survivor' && targetData.hiddenFromGhost) {
      isVisible = false;
    }

    if (!isVisible) return;

    visibleState[target.id] = {
      id: target.id,
      username: target.username,
      x: Math.round(targetData.x),
      y: Math.round(targetData.y),
      role: targetData.role,
      lifeState: targetData.lifeState,
      stamina: target.id === viewer.id ? targetData.stamina : undefined,
      spectateTargetId: target.id === viewer.id ? targetData.spectateTargetId : undefined
    };
  });

  return visibleState;
}
function emitPersonalizedGameState() {
  Object.values(users).forEach(user => {
    if (user.status === 'approved') {
      io.to(user.id).emit('game-state', buildVisibleStateFor(user, users));
    }
  });
}
function getLocalIp() {
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const iface of os.networkInterfaces()[name]) if (iface.family === 'IPv4' && !iface.internal) return iface.address;
  }
  return '0.0.0.0';
}
const hostIp = getLocalIp();

function spriteSvg(type) {
  if (type === 'ghost') return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><filter id="glow"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d7fbff" stop-opacity=".85"/><stop offset=".5" stop-color="#7aa7c7" stop-opacity=".62"/><stop offset="1" stop-color="#27384f" stop-opacity=".2"/></linearGradient></defs><path filter="url(#glow)" fill="url(#g)" d="M48 8c19 0 31 16 31 39v35l-9-7-8 9-8-9-7 9-8-9-8 9-8-9-7 7V47C16 24 29 8 48 8z"/><path fill="#effcff" opacity=".35" d="M30 27c5-8 14-12 25-11-12 5-20 14-25 28-2-7-2-12 0-17z"/><ellipse cx="36" cy="42" rx="7" ry="10" fill="#eaffff"/><ellipse cx="60" cy="42" rx="7" ry="10" fill="#eaffff"/><circle cx="38" cy="43" r="3" fill="#5adfff"/><circle cx="58" cy="43" r="3" fill="#5adfff"/></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000" flood-opacity=".45"/></filter></defs><g filter="url(#shadow)"><circle cx="48" cy="22" r="13" fill="#c99667"/><path d="M33 38h30l7 35H26z" fill="#b99253"/><path d="M36 38h24l-4 37H40z" fill="#d8c184"/><path d="M29 45l-10 21 9 5 11-24zM67 45l10 21-9 5-11-24z" fill="#9a7845"/><path d="M36 78h9l-1 12H32zM51 78h9l4 12H52z" fill="#3f4750"/><rect x="34" y="9" width="28" height="8" rx="4" fill="#5b6570"/><circle cx="48" cy="13" r="5" fill="#ffe78a"/><path d="M31 35c9 8 25 8 34 0" fill="none" stroke="#5b3d28" stroke-width="4" stroke-linecap="round"/><rect x="58" y="48" width="19" height="8" rx="4" fill="#f8e38b"/></g></svg>`;
}
app.get('/assets/ghost_sprite.png', (req, res) => res.type('image/svg+xml').send(spriteSvg('ghost')));
app.get('/assets/survivor_sprite.png', (req, res) => res.type('image/svg+xml').send(spriteSvg('survivor')));

app.get('/', (req, res) => res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ghost in the Manor</title><script src="/socket.io/socket.io.js"></script><style>
body{font-family:Arial,sans-serif;margin:30px;background-color:#e0e8f0;color:#333}.card{background:white;padding:25px;border-radius:8px;box-shadow:0 6px 12px rgba(0,0,0,.15);max-width:1180px;margin:0 auto}.hidden{display:none!important}input[type="text"],select{width:100%;padding:10px;margin:10px 0;border:1px solid #ccd6e0;border-radius:6px;box-sizing:border-box}button{background:#007bff;color:white;padding:10px 18px;border:none;border-radius:6px;cursor:pointer;font-size:16px;transition:background .2s;font-weight:bold}button:hover{background:#0056b3}.main-layout{display:flex;gap:20px;margin-top:15px;align-items:stretch}.game-side{flex:0 0 800px;background:#000;border-radius:8px;display:flex;justify-content:center;align-items:center;min-height:600px;border:3px solid #ddd;position:relative;overflow:hidden}canvas{background:#111;width:800px;height:600px;border-radius:6px;display:block}.chat-side{flex:1;display:flex;flex-direction:column;min-width:280px;overflow:hidden}#chat-box{border:1px solid #ddd;flex-grow:1;min-height:500px;overflow-y:auto;overflow-x:hidden;padding:15px;background:#fff;margin-bottom:10px;border-radius:8px}#chat-box p{word-wrap:break-word;white-space:pre-wrap;line-height:1.4;margin:5px 0 12px;width:100%}.system-msg{color:#888;font-style:italic;font-size:.9em;text-align:center}#admin-panel{background:#fff3cd;border:1px solid #ffeeba;padding:15px;margin-bottom:15px;border-radius:4px}.pending-item{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #ffe8a1;gap:10px}.approve-btn{background:#28a745;padding:5px 10px;font-size:14px;width:auto}.approve-btn:hover{background:#218838}#admin-game-controls{margin-top:10px;padding-top:10px;border-top:1px solid #ffe8a1}#start-game-btn{background:#dc3545;font-weight:bold;width:100%}#start-game-btn:hover{background:#c82333}.map-label{display:block;margin-top:8px;font-size:13px;font-weight:bold;color:#5c4b10}.input-row{display:flex;gap:8px;position:relative;align-items:flex-end;background:#edf2f7;padding:8px;border-radius:24px}#msg-input{flex-grow:1;min-height:24px;max-height:150px;overflow-y:auto;resize:none;border:none;background:transparent;font-family:Arial,sans-serif;font-size:16px;outline:none;padding:8px 4px}#emoji-btn,#send-btn{width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;border:none;flex-shrink:0;cursor:pointer}#emoji-btn:hover{background:#cbd5e0}#send-btn{background:#007bff;color:white}#emoji-picker{position:absolute;bottom:60px;left:0;background:white;border:1px solid #ccc;border-radius:8px;padding:10px;display:flex;gap:10px;flex-wrap:wrap;width:260px;max-height:200px;overflow-y:auto;box-shadow:0 4px 10px rgba(0,0,0,.15);z-index:100}.emoji{cursor:pointer;font-size:22px;transition:transform .1s;padding:2px}.emoji:hover{transform:scale(1.3)}#emoji-picker::-webkit-scrollbar{width:6px}#emoji-picker::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}@media(max-width:1180px){body{margin:12px}.main-layout{flex-direction:column}.game-side{flex-basis:auto;width:100%;min-height:0}canvas{width:100%;height:auto;aspect-ratio:4/3}#chat-box{min-height:260px}}
</style></head><body><div class="card"><div id="login-screen"><h2>Enter Nickname</h2><input type="text" id="nickname-input" placeholder="Type your name here..." autocomplete="off"><button id="join-btn" style="width:100%;">Join Lobby</button></div><div id="waiting-screen" class="hidden" style="text-align:center;"><h2>Lobby</h2><p>You are a Spectator. Waiting for Admin approval to join the active game...</p></div><div id="main-room" class="hidden"><h2 id="room-title">Ghost in the Manor</h2><div id="admin-panel" class="hidden"><strong>Admin Dashboard</strong><div id="pending-list" style="margin-top:10px;"></div><div id="admin-game-controls"><label class="map-label" for="map-select">Playground</label><select id="map-select"><option value="crypt">Map A: The Crypt</option><option value="library">Map B: The Library</option><option value="courtyard">Map C: The Courtyard</option></select><button id="start-game-btn">Start Game (Assign Roles)</button></div></div><div class="main-layout"><div class="game-side"><canvas id="gameCanvas" width="800" height="600"></canvas></div><div class="chat-side"><div id="chat-box"></div><div class="input-row"><div id="emoji-picker" class="hidden"><span class="emoji" onclick="insertEmoji('😀')">😀</span><span class="emoji" onclick="insertEmoji('😂')">😂</span><span class="emoji" onclick="insertEmoji('👻')">👻</span><span class="emoji" onclick="insertEmoji('💀')">💀</span><span class="emoji" onclick="insertEmoji('🏃')">🏃</span><span class="emoji" onclick="insertEmoji('👀')">👀</span><span class="emoji" onclick="insertEmoji('❤️')">❤️</span><span class="emoji" onclick="insertEmoji('🔥')">🔥</span></div><button id="emoji-btn">😀</button><textarea id="msg-input" placeholder="Message..." rows="1"></textarea><button id="send-btn">➤</button></div></div></div></div></div><script>
const socket=io();const loginScreen=document.getElementById('login-screen'),waitingScreen=document.getElementById('waiting-screen'),mainRoom=document.getElementById('main-room'),adminPanel=document.getElementById('admin-panel'),roomTitle=document.getElementById('room-title'),startGameBtn=document.getElementById('start-game-btn'),mapSelect=document.getElementById('map-select'),msgInput=document.getElementById('msg-input'),chatBox=document.getElementById('chat-box'),canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');let myUsername='',currentMap={width:2000,height:2000,walls:[],hidingSpots:[],theme:{}},assetsReady=false,lastServerUsers={},spectatorTargetId=null,myInput={w:false,a:false,s:false,d:false,shift:false};const sprites={ghost:new Image(),survivor:new Image()};
function preloadSprites(){return Promise.all(Object.entries(sprites).map(([name,image])=>new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=name==='ghost'?'/assets/ghost_sprite.png':'/assets/survivor_sprite.png'})))}preloadSprites().then(()=>{assetsReady=true;renderGame(lastServerUsers)}).catch(()=>{assetsReady=true;renderGame(lastServerUsers)});
function requestNotificationPermission(){if('Notification'in window&&Notification.permission!=='granted'&&Notification.permission!=='denied')Notification.requestPermission()}function isTyping(){return document.activeElement===msgInput||document.activeElement===document.getElementById('nickname-input')}function emitInputIfChanged(nextInput){myInput=nextInput;socket.emit('player-input',myInput)}
function cycleSpectatorTarget(){const candidates=Object.values(lastServerUsers||{}).filter(u=>u.id!==socket.id&&u.role!=='spectator'&&u.lifeState==='alive');if(!candidates.length){spectatorTargetId=null;return}const currentIndex=candidates.findIndex(u=>u.id===spectatorTargetId);spectatorTargetId=candidates[(currentIndex+1)%candidates.length].id}
window.addEventListener('keydown',e=>{if(isTyping())return;if(e.key==='Tab'){e.preventDefault();cycleSpectatorTarget();return}const key=e.key.toLowerCase(),nextInput={...myInput};if(['w','a','s','d'].includes(key))nextInput[key]=true;if(e.key==='Shift')nextInput.shift=true;if(JSON.stringify(nextInput)!==JSON.stringify(myInput))emitInputIfChanged(nextInput)});window.addEventListener('keyup',e=>{if(isTyping())return;const key=e.key.toLowerCase(),nextInput={...myInput};if(['w','a','s','d'].includes(key))nextInput[key]=false;if(e.key==='Shift')nextInput.shift=false;if(JSON.stringify(nextInput)!==JSON.stringify(myInput))emitInputIfChanged(nextInput)});
socket.on('map-data',mapData=>{currentMap=mapData;renderGame(lastServerUsers)});socket.on('game-state',serverUsers=>{lastServerUsers=serverUsers;renderGame(serverUsers)});
function getCamera(myPlayer){let target=myPlayer;if(myPlayer?.role==='spectator'&&spectatorTargetId&&lastServerUsers[spectatorTargetId])target=lastServerUsers[spectatorTargetId];const tx=target?target.x:currentMap.width/2,ty=target?target.y:currentMap.height/2;return{x:Math.max(0,Math.min(tx-canvas.width/2,currentMap.width-canvas.width)),y:Math.max(0,Math.min(ty-canvas.height/2,currentMap.height-canvas.height))}}function drawWorldBackground(camera){const theme=currentMap.theme||{};ctx.fillStyle=theme.floor||'#111';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=theme.grid||'#1a1a1a';ctx.lineWidth=1;const tileSize=50,startX=-((camera.x%tileSize)+tileSize),startY=-((camera.y%tileSize)+tileSize);for(let x=startX;x<canvas.width+tileSize;x+=tileSize)for(let y=startY;y<canvas.height+tileSize;y+=tileSize)ctx.strokeRect(x,y,tileSize,tileSize)}function isRectVisible(r,c){return r.x+r.w>=c.x&&r.x<=c.x+canvas.width&&r.y+r.h>=c.y&&r.y<=c.y+canvas.height}function drawMap(camera){const theme=currentMap.theme||{};ctx.fillStyle=theme.hiding||'rgba(60,120,80,.35)';currentMap.hidingSpots.filter(r=>isRectVisible(r,camera)).forEach(s=>{ctx.fillRect(s.x-camera.x,s.y-camera.y,s.w,s.h);ctx.strokeStyle='rgba(180,255,190,.22)';ctx.strokeRect(s.x-camera.x+1,s.y-camera.y+1,s.w-2,s.h-2)});ctx.fillStyle=theme.wall||'#2d3748';currentMap.walls.filter(r=>isRectVisible(r,camera)).forEach(w=>{ctx.fillRect(w.x-camera.x,w.y-camera.y,w.w,w.h);ctx.strokeStyle=theme.wallStroke||'#384459';ctx.lineWidth=1;ctx.strokeRect(w.x-camera.x+1,w.y-camera.y+1,w.w-2,w.h-2)})}
function drawPlayer(user,camera){if(!user||user.role==='unassigned')return;const sx=user.x-camera.x,sy=user.y-camera.y;if(sx<-60||sx>canvas.width+60||sy<-70||sy>canvas.height+60)return;const sprite=user.role==='ghost'?sprites.ghost:sprites.survivor,size=user.role==='ghost'?58:48;ctx.save();if(user.lifeState==='dead'||user.role==='spectator')ctx.globalAlpha=.42;if(user.role==='ghost')ctx.globalAlpha=Math.min(ctx.globalAlpha,.88);if(user.role==='spectator'){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.setLineDash([5,5]);ctx.strokeRect(sx-16,sy-16,32,32)}else if(assetsReady&&sprite.complete)ctx.drawImage(sprite,sx-size/2,sy-size/2,size,size);ctx.fillStyle=user.lifeState==='dead'?'rgba(255,255,255,.6)':'white';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=4;ctx.fillText(user.username,sx,sy-size/2-8);ctx.restore()}function drawFog(myPlayer,camera){if(!myPlayer||myPlayer.role==='unassigned'||myPlayer.role==='spectator'||myPlayer.lifeState!=='alive')return;const lx=myPlayer.x-camera.x,ly=myPlayer.y-camera.y,visionRadius=myPlayer.role==='ghost'?170:135,gradient=ctx.createRadialGradient(lx,ly,30,lx,ly,visionRadius);gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(.66,'rgba(0,0,0,.78)');gradient.addColorStop(1,'rgba(0,0,0,.96)');ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height)}function drawHud(myPlayer){if(!myPlayer||myPlayer.role==='unassigned')return;const x=18,y=18,w=190,h=16,stamina=Math.max(0,Math.min(100,myPlayer.stamina??100));ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x-4,y-4,w+8,64);ctx.fillStyle='#d9e6e2';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText(myPlayer.role==='spectator'?'SPECTATOR':'STAMINA',x,y+34);if(myPlayer.role==='spectator'){const target=lastServerUsers[spectatorTargetId];ctx.fillText(target?'FOLLOWING '+target.username:'FREE CAMERA',x,y+52);return}ctx.fillStyle='#2b3138';ctx.fillRect(x,y,w,h);ctx.fillStyle=stamina>25?'#36c178':'#d95f48';ctx.fillRect(x,y,w*(stamina/100),h);ctx.strokeStyle='rgba(255,255,255,.5)';ctx.strokeRect(x,y,w,h)}function renderGame(serverUsers){const myPlayer=(serverUsers||{})[socket.id]||null;if(myPlayer?.role==='spectator'&&spectatorTargetId&&!serverUsers[spectatorTargetId])spectatorTargetId=null;const camera=getCamera(myPlayer);drawWorldBackground(camera);drawMap(camera);Object.values(serverUsers||{}).forEach(user=>drawPlayer(user,camera));drawFog(myPlayer,camera);drawHud(myPlayer)}
startGameBtn.addEventListener('click',()=>socket.emit('admin-start-game',mapSelect.value));document.getElementById('emoji-btn').addEventListener('click',()=>document.getElementById('emoji-picker').classList.toggle('hidden'));window.insertEmoji=emoji=>{msgInput.value+=emoji;msgInput.focus();autoResize();document.getElementById('emoji-picker').classList.add('hidden')};function autoResize(){msgInput.style.height='auto';msgInput.style.height=msgInput.scrollHeight+'px'}msgInput.addEventListener('input',autoResize);msgInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});document.getElementById('join-btn').addEventListener('click',()=>{myUsername=document.getElementById('nickname-input').value.trim();if(myUsername){socket.emit('request-join',myUsername);requestNotificationPermission()}});document.getElementById('send-btn').addEventListener('click',sendMessage);function sendMessage(){const message=msgInput.value.trim();if(message){socket.emit('chat message',message);msgInput.value='';msgInput.style.height='auto';document.getElementById('emoji-picker').classList.add('hidden')}}
socket.on('waiting-screen',()=>{loginScreen.classList.add('hidden');waitingScreen.classList.remove('hidden');mainRoom.classList.remove('hidden')});socket.on('approved-entry',data=>{loginScreen.classList.add('hidden');waitingScreen.classList.add('hidden');mainRoom.classList.remove('hidden');if(data.isAdmin){roomTitle.innerHTML='Ghost in the Manor (Admin)';adminPanel.classList.remove('hidden')}else{roomTitle.innerHTML='Ghost in the Manor';adminPanel.classList.add('hidden')}});socket.on('update-pending-list',pendingUsers=>{const list=document.getElementById('pending-list');list.innerHTML=pendingUsers.length?'':'<span style="color:#666;">No users waiting.</span>';pendingUsers.forEach(u=>{list.innerHTML+=\`<div class="pending-item"><span>\${u.username}</span><button class="approve-btn" onclick="socket.emit('admin-approve-user', '\${u.id}')">Approve</button></div>\`})});socket.on('chat message',data=>{const p=document.createElement('p');if(data.user==='SYSTEM'){p.className='system-msg';p.innerText=data.text}else{p.className='user-msg';p.innerHTML=\`<strong>\${data.user}:</strong> \`;p.appendChild(document.createTextNode(data.text))}chatBox.appendChild(p);chatBox.scrollTop=chatBox.scrollHeight});
</script></body></html>`));

io.on('connection', socket => {
  socket.emit('map-data', publicMapPayload());
  socket.on('request-join', username => {
    const isAdmin = Object.keys(users).length === 0;
    users[socket.id] = { id: socket.id, username: String(username).slice(0, 32), status: isAdmin ? 'approved' : 'pending', isAdmin, gameData: createGameData() };
    if (isAdmin) socket.emit('approved-entry', { isAdmin: true });
    else { socket.emit('waiting-screen'); io.emit('update-pending-list', Object.values(users).filter(u => u.status === 'pending')); }
  });
  socket.on('admin-approve-user', userId => {
    if (users[socket.id]?.isAdmin && users[userId]) {
      users[userId].status = 'approved';
      if (gameRunning) {
        users[userId].gameData.role = 'spectator';
        users[userId].gameData.lifeState = 'spectating';
        users[userId].gameData.hiddenFromGhost = false;
        users[userId].gameData.spectateTargetId = null;
      }
      io.to(userId).emit('approved-entry', { isAdmin: false });
      io.emit('chat message', { user: 'SYSTEM', text: users[userId].username + (gameRunning ? ' joined as a spectator.' : ' joined the game!') });
      io.emit('update-pending-list', Object.values(users).filter(u => u.status === 'pending'));
    }
  });
  socket.on('admin-start-game', requestedMapKey => {
    if (!users[socket.id]?.isAdmin) return;
    activeMapKey = gameMaps[requestedMapKey] ? requestedMapKey : 'crypt';
    const map = getActiveMap();
    gameRunning = false;
    io.emit('map-data', publicMapPayload(activeMapKey));
    const approvedPlayers = Object.values(users).filter(u => u.status === 'approved');
    const safeSpawns = [...map.spawns].sort(() => Math.random() - 0.5);
    approvedPlayers.forEach((p, index) => {
      const spawn = safeSpawns[index % safeSpawns.length];
      p.gameData.role = 'survivor'; p.gameData.lifeState = 'alive'; p.gameData.stamina = MAX_STAMINA; p.gameData.hiddenFromGhost = false; p.gameData.spectateTargetId = null; p.gameData.x = spawn.x; p.gameData.y = spawn.y;
    });
    if (approvedPlayers.length > 0) {
      const ghostIndex = Math.floor(Math.random() * approvedPlayers.length);
      approvedPlayers[ghostIndex].gameData.role = 'ghost'; approvedPlayers[ghostIndex].gameData.lifeState = 'alive'; approvedPlayers[ghostIndex].gameData.stamina = MAX_STAMINA; gameRunning = true;
      io.emit('chat message', { user: 'SYSTEM', text: `GAME STARTED on ${map.name}! Players scattered. The darkness falls... RUN!` });
    }
  });
  socket.on('player-input', inputData => {
    if (!users[socket.id] || users[socket.id].status !== 'approved') return;
    users[socket.id].gameData.input = { w: !!inputData.w, a: !!inputData.a, s: !!inputData.s, d: !!inputData.d, shift: !!inputData.shift };
  });
  socket.on('chat message', msgText => {
    if (users[socket.id]?.status === 'approved' || users[socket.id]?.status === 'pending') io.emit('chat message', { user: users[socket.id].username, text: String(msgText).slice(0, 2000) });
  });
  socket.on('disconnect', () => {
    if (!users[socket.id]) return;
    const departedUser = users[socket.id];
    delete users[socket.id];
    io.emit('chat message', { user: 'SYSTEM', text: departedUser.username + ' left.' });
    if (departedUser.isAdmin) {
      const remainingUsers = Object.values(users);
      if (remainingUsers.length > 0) {
        const newAdmin = remainingUsers[0];
        newAdmin.isAdmin = true; newAdmin.status = 'approved';
        if (gameRunning && newAdmin.gameData) {
          newAdmin.gameData.role = 'spectator';
          newAdmin.gameData.lifeState = 'spectating';
          newAdmin.gameData.hiddenFromGhost = false;
          newAdmin.gameData.spectateTargetId = null;
        }
        io.to(newAdmin.id).emit('approved-entry', { isAdmin: true });
        io.emit('chat message', { user: 'SYSTEM', text: newAdmin.username + ' has been promoted to Admin!' });
      } else gameRunning = false;
    }
    io.emit('update-pending-list', Object.values(users).filter(u => u.status === 'pending'));
  });
});

function checkWallCollision(px, py, radius) {
  for (const wall of getActiveMap().walls) {
    const closestX = Math.max(wall.x, Math.min(px, wall.x + wall.w));
    const closestY = Math.max(wall.y, Math.min(py, wall.y + wall.h));
    const distanceX = px - closestX;
    const distanceY = py - closestY;
    if ((distanceX * distanceX) + (distanceY * distanceY) < (radius * radius)) return true;
  }
  return false;
}
function pointInsideRect(px, py, rect) { return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h; }
function updateHidingState(user, isMoving) {
  const data = user.gameData;
  const inHidingSpot = getActiveMap().hidingSpots.some(spot => pointInsideRect(data.x, data.y, spot));
  data.hiddenFromGhost = data.role === 'survivor' && data.lifeState === 'alive' && inHidingSpot && !isMoving;
}

setInterval(() => {
  let aliveSurvivors = 0;
  let ghostPlayer = null;
  Object.values(users).forEach(user => {
    if (user.status !== 'approved' || !user.gameData) return;
    const data = user.gameData;
    const input = data.input || {};
    const isMoving = !!(input.w || input.a || input.s || input.d);
    const canSprint = isMoving && input.shift && data.stamina > 0 && data.lifeState === 'alive' && data.role !== 'spectator';
    const baseSpeed = data.role === 'ghost' ? 5 : 4;
    const speed = canSprint ? baseSpeed * 1.5 : baseSpeed;
    if (canSprint) data.stamina = Math.max(0, data.stamina - STAMINA_DRAIN_PER_TICK);
    else data.stamina = Math.min(MAX_STAMINA, data.stamina + STAMINA_RECHARGE_PER_TICK);
    let dx = 0, dy = 0;
    if (input.w) dy -= 1; if (input.s) dy += 1; if (input.a) dx -= 1; if (input.d) dx += 1;
    if (dx !== 0 && dy !== 0) { const inv = 1 / Math.sqrt(2); dx *= inv; dy *= inv; }
    const nextX = data.x + dx * speed;
    const nextY = data.y + dy * speed;
    if (data.role === 'spectator' || data.lifeState !== 'alive') { data.x = nextX; data.y = nextY; }
    else { if (!checkWallCollision(nextX, data.y, PLAYER_RADIUS)) data.x = nextX; if (!checkWallCollision(data.x, nextY, PLAYER_RADIUS)) data.y = nextY; }
    data.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, data.x));
    data.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, data.y));
    updateHidingState(user, isMoving);
    if (data.role === 'survivor' && data.lifeState === 'alive') aliveSurvivors++;
    if (data.role === 'ghost') ghostPlayer = user;
  });
  if (gameRunning && ghostPlayer) {
    Object.values(users).forEach(u => {
      if (u.status !== 'approved' || u.gameData.role !== 'survivor' || u.gameData.lifeState !== 'alive' || u.gameData.hiddenFromGhost) return;
      const dx = ghostPlayer.gameData.x - u.gameData.x;
      const dy = ghostPlayer.gameData.y - u.gameData.y;
      if (Math.sqrt(dx * dx + dy * dy) < PLAYER_RADIUS * 2) {
        u.gameData.lifeState = 'dead'; u.gameData.role = 'spectator'; u.gameData.hiddenFromGhost = false; u.gameData.spectateTargetId = ghostPlayer.id; aliveSurvivors--;
        io.emit('chat message', { user: 'SYSTEM', text: `${u.username} was caught by the Ghost!` });
      }
    });
    if (aliveSurvivors === 0) {
      gameRunning = false;
      io.emit('chat message', { user: 'SYSTEM', text: 'THE GHOST WINS! All survivors have been caught.' });
      Object.values(users).forEach(u => { if (u.gameData) { u.gameData.role = 'unassigned'; u.gameData.lifeState = 'spectating'; u.gameData.hiddenFromGhost = false; u.gameData.spectateTargetId = null; } });
    }
  }
  emitPersonalizedGameState();
}, 1000 / TICK_RATE);

http.listen(3000, '0.0.0.0', () => {
  console.log('\n=============================================');
  console.log('Ghost in the Manor Server Running!');
  console.log('=============================================');
  console.log(`Local Access (This PC):  http://localhost:3000`);
  console.log(`Network Access (Phones): http://${hostIp}:3000`);
  console.log('=============================================\n');
});

const express=require("express"), http=require("http"), {Server}=require("socket.io"), path=require("path");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));
const rooms=new Map();
const code=()=>{let s="";do{s=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(s));return s};
function pub(room){io.to(room.code).emit("state",room);}
io.on("connection",socket=>{
 socket.on("create",({name},cb)=>{
  const c=code(), room={code:c,host:socket.id,started:false,seeker:null,players:[{id:socket.id,name:String(name||"Игрок").slice(0,20),tagged:false}]};
  rooms.set(c,room);socket.join(c);socket.data.room=c;cb({ok:true,code:c});pub(room);
 });
 socket.on("join",({code,name},cb)=>{
  const room=rooms.get(String(code||"").toUpperCase());
  if(!room)return cb({ok:false,error:"Комната не найдена"});
  if(room.started)return cb({ok:false,error:"Игра уже началась"});
  if(room.players.length>=35)return cb({ok:false,error:"Комната заполнена (максимум 35 игроков)"});
  room.players.push({id:socket.id,name:String(name||"Игрок").slice(0,20),tagged:false});
  socket.join(room.code);socket.data.room=room.code;cb({ok:true});pub(room);
 });
 socket.on("start",()=>{
  const r=rooms.get(socket.data.room);if(!r||r.host!==socket.id||r.players.length<2)return;
  r.started=true;r.players.forEach(p=>p.tagged=false);r.seeker=r.players[Math.floor(Math.random()*r.players.length)].id;pub(r);
 });
 socket.on("tag",(id)=>{
  const r=rooms.get(socket.data.room);if(!r||!r.started)return;
  if(socket.id!==r.host && socket.id!==r.seeker)return;
  const p=r.players.find(x=>x.id===id);if(!p||p.id===r.seeker||p.tagged)return;
  p.tagged=true;r.seeker=p.id;
  if(r.players.filter(x=>!x.tagged).length<=1)r.started=false;
  pub(r);
 });
 socket.on("finish",()=>{const r=rooms.get(socket.data.room);if(r&&r.host===socket.id){r.started=false;pub(r)}});
 socket.on("disconnect",()=>{
  const c=socket.data.room,r=rooms.get(c);if(!r)return;
  r.players=r.players.filter(p=>p.id!==socket.id);
  if(!r.players.length){rooms.delete(c);return}
  if(r.host===socket.id){r.host=r.players[0].id}
  if(r.seeker===socket.id)r.seeker=r.players[0]?.id||null;
  pub(r);
 });
});
server.listen(process.env.PORT||3000,()=>console.log("Osalka running"));

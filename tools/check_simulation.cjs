const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'..');
class Element {
  constructor(){this.attrs={};this.children=[];this.events={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  setAttribute(name,value){this.attrs[name]=String(value);}
  appendChild(child){this.children.push(child);}
  addEventListener(name,fn){this.events[name]=fn;}
  fire(name,target=this){this.events[name]({target,preventDefault(){}});}
  reportValidity(){return true;}
}
const elements=new Map();
const document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElementNS:()=>new Element()};
const saved=new Map();
const window={matchMedia:()=>({matches:false}),requestAnimationFrame:()=>{},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'simulation.js'),'utf8'),{window,document,Math,Number,Object,String});
const sim=window.cruce2D;
assert.equal(sim.playing,true);
document.getElementById('play').fire('click');assert.equal(sim.playing,false);
document.getElementById('play').fire('click');assert.equal(sim.playing,true);
document.getElementById('speed').fire('input',{value:'1.75'});assert.equal(sim.speed,1.75);
document.getElementById('reference-view').fire('click');assert(elements.get('map-wrap').classes.has('reference-mode'));
document.getElementById('vector-view').fire('click');assert(!elements.get('map-wrap').classes.has('reference-mode'));
document.getElementById('show-guides').fire('change',{checked:false});assert(elements.get('map-wrap').classes.has('hide-guides'));
document.getElementById('show-labels').fire('change',{checked:false});assert(elements.get('map-wrap').classes.has('hide-labels'));
assert.deepEqual(Array.from(sim.signals,s=>s.id),['S1','S2','S3','S4','S5']);
assert(sim.routes.every(route=>route.signal&&route.signalD>0),'Every route must obey its assigned traffic light');
const signal=id=>sim.signals.find(s=>s.id===id);
const activeAt=time=>sim.signals.filter(s=>sim.signalState(s,time).phase!=='red').map(s=>s.id).join('+');
assert.equal(sim.cycleLength,60);
for(const [time,active,phase] of [[0,'S1','green'],[12,'S1','yellow'],[15,'S2+S3','green'],[27,'S2+S3','yellow'],[30,'S4','green'],[42,'S4','yellow'],[45,'S5','green'],[57,'S5','yellow'],[60,'S1','green']]){
  assert.equal(activeAt(time),active);
  assert.equal(sim.signalState(signal(active.split('+')[0]),time).phase,phase);
}
function checkSynchronization(){
  for(let time=-sim.cycleLength;time<sim.cycleLength*3;time+=.25){
    const s2=sim.signalState(signal('S2'),time),s3=sim.signalState(signal('S3'),time);
    assert.equal(s2.phase,s3.phase);assert.equal(s2.remaining,s3.remaining);
    assert(['S1','S2+S3','S4','S5'].includes(activeAt(time)),'Only the ordered stage may be active');
  }
}
checkSynchronization();
document.getElementById('S2-green').value='17';document.getElementById('S2-green').fire('input');
assert.equal(document.getElementById('S3-green').value,'17');
document.getElementById('S1-green').value='17';
document.getElementById('signal-form').fire('submit');
assert.equal(sim.signals[0].green,17);assert.equal(sim.time,0);
assert.equal(JSON.parse(saved.get('cruce2D.signals.sequence.v2')).S1.green,17);
assert.equal(signal('S3').green,17);assert.equal(signal('S3').offset,signal('S2').offset);
assert.equal(sim.cycleLength,70);
assert.deepEqual(Array.from(sim.signals,s=>s.offset),[0,20,20,40,55]);checkSynchronization();
document.getElementById('S1-green').value='0';
document.getElementById('signal-form').fire('submit');assert.equal(sim.signals[0].green,17,'Invalid durations must not be applied');
for(const [id,green,yellow] of [['S1',4,1],['S2',7,2],['S4',3,1],['S5',5,1]]){document.getElementById(`${id}-green`).value=String(green);document.getElementById(`${id}-yellow`).value=String(yellow);}
document.getElementById('signal-form').fire('submit');assert.equal(sim.cycleLength,24);
for(const [time,active] of [[0,'S1'],[5,'S2+S3'],[14,'S4'],[18,'S5'],[24,'S1']])assert.equal(activeAt(time),active);
checkSynchronization();
document.getElementById('reset-signals').fire('click');
assert.equal(sim.signals[0].green,12);assert.equal(sim.time,0);
const exampleRoute={signal:signal('S1'),signalD:40,speed:10,length:100};
const waitingPlan=sim.makePlan(exampleRoute,12);
assert.equal(sim.distanceAt(waitingPlan,30),40,'The car must remain at the red stop line');
assert.equal(sim.distanceAt(waitingPlan,60.5),45,'The car must resume at the next S1 turn');
const geometry=JSON.parse(fs.readFileSync(path.join(root,'map_geometry.json'),'utf8'));
const setFlow=value=>document.getElementById('flow').fire('input',{value:String(value)});
assert.equal(sim.flowPercent,100);
// A stopped leader must not stop a distant follower; the queue closes locally.
setFlow(0);sim.resetSimulation();
const queueRoute=sim.routes.find(r=>r.id==='diagonal-salida');
const queueCars=sim.cars.filter(c=>c.route===queueRoute).slice(0,2);
for(const [index,car] of queueCars.entries()){
  car.d=queueRoute.signalD-index*90;car.active=true;car.plan=sim.makePlan(queueRoute,0);
  Object.assign(car,sim.pointAt(queueRoute,car.d));
}
const followerStart=queueCars[1].d;
for(let i=0;i<30;i++)sim.advance(1/30,false);
assert(queueCars[1].d>followerStart+29,'A distant follower must continue toward the stopped queue');
assert.equal(queueCars[0].d,queueRoute.signalD,'The leader waits at the red signal');
for(let i=0;i<150;i++)sim.advance(1/30,false);
const queuedDistance=queueRoute.signalD-queueCars[1].d;
assert(queuedDistance>=16&&queuedDistance<22,'The follower closes the gap before stopping');
const followerStopped=queueCars[1].d;
for(let i=0;i<1230;i++)sim.advance(1/30,false);
assert(queueCars[0].d>queueRoute.signalD&&queueCars[1].d>followerStopped+20,'Both cars resume when their signal turns green');
setFlow(100);sim.resetSimulation();
const beforeFlow={time:sim.time,speed:sim.speed,cycle:sim.cycleLength,cars:sim.cars.map(c=>[c.active,c.d,c.plan])};
document.getElementById('flow-increase').fire('click');assert.equal(sim.flowPercent,125);
document.getElementById('flow-decrease').fire('click');assert.equal(sim.flowPercent,100);
setFlow(300);assert.equal(saved.get('cruce2D.flow.v1'),'300');
assert.equal(document.getElementById('flow-increase').disabled,true);
assert.equal(sim.time,beforeFlow.time);assert.equal(sim.speed,beforeFlow.speed);assert.equal(sim.cycleLength,beforeFlow.cycle);
sim.cars.forEach((c,i)=>assert.deepEqual([c.active,c.d,c.plan],beforeFlow.cars[i]));
setFlow(0);assert.equal(document.getElementById('flow-decrease').disabled,true);
const stoppedLaunches=sim.routes.map(r=>r.launched);
for(let i=0;i<10800;i++)sim.advance(1/30,false);
assert.deepEqual(sim.routes.map(r=>r.launched),stoppedLaunches);
assert.equal(sim.cars.filter(c=>c.active).length,0,'At zero flow existing cars finish without replacements');
function measureFlow(percent){
  setFlow(percent);sim.resetSimulation();
  const initial=sim.routes.reduce((n,r)=>n+r.launched,0);let activeSamples=0;
  for(let frame=0;frame<1800;frame++){
    sim.advance(1/30,false);
    const active=sim.cars.filter(c=>c.active);activeSamples+=active.length;
    if(frame%3===0)for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)assert(!sim.overlaps(active[i],active[j],0),'Flow adjustment must not cause collisions');

  }
  return {percent,arrivals:sim.routes.reduce((n,r)=>n+r.launched,0)-initial,meanActive:activeSamples/1800};
}
const flowMeasurements=[measureFlow(25),measureFlow(300)];
console.log('Flow measurements:',JSON.stringify(flowMeasurements));
assert(flowMeasurements[1].meanActive>flowMeasurements[0].meanActive,'Higher flow must produce more vehicles on the roads');
setFlow(100);sim.resetSimulation();
assert(sim.cars.filter(c=>c.active&&c.x>=0&&c.x<=693&&c.y>=0&&c.y<=649).length>=50,'At least 50 visible cars at normal flow');
function inRing(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a[1]>y)!=(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;}
function onRoad(x,y){if(x<2||x>691||y<2||y>647)return true;return geometry.roadRings.reduce((inside,ring)=>inRing(x,y,ring.points)?!inside:inside,false);}
const failures=[];
for(const r of sim.routes){let misses=[];for(let d=0;d<r.length;d+=2){const p=sim.pointAt(r,d);for(const [along,across] of [[0,0],[6,3],[6,-3],[-6,3],[-6,-3]]){const x=p.x+along*Math.cos(p.angle)-across*Math.sin(p.angle),y=p.y+along*Math.sin(p.angle)+across*Math.cos(p.angle);if(!onRoad(x,y)){misses.push([+d.toFixed(1),+x.toFixed(1),+y.toFixed(1)]);break;}}}if(misses.length)failures.push({route:r.id,count:misses.length,first:misses[0],last:misses.at(-1)});}
// On the outer stretch of Calle 9a, every sampled vehicle must travel away from
// the crossing. Its only origins must be the two approaches named by the user.
const calle9aOrigins=new Set();
for(const route of sim.routes){
  const on9a=route.points.filter(p=>p.x>5&&p.x<170&&p.y>410&&p.y<480);
  if(!on9a.length)continue;
  assert.equal(route.destination,'calle-9a','Calle 9a must not feed traffic into the crossing');
  assert(['calle-9','gran-colombia'].includes(route.origin),'Unexpected origin for Calle 9a');
  calle9aOrigins.add(route.origin);
  for(const sample of on9a){const p=sim.pointAt(route,sample.d);assert(Math.cos(p.angle)<0,'Calle 9a must flow away from the crossing');}
}
assert.equal(calle9aOrigins.size,2,'Both permitted approaches must reach Calle 9a');
// Calle 10 is the curved lower-left branch. All traffic there must leave the
// crossing, coming from Gran Colombia or either approach of the Diagonal.
const calle10Origins=new Set();
for(const route of sim.routes){
  const on10=route.points.filter(p=>p.x>5&&p.x<200&&p.y>510&&p.y<640);
  if(!on10.length)continue;
  assert.equal(route.destination,'calle-10','Calle 10 must not feed traffic into the crossing');
  assert(['gran-colombia','diagonal-izquierda','diagonal-derecha'].includes(route.origin),'Unexpected origin for Calle 10');
  calle10Origins.add(route.origin);
  for(const sample of on10){const p=sim.pointAt(route,sample.d);assert(Math.cos(p.angle)<0&&Math.sin(p.angle)>0,'Calle 10 must flow away from the crossing');}
}
assert.equal(calle10Origins.size,3,'Gran Colombia and both Diagonal approaches must reach Calle 10');
const rightTurn=sim.routes.find(r=>r.origin==='diagonal-derecha'&&r.destination==='calle-10');
assert(rightTurn.points.some(p=>p.x>390&&p.x<420&&p.y>398&&p.y<426),'The right Diagonal approach must use the marked passage below the long island');
fs.mkdirSync(path.join(root,'verificacion'),{recursive:true});
fs.writeFileSync(path.join(root,'verificacion','routes.json'),JSON.stringify(sim.routes));
fs.writeFileSync(path.join(root,'verificacion','initial-cars.json'),JSON.stringify(sim.cars.filter(c=>c.active).map(({route,node,...rest})=>({...rest,color:route.color,route:route.id}))));
let overlapFrames=0,redViolations=0,waitingSamples=0,minVisible=Infinity;
const launchesBefore=sim.routes.map(r=>r.launched),animationFrames=[];
for(let frame=0;frame<3600;frame++){
  const previous=sim.cars.map(car=>({active:car.active,d:car.d,plan:car.plan}));
  sim.advance(1/30);
  minVisible=Math.min(minVisible,sim.cars.filter(c=>c.active&&c.x>=0&&c.x<=693&&c.y>=0&&c.y<=649).length);
  if(frame<1800&&frame%12===0)animationFrames.push({time:sim.time,cars:sim.cars.filter(c=>c.active).map(c=>({x:c.x,y:c.y,angle:c.angle,color:c.route.color})),signals:sim.signals.map(s=>({id:s.id,x:s.x,y:s.y,head:s.head,label:s.label,...sim.signalState(s,sim.time)}))});
  for(const car of sim.cars){if(!car.active)continue;const before=previous[car.id];if(before.active&&before.plan===car.plan&&before.d<=car.route.signalD+1e-6&&car.d>car.route.signalD+1e-6&&sim.signalState(car.route.signal,car.plan.release).phase!=='green')redViolations++;if(Math.abs(car.d-car.route.signalD)<1e-6&&sim.signalState(car.route.signal,sim.time).phase==='red')waitingSamples++;}
  if(frame%3===0)for(let i=0;i<sim.cars.length;i++)for(let j=i+1;j<sim.cars.length;j++)if(sim.cars[i].active&&sim.cars[j].active&&sim.overlaps(sim.cars[i],sim.cars[j],0))overlapFrames++;
}
fs.writeFileSync(path.join(root,'verificacion','animation-frames.json'),JSON.stringify(animationFrames));
const launches=sim.routes.map((r,i)=>({route:r.id,launched:r.launched-launchesBefore[i]}));
const result={controls:'passed',signals:'S1 → S2+S3 → S4 → S5 → S1; synchronized transitions and configurable stage lengths passed',calle9a:'one-way from Calle 9 and La Gran Colombia',calle10:'one-way from La Gran Colombia and both Diagonal approaches',routes:sim.routes.length,carSlots:sim.cars.length,offRoad:failures,overlapFrames,redViolations,waitingSamples,launches};
result.flow=flowMeasurements;result.minVisible=minVisible;
assert(minVisible>=50,'Normal flow must sustain at least 50 visible vehicles in the default cycle');

console.log(JSON.stringify(result,null,2));
fs.writeFileSync(path.join(root,'verificacion','checks.json'),JSON.stringify(result,null,2));
assert.equal(failures.length,0,'A vehicle route leaves the road');
assert.equal(overlapFrames,0,'Cars overlap');
assert.equal(redViolations,0,'Cars must not enter on red or yellow');
assert(waitingSamples>0,'Cars must visibly wait at red lights');
assert(launches.every(r=>r.launched>0),'Each street must receive moving cars');

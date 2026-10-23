/* Pixel coordinates refer only to the supplied 693 × 649 map screenshot.
   Calle 9a accepts traffic from Calle 9 and La Gran Colombia. Calle 10 is
   one-way away from the crossing, fed by La Gran Colombia and both approaches
   of Diagonal Santander. Other route directions remain illustrative. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const routes = [
    {id:'diagonal-salida', color:'#e9ba62', speed:30, count:4, priority:1,
      segments:[[-20,100, 84,167, 211,251, 286,315], [286,315, 322,349, 338,394, 385,443], [385,443, 423,481, 511,516, 713,615]]},
    {id:'diagonal-regreso', color:'#e9ba62', speed:31, count:4, priority:1,
      segments:[[713,544, 582,456, 463,380, 355,307], [355,307, 263,245, 115,145, -20,56]]},
    {id:'gran-colombia-hacia-10', origin:'gran-colombia', destination:'calle-10', confirmedDirection:true,
      color:'#70c6b5', speed:27, count:4, priority:2,
      segments:[[526,-20, 467,65, 372,205, 331,262], [331,262, 301,294, 279,312, 264,357], [264,357, 246,411, 231,451, 202,484], [202,484, 146,547, 72,599, -20,655]]},
    {id:'gran-colombia-salida', color:'#70c6b5', speed:29, count:3, priority:3,
      segments:[[-20,88, 116,176, 242,268, 298,292], [298,292, 326,303, 348,278, 370,247], [370,247, 421,175, 493,68, 554,-20]]},
    {id:'calle-9', color:'#dca48b', speed:21, count:2, priority:4,
      segments:[[-20,290, 43,279, 109,266, 165,258], [165,258, 208,253, 249,291, 282,321], [282,321, 316,355, 335,393, 381,443], [381,443, 423,482, 515,521, 713,615]]},
    {id:'calle-9-hacia-9a', origin:'calle-9', destination:'calle-9a', confirmedDirection:true,
      color:'#dca48b', speed:20, count:2, priority:5,
      segments:[[-20,290, 43,279, 109,266, 165,258], [165,258, 208,253, 246,289, 276,317], [276,317, 283,341, 231,373, 200,392], [200,392, 154,424, 81,441, -20,471]]},
    {id:'gran-colombia-hacia-9a', origin:'gran-colombia', destination:'calle-9a', confirmedDirection:true,
      color:'#70c6b5', speed:23, count:2, priority:5,
      segments:[[526,-20, 467,65, 372,205, 331,262], [331,262, 304,293, 287,317, 264,345], [264,345, 252,365, 220,379, 200,392], [200,392, 154,424, 81,441, -20,471]]},
    {id:'diagonal-izquierda-hacia-10', origin:'diagonal-izquierda', destination:'calle-10', confirmedDirection:true,
      color:'#e9ba62', speed:26, count:2, priority:6,
      segments:[[-20,100, 84,167, 211,251, 264,300], [264,300, 283,318, 275,334, 264,357], [264,357, 246,411, 231,451, 202,484], [202,484, 146,547, 72,599, -20,655]]},
    {id:'diagonal-derecha-hacia-10', origin:'diagonal-derecha', destination:'calle-10', confirmedDirection:true,
      color:'#e9ba62', speed:26, count:2, priority:6,
      // Follow the user's marked connection below the long island, then join
      // Calle 10 after the triangular island instead of turning at the main node.
      segments:[[713,544, 673,517, 625,486, 590,468], [590,468, 523,433, 466,408, 413,410], [413,410, 365,411, 345,401, 316,415], [316,415, 274,435, 239,452, 202,484], [202,484, 146,547, 72,599, -20,655]]},
  ];

  const timingFields=['green','yellow'];
  const limits={green:[1,180],yellow:[0,30]};
  const storageKey='cruce2D.signals.sequence.v2';
  const flowStorageKey='cruce2D.flow.v1',maxFlowPercent=300;
  let flowPercent=100;
  const validFlow=value=>Number.isInteger(value)&&value>=0&&value<=maxFlowPercent&&value%25===0;
  try{const stored=window.localStorage.getItem(flowStorageKey);if(stored!==null&&String(stored).trim()!==''&&validFlow(Number(stored)))flowPercent=Number(stored);}catch{}
  // Positions are the five red marks in the user's screenshot, in map pixels.
  const signals=[
    {id:'S1',name:'La Gran Colombia',x:326,y:247,head:[0,0],label:[-24,-22],defaults:{green:12,yellow:3}},
    {id:'S2',name:'Diagonal desde la derecha',x:370,y:315,head:[0,0],label:[23,-8],defaults:{green:12,yellow:3}},
    {id:'S3',name:'Giro de la Diagonal a Calle 10',x:410,y:405,head:[0,0],label:[25,-18],defaults:{green:12,yellow:3}},
    {id:'S4',name:'Ingreso desde Calle 9',x:252,y:297,head:[-14,13],label:[-39,30],defaults:{green:12,yellow:3}},
    {id:'S5',name:'Diagonal desde la izquierda',x:257,y:282,head:[7,-8],label:[-19,-27],defaults:{green:12,yellow:3}},
  ];
  const stages=[
    {id:'S1',members:['S1'],name:'S1'},
    {id:'S23',members:['S2','S3'],name:'S2 + S3'},
    {id:'S4',members:['S4'],name:'S4'},
    {id:'S5',members:['S5'],name:'S5'},
  ];
  let cycleLength=0;
  const signalForRoute={
    'diagonal-salida':'S5','diagonal-regreso':'S2','gran-colombia-hacia-10':'S1',
    'gran-colombia-salida':'S5','calle-9':'S4','calle-9-hacia-9a':'S4',
    'gran-colombia-hacia-9a':'S1','diagonal-izquierda-hacia-10':'S5','diagonal-derecha-hacia-10':'S3',
  };
  const bySignal=id=>signals.find(signal=>signal.id===id);
  const validTiming=config=>config&&timingFields.every(field=>Number.isInteger(config[field])&&config[field]>=limits[field][0]&&config[field]<=limits[field][1]);
  let savedTimings=null;
  try{savedTimings=JSON.parse(window.localStorage.getItem(storageKey)||window.localStorage.getItem('cruce2D.signals.v1'));}catch{}
  for(const signal of signals){const config=validTiming(savedTimings?.[signal.id])?savedTimings[signal.id]:signal.defaults;for(const field of timingFields)signal[field]=config[field];}
  function rebuildCycle() {
    // S3 shares every transition with S2, regardless of previous saved settings.
    bySignal('S3').green=bySignal('S2').green;bySignal('S3').yellow=bySignal('S2').yellow;
    let elapsed=0;
    for(const stage of stages){
      const leader=bySignal(stage.members[0]);stage.start=elapsed;stage.duration=leader.green+leader.yellow;
      for(const id of stage.members)bySignal(id).offset=elapsed;
      elapsed+=stage.duration;
    }
    cycleLength=elapsed;
    for(const signal of signals)signal.red=cycleLength-signal.green-signal.yellow;
  }
  rebuildCycle();

  function signalState(signal,time) {
    const cycle=cycleLength;
    const elapsed=((time-signal.offset)%cycle+cycle)%cycle;
    if(elapsed<signal.green)return {phase:'green',name:'Verde',remaining:Math.ceil(signal.green-elapsed),color:'#54d38a'};
    if(elapsed<signal.green+signal.yellow)return {phase:'yellow',name:'Amarillo',remaining:Math.ceil(signal.green+signal.yellow-elapsed),color:'#f4c357'};
    return {phase:'red',name:'Rojo',remaining:Math.ceil(cycle-elapsed),color:'#f16e61'};
  }
  function nextGreen(signal,time) {
    if(signalState(signal,time).phase==='green')return time;
    const cycle=cycleLength;
    // Integer cycle boundaries avoid a floating-point value just before green.
    return (Math.floor((time-signal.offset)/cycle)+1)*cycle+signal.offset;
  }

  function bezier(s,t) {
    const u=1-t;
    return {x:u*u*u*s[0]+3*u*u*t*s[2]+3*u*t*t*s[4]+t*t*t*s[6],
      y:u*u*u*s[1]+3*u*u*t*s[3]+3*u*t*t*s[5]+t*t*t*s[7]};
  }
  function prepareRoute(route) {
    route.points=[];route.length=0;
    route.segments.forEach((segment,index)=>{
      for(let i=index?1:0;i<=140;i++) {
        const p=bezier(segment,i/140), prev=route.points.at(-1);
        if(prev) route.length+=Math.hypot(p.x-prev.x,p.y-prev.y);
        route.points.push({...p,d:route.length});
      }
    });
    route.path=route.segments.map((s,i)=>(i?'':`M${s[0]},${s[1]} `)+`C${s.slice(2).join(' ')}`).join(' ');
    return route;
  }
  function pointAt(route,distance) {
    const points=route.points;
    const d=Math.max(0,Math.min(distance,route.length));
    let low=0,high=points.length-1;
    while(low+1<high) {const mid=(low+high)>>1;if(points[mid].d<d)low=mid;else high=mid;}
    const a=points[low],b=points[high],k=(d-a.d)/(b.d-a.d||1);
    return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,angle:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  const create=(tag,attrs,parent)=>{
    const el=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
    if(parent)parent.appendChild(el);
    return el;
  };
  const carGroup=document.getElementById('vehicles'),guideGroup=document.getElementById('route-guides');
  const cars=[];
  routes.forEach((raw,ri)=>{
    const r=prepareRoute(raw);
    r.signal=bySignal(signalForRoute[r.id]);
    const nearest=r.points.reduce((best,p)=>Math.hypot(p.x-r.signal.x,p.y-r.signal.y)<Math.hypot(best.x-r.signal.x,best.y-r.signal.y)?p:best);
    r.signalD=Math.max(0,nearest.d-10);
    const stop=pointAt(r,r.signalD+9),normal={x:-Math.sin(stop.angle),y:Math.cos(stop.angle)};
    create('line',{x1:stop.x-normal.x*6,y1:stop.y-normal.y*6,x2:stop.x+normal.x*6,y2:stop.y+normal.y*6,class:'stop-line'},document.getElementById('stop-lines'));
    create('path',{d:r.path,stroke:r.color,class:'route-guide'},guideGroup);
    // Few arrows, placed only on straight road sections; never a lane-count claim.
    for(const d of [r.length*.15,r.length*.78]) {
      const p=pointAt(r,d);
      if(p.x>15&&p.x<678&&p.y>15&&p.y<634)
        create('path',{d:'M-6,-2.7 L0,-2.7 L0,-5 L6,0 L0,5 L0,2.7 L-6,2.7 Z',transform:`translate(${p.x} ${p.y}) rotate(${p.angle*180/Math.PI})`},document.getElementById('direction-arrows'));
    }
    // Reserve enough reusable sprites for the maximum arrival rate. Inactive
    // sprites stay hidden; the flow control changes departures, not car speed.
    for(let i=0;i<r.count*9;i++) {
      const node=create('g',{filter:'url(#car-shadow)'},carGroup);
      create('rect',{x:-8,y:-3.7,width:16,height:7.4,rx:2.4,fill:r.color,stroke:'#203a37','stroke-width':'.65'},node);
      create('rect',{x:-3.1,y:-3,width:6.8,height:6,rx:1.6,fill:'#234743',opacity:'.85'},node);
      create('path',{d:'M3.6 -2.5 L5.5 -2 L5.5 2 L3.6 2.5 Z',fill:'#d3e9dc',opacity:'.92'},node);
      create('path',{d:'M-4.4 -2.4 L-5.7 -1.8 L-5.7 1.8 L-4.4 2.4 Z',fill:'#d3e9dc',opacity:'.55'},node);
      create('path',{d:'M7.4 -2.1 L7.4 -1 M7.4 1 L7.4 2.1',stroke:'#fff4cd','stroke-width':'1.2'},node);
      create('path',{d:'M-7.3 -2.2 L-7.3 -1 M-7.3 1 L-7.3 2.2',stroke:'#8e473a','stroke-width':'1'},node);
      node.setAttribute('display','none');
      cars.push({route:r,d:0,node,...pointAt(r,0),active:false,id:cars.length});
    }
    r.nextSpawn=ri*1.7;r.retryIn=0;r.launched=0;
  });
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing=!reduced, speed=1, lastTime=null,simulationTime=-72;
  const draw=car=>car.node.setAttribute('transform',`translate(${car.x.toFixed(2)} ${car.y.toFixed(2)}) rotate(${(car.angle*180/Math.PI).toFixed(2)})`);

  for(const signal of signals) {
    const group=create('g',{class:'traffic-light',id:`light-${signal.id}`,role:'button',tabindex:0,'aria-label':`${signal.id}: ${signal.name}. Configurar tiempos.`},document.getElementById('traffic-lights'));
    const hx=signal.x+signal.head[0],hy=signal.y+signal.head[1],lx=signal.x+signal.label[0],ly=signal.y+signal.label[1];
    create('line',{x1:signal.x,y1:signal.y,x2:hx,y2:hy+13,stroke:'#263e37','stroke-width':2},group);
    create('circle',{cx:signal.x,cy:signal.y,r:2.5,fill:'#f5f3df',stroke:'#263e37','stroke-width':1},group);
    create('rect',{x:hx-5.5,y:hy-13,width:11,height:26,rx:3,fill:'#233830',stroke:'#f6f2da','stroke-width':1},group);
    signal.lamps={};
    for(const [index,phase] of ['red','yellow','green'].entries())signal.lamps[phase]=create('circle',{cx:hx,cy:hy-8+index*8,r:3,fill:'#42544a'},group);
    create('line',{x1:hx,y1:hy-8,x2:lx,y2:ly,stroke:'#334c40','stroke-width':'.8'},group);
    create('rect',{x:lx-13,y:ly-8,width:26,height:16,rx:4,fill:'#254c40',stroke:'#f6f2da','stroke-width':1,class:'signal-label'},group);
    const label=create('text',{x:lx,y:ly,class:'signal-id'},group);label.textContent=signal.id;
    const focusControls=()=>{document.getElementById(`settings-${signal.id}`).scrollIntoView?.({behavior:reduced?'auto':'smooth',block:'center'});document.getElementById(`${signal.id}-green`).focus?.({preventScroll:true});};
    group.addEventListener('click',focusControls);
    group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();focusControls();}});
    signal.node=group;
  }
  let lastSignalPaint='';
  function renderSignals(force=false) {
    const stamp=Math.floor(simulationTime*5);
    if(!force&&lastSignalPaint===stamp)return;
    lastSignalPaint=stamp;
    for(const signal of signals) {
      const state=signalState(signal,simulationTime);
      for(const phase of ['red','yellow','green'])signal.lamps[phase].setAttribute('fill',phase===state.phase?state.color:'#42544a');
      const label=document.getElementById(`state-${signal.id}`);
      label.textContent=`${state.name} · ${state.remaining} s`;label.setAttribute('data-phase',state.phase);
      signal.node.setAttribute('aria-label',`${signal.id}: ${signal.name}. ${state.name}, ${state.remaining} segundos. Configurar tiempos.`);
    }
    const currentStage=stages.find(stage=>signalState(bySignal(stage.members[0]),simulationTime).phase!=='red');
    for(const stage of stages)document.getElementById(`stage-${stage.id}`).setAttribute('data-active',String(stage===currentStage));
    document.getElementById('sequence-status').textContent=`Turno actual: ${currentStage.name} · ${signalState(bySignal(currentStage.members[0]),simulationTime).name}`;
    document.getElementById('cycle-length').textContent=`${cycleLength} s`;
    document.getElementById('flow-active').textContent=String(cars.filter(car=>car.active).length);
    const seconds=Math.max(0,Math.floor(simulationTime+1e-6));
    document.getElementById('simulation-clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }

  function makePlan(route,start) {
    const arrival=start+route.signalD/route.speed;
    const release=nextGreen(route.signal,arrival);
    return {start,arrival,release,stopD:route.signalD,speed:route.speed,end:start+route.length/route.speed+release-arrival};
  }
  function distanceAt(plan,time) {
    if(time<plan.arrival)return Math.max(0,(time-plan.start)*plan.speed);
    if(time<plan.release)return plan.stopD;
    return plan.stopD+(time-plan.release)*plan.speed;
  }

  // Oriented rectangles give each car space, including where different routes merge.
  function overlaps(a,b,padding=1.7) {
    if(Math.hypot(a.x-b.x,a.y-b.y)>22+padding*2)return false;
    const axes=[[Math.cos(a.angle),Math.sin(a.angle)],[-Math.sin(a.angle),Math.cos(a.angle)],
      [Math.cos(b.angle),Math.sin(b.angle)],[-Math.sin(b.angle),Math.cos(b.angle)]];
    const halfLong=8+padding,halfWide=3.7+padding;
    for(const [ax,ay] of axes) {
      const radius=p=>halfLong*Math.abs(ax*Math.cos(p.angle)+ay*Math.sin(p.angle))+halfWide*Math.abs(-ax*Math.sin(p.angle)+ay*Math.cos(p.angle));
      if(Math.abs(ax*(a.x-b.x)+ay*(a.y-b.y))>=radius(a)+radius(b))return false;
    }
    return true;
  }
  const targetCars=()=>Math.round(65*flowPercent/100);
  function placeCar(route,d) {
    const slot=cars.find(c=>c.route===route&&!c.active),p=pointAt(route,d);
    if(!slot||cars.some(c=>c.active&&overlaps(p,c,2)))return false;
    Object.assign(slot,{active:true,d,plan:makePlan(route,simulationTime)},p);
    route.launched++;slot.node.setAttribute('display','');draw(slot);return true;
  }
  function advance(dt,render=true) {
    // Short steps and current positions allow real queues behind red lights.
    const steps=Math.max(1,Math.ceil(dt/.04)),step=dt/steps;
    for(let tick=0;tick<steps;tick++) {
      simulationTime+=step;
      const active=cars.filter(c=>c.active).sort((a,b)=>b.d/b.route.length-a.d/a.route.length);
      const destinations=new Map(active.map(car=>[car,car.d+car.route.speed*step]));
      // Resolve the front of each queue first, including shared stretches of
      // different routes. A follower can use space freed during this same step.
      for(let pass=0;pass<2;pass++)for(const car of active) {
        if(!car.active)continue;
        let d=destinations.get(car);
        if(car.d<=car.route.signalD+1e-6&&signalState(car.route.signal,simulationTime).phase!=='green')d=Math.min(d,car.route.signalD);
        if(d<=car.d+1e-7)continue;
        const nearby=active.filter(other=>other!==car&&other.active&&(other.x-car.x)**2+(other.y-car.y)**2<900);
        const blocked=distance=>{
          const position=pointAt(car.route,distance);
          return nearby.some(other=>{
            // The user accepts visual overlap at S4/S5 so the original
            // waiting positions can stay in place. Only this crossing is
            // exempt; cars in the same queue still keep their separation.
            const pair=[car.route.signal.id,other.route.signal.id];
            if(pair.includes('S4')&&pair.includes('S5')&&
              distance<=car.route.signalD+40&&other.d<=other.route.signalD+40)return false;
            // A turning leader can sweep its rear safety margin over its
            // follower. Keep physical clearance without locking both cars.
            const behind=(other.x-car.x)*Math.cos(car.angle)+(other.y-car.y)*Math.sin(car.angle)<0;
            return overlaps(position,other,behind?0:1);
          });
        };
        // Advance to the available gap instead of discarding the whole movement
        // whenever its endpoint would touch the preceding vehicle.
        if(blocked(d)) {
          if(blocked(Math.min(d,car.d+.001)))continue;
          let low=car.d,high=d;
          for(let i=0;i<12;i++){const middle=(low+high)/2;if(blocked(middle))high=middle;else low=middle;}
          d=low;
        }
        if(d<=car.d+1e-7)continue;
        const candidate=pointAt(car.route,d);
        if(car.d<=car.route.signalD+1e-6&&d>car.route.signalD+1e-6)car.plan.release=simulationTime;
        car.d=d;Object.assign(car,candidate);
        if(d>=car.route.length){car.active=false;car.node.setAttribute('display','none');}
        else if(render)draw(car);
      }
      routes.forEach(r=>{r.nextSpawn-=step;});
      let count=cars.filter(c=>c.active).length;
      if(flowPercent>0&&count<targetCars())for(const route of [...routes].sort((a,b)=>a.nextSpawn-b.nextSpawn)) {
        if(count>=targetCars())break;
        if(route.nextSpawn>0)continue;
        if(placeCar(route,25)){count++;route.nextSpawn=1.5/(flowPercent/100);}
      }
    }
    if(render)renderSignals();
  }
  function resetSimulation() {
    simulationTime=0;lastTime=null;
    cars.forEach(car=>{car.active=false;car.d=0;delete car.plan;car.node.setAttribute('display','none');});
    routes.forEach((route,index)=>{route.nextSpawn=index*.15;route.launched=0;});
    // Spread the initial population over existing routes without overlapping.
    let count=0;
    for(let distance=35;distance<1200&&count<targetCars();distance+=25)for(const route of routes) {
      if(count>=targetCars())break;
      if(distance<route.length-30&&placeCar(route,route.length-distance))count++;
    }
    renderSignals(true);
  }
  function updateFlowControls() {
    const name=flowPercent===0?'Sin entradas':flowPercent<100?'Bajo':flowPercent===100?'Normal':'Alto';
    const text=`${flowPercent} % · ${targetCars()} carros · ${name}`;
    document.getElementById('flow').value=String(flowPercent);
    document.getElementById('flow').setAttribute('aria-valuetext',text);
    document.getElementById('flow-value').textContent=text;
    document.getElementById('flow-decrease').disabled=flowPercent===0;
    document.getElementById('flow-increase').disabled=flowPercent===maxFlowPercent;
  }
  function setFlow(value) {
    if(!validFlow(value))return;
    const previous=flowPercent;flowPercent=value;
    if(value>0)routes.forEach((route,index)=>{
      route.nextSpawn=previous>0?Math.max(0,route.nextSpawn)*previous/value:index*.25;
      route.retryIn=0;
    });
    try{window.localStorage.setItem(flowStorageKey,String(flowPercent));}catch{}
    updateFlowControls();
  }
  document.getElementById('flow').addEventListener('input',event=>setFlow(Number(event.target.value)));
  document.getElementById('flow-decrease').addEventListener('click',()=>setFlow(Math.max(0,flowPercent-25)));
  document.getElementById('flow-increase').addEventListener('click',()=>setFlow(Math.min(maxFlowPercent,flowPercent+25)));
  updateFlowControls();
  function fillTimingInputs() {
    for(const signal of signals)for(const field of [...timingFields,'red','offset'])document.getElementById(`${signal.id}-${field}`).value=signal[field];
  }
  function saveTimings() {
    const config=Object.fromEntries(signals.map(signal=>[signal.id,Object.fromEntries(timingFields.map(field=>[field,signal[field]]))]));
    try{window.localStorage.setItem(storageKey,JSON.stringify(config));return true;}catch{return false;}
  }
  const timingForm=document.getElementById('signal-form');
  timingForm.addEventListener('submit',event=>{
    event.preventDefault();if(!timingForm.reportValidity())return;
    const proposed=signals.map(signal=>Object.fromEntries(timingFields.map(field=>{const value=document.getElementById(`${signal.id==='S3'?'S2':signal.id}-${field}`).value;return [field,String(value).trim()===''?NaN:Number(value)];})));
    if(!proposed.every(validTiming)){document.getElementById('signal-feedback').textContent='Revisa los tiempos: usa segundos enteros dentro de los límites indicados.';return;}
    signals.forEach((signal,index)=>Object.assign(signal,proposed[index]));
    rebuildCycle();fillTimingInputs();const persisted=saveTimings();resetSimulation();
    document.getElementById('signal-feedback').textContent=persisted?'Tiempos guardados. El ciclo se reinició en 00:00.':'Tiempos aplicados. El ciclo se reinició en 00:00.';
    document.getElementById('announcer').textContent='Tiempos de S1 a S5 aplicados. Ciclo reiniciado.';
  });
  document.getElementById('reset-signals').addEventListener('click',()=>{
    signals.forEach(signal=>Object.assign(signal,signal.defaults));rebuildCycle();fillTimingInputs();saveTimings();resetSimulation();
    document.getElementById('signal-feedback').textContent='Tiempos iniciales restablecidos. Ciclo reiniciado en 00:00.';
  });
  for(const field of timingFields)document.getElementById(`S2-${field}`).addEventListener('input',()=>{document.getElementById(`S3-${field}`).value=document.getElementById(`S2-${field}`).value;});
  fillTimingInputs();resetSimulation();
  function frame(time) {
    if(lastTime!==null&&playing)advance(Math.min((time-lastTime)/1000,.06)*speed);
    lastTime=time;window.requestAnimationFrame(frame);
  }
  const play=document.getElementById('play');
  function updatePlay(announce=false) {
    document.getElementById('play-label').textContent=playing?'Pausar simulación':'Reanudar simulación';
    document.getElementById('play-symbol').textContent=playing?'Ⅱ':'▶';
    play.setAttribute('aria-label',playing?'Pausar simulación':'Reanudar simulación');
    document.getElementById('motion-status').textContent=playing?'SIMULACIÓN ACTIVA':'SIMULACIÓN EN PAUSA';
    document.getElementById('status-dot').classList.toggle('paused',!playing);
    if(announce)document.getElementById('announcer').textContent=playing?'Carros y semáforos en movimiento.':'Carros y semáforos en pausa.';
  }
  play.addEventListener('click',()=>{playing=!playing;updatePlay(true);});
  document.getElementById('speed').addEventListener('input',event=>{
    speed=Number(event.target.value);document.getElementById('speed-value').textContent=`${speed.toLocaleString('es')}×`;
  });
  const mapWrap=document.getElementById('map-wrap');
  function setReference(enabled) {
    mapWrap.classList.toggle('reference-mode',enabled);
    document.getElementById('vector-view').setAttribute('aria-pressed',String(!enabled));
    document.getElementById('reference-view').setAttribute('aria-pressed',String(enabled));
    document.getElementById('announcer').textContent=enabled?'Captura original con los mismos recorridos.':'Plano 2D con los mismos recorridos.';
  }
  document.getElementById('vector-view').addEventListener('click',()=>setReference(false));
  document.getElementById('reference-view').addEventListener('click',()=>setReference(true));
  document.getElementById('show-guides').addEventListener('change',event=>mapWrap.classList.toggle('hide-guides',!event.target.checked));
  document.getElementById('show-labels').addEventListener('change',event=>mapWrap.classList.toggle('hide-labels',!event.target.checked));
  // Exposes the geometry for reproducible offline checks and the next model stage.
  window.cruce2D={routes,cars,signals,stages,signalState,makePlan,distanceAt,resetSimulation,pointAt,advance,overlaps,get flowPercent(){return flowPercent;},get cycleLength(){return cycleLength;},get time(){return simulationTime;},get playing(){return playing;},get speed(){return speed;}};
  updatePlay();window.requestAnimationFrame(frame);
})();

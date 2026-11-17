export class Sound {
  constructor(){this.ctx=null;this.volume=.35;}
  init(){try{this.ctx ||= new (window.AudioContext||window.webkitAudioContext)();this.ctx.resume();}catch{}}
  tone(freq,duration,type='sine',gain=.15,end=freq,delay=0){if(!this.ctx||!this.volume)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(end,20),t+duration);g.gain.setValueAtTime(gain*this.volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration);}
  charge(on){
    if(this.charging){const {o,g}=this.charging;try{o.stop();}catch{}o.disconnect();g.disconnect();this.charging=null;}
    if(!on||!this.ctx||!this.volume)return;
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(260,c.currentTime);o.frequency.exponentialRampToValueAtTime(1100,c.currentTime+.8);g.gain.setValueAtTime(.09*this.volume,c.currentTime);o.connect(g);g.connect(c.destination);o.start();this.charging={o,g};
  }
  play(name,variant=0){switch(name){
    case 'shot':
      if(variant===2){[440,660,880,1320].forEach((n,i)=>this.tone(n,.3,'sine',.2,n*1.6,i*.018));this.tone(170,.18,'triangle',.3,65);}
      else if(variant===3){this.tone(420,.14,'sine',.4,130);this.tone(820,.08,'triangle',.14,430);}
      else{this.tone(variant?170:600,variant?.2:.09,'triangle',variant?.6:.38,variant?45:190);this.tone(variant?720:1350,.055,'square',.07,220);if(variant===1)[900,1200,1500].forEach((n,i)=>this.tone(n,.09,'sine',.12,700,i*.025));}break;
    case 'bounce':this.tone(280,.17,'sine',.3,950);break;
    case 'hit':this.tone(860,.10,'sine',.35,1400);break;
    case 'hurt':this.tone(200,.18,'triangle',.4,70);break;
    case 'slide':this.tone(210,.32,'triangle',.14,55);this.tone(85,.4,'sine',.18,35);break;
    case 'land':this.tone(90,.1,'sine',.18,40);break;
    case 'jump':this.tone(170,.16,'sine',.22,340);break;
    case 'pickup':[660,880,1100].forEach((n,i)=>this.tone(n,.15,'sine',.28,n,i*.07));break;
    case 'reload':this.tone([320,180,550,390][variant],.10,'triangle',.25,440);this.tone([550,340,950,700][variant],.10,'triangle',.25,750,.18);break;
    case 'build':this.tone(240,.15,'triangle',.4,160);this.tone(600,.12,'sine',.23,800,.08);break;
    case 'pop':[520,780,1040].forEach((n,i)=>this.tone(n,.23,'triangle',.3,n*1.1,i*.06));break;
    case 'win':[523,659,784,1047,784,1047].forEach((n,i)=>this.tone(n,.45,'triangle',.4,n,i*.15));break;
    case 'lose':[440,349,294].forEach((n,i)=>this.tone(n,.4,'triangle',.3,n,i*.17));break;
    case 'empty':this.tone(120,.06,'square',.12,100);break;
  }}
}

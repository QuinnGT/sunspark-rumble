export const RULES = Object.freeze({
  radius: 67, walk: 6.8, sprint: 10.6, aimSpeed: 4.2, jump: 10.5, gravity: 25,
  playerRadius: .48, playerHeight: 2.25, stepHeight: .55, maxHealth: 100, maxShield: 100,
  buildCost: 10, startingWood: 80, maxWood: 200, wallHealth: 150,
  stormStart: 45, stormEnd: 255, stormRadius: 65, stormDamage: 7,
});
export const WEAPONS = [
  { name:'Spark blaster', short:'SPARK', role:'MID RANGE', hint:'Hold fire · Steady golden sparks', icon:'━▰━', magazine:24, reserve:144, maxReserve:240, pickupAmmo:36, reload:1.35, interval:.15, damage:19, pellets:1, spread:.010, range:80, color:0xffe361 },
  { name:'Confetti cannon', short:'CONFETTI', role:'SHORT RANGE', hint:'Wide party burst · Close-range knockback', icon:'▰▰━', magazine:6, reserve:36, maxReserve:60, pickupAmmo:8, reload:1.7, interval:.72, damage:13, pellets:7, spread:.105, range:28, color:0xff81ae },
  { name:'Prism popper', short:'PRISM', role:'LONG RANGE', hint:'Click to charge & fire · Right mouse zooms', icon:'◇━━', magazine:4, reserve:20, maxReserve:40, pickupAmmo:6, reload:1.9, interval:.65, charge:.8, damage:88, pellets:1, spread:0, range:140, color:0x9c9aff },
  { name:'Gumball blaster', short:'GUMBALL', role:'BOUNCING SHOTS', hint:'Hold fire · Bounces once off solid cover', icon:'●●━', magazine:12, reserve:72, maxReserve:120, pickupAmmo:18, reload:1.55, interval:.28, damage:30, pellets:1, spread:.006, range:52, speed:32, color:0x66efc1 },
];
export const PARTY_COLORS=[0xff86b7,0xffe571,0x70edcc,0x9aa9ff,0xffad67];
export const DIFFICULTIES = {
  easy: {label:'Easy',description:'Active opponents, room to learn',damage:9,spread:.045,lead:0,vision:30,hearing:24,fov:150,memory:3,reaction:.8,sense:.35,shotInterval:.48,burst:2,burstPause:1.1,magazine:8,reload:2.9,speed:3.8,strafe:2,health:75,shield:25,grace:6,maxAttackers:1,assist:.065,cover:0.35,builds:1,buildDelay:18,highGround:0,jump:false},
  medium: {label:'Medium',description:'Flanks, cover, and short bursts',damage:12,spread:.028,lead:.25,vision:39,hearing:32,fov:185,memory:5,reaction:.5,sense:.24,shotInterval:.31,burst:3,burstPause:.8,magazine:12,reload:2.5,speed:4.4,strafe:3.5,health:90,shield:35,grace:4,maxAttackers:2,assist:.035,cover:.65,builds:3,buildDelay:12,highGround:.35,jump:true},
  hard: {label:'Hard',description:'Sharp aim and climbing builders',damage:14,spread:.018,lead:.6,vision:49,hearing:40,fov:220,memory:7,reaction:.3,sense:.17,shotInterval:.23,burst:4,burstPause:.6,magazine:16,reload:2.15,speed:5,strafe:5,health:100,shield:50,grace:2,maxAttackers:3,assist:.025,cover:.85,builds:5,buildDelay:8,highGround:.7,jump:true},
  insane: {label:'Insane',description:'Fast reactions, relentless pressure',damage:16,spread:.011,lead:.85,vision:58,hearing:48,fov:260,memory:9,reaction:.18,sense:.12,shotInterval:.18,burst:5,burstPause:.4,magazine:20,reload:1.85,speed:5.6,strafe:6,health:100,shield:50,grace:1,maxAttackers:4,assist:.02,cover:1,builds:7,buildDelay:5.5,highGround:1,jump:true},
};
export const difficultyKey=value=>value==='normal'?'medium':Object.hasOwn(DIFFICULTIES,value)?value:'easy';
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function seeded(seed = 12345) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }; }
export function stormRadius(time) {
  if (time < RULES.stormStart) return RULES.stormRadius;
  return RULES.stormRadius * (1 - clamp((time - RULES.stormStart) / (RULES.stormEnd - RULES.stormStart), 0, 1));
}
export function applyDamage(actor, amount, bypassShield = false) {
  const absorbed = bypassShield ? 0 : Math.min(actor.shield, amount);
  actor.shield -= absorbed; actor.health = Math.max(0, actor.health - (amount - absorbed));
  return { absorbed, healthDamage: amount - absorbed, eliminated: actor.health <= 0 };
}


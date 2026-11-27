const profile = (name, speed, reaction, miss, attack, placement, blurb) => ({name, speed, reaction, miss, attack, placement, blurb});
export const tiers = [
  profile('초심', 2.35,.34,.31,.04,.06,'느린 발과 잦은 실수. 랠리에 익숙해지는 단계'),
  profile('D조', 2.95,.28,.23,.09,.13,'기본 리턴은 하지만 코스가 단조롭습니다'),
  profile('C조', 3.55,.21,.16,.15,.23,'빈 곳을 노리기 시작하고 실수가 줄어듭니다'),
  profile('B조', 4.15,.15,.10,.23,.35,'스매시가 섞이고 수비 범위가 넓어집니다'),
  profile('A조', 5.05,.085,.047,.46,.64,'빠른 반응과 공격적인 결정구. 여기서부터 어렵습니다'),
  profile('자강조', 5.55,.060,.028,.57,.77,'실수가 거의 없고 코스를 정확히 찌릅니다'),
  profile('실업 선수', 6.05,.040,.014,.68,.88,'프로 수준의 발과 공격 전개'),
  profile('국가대표', 6.65,.018,.004,.80,.98,'거의 모든 공을 받아내는 최상위 상대'),
];
export const winsToPromote = 10;
const prefix = 'minton-ranked-win:';
export function career(storage) {
  const wins = tiers.map(()=>0);
  for (let i=0;i<storage.length;i++) {
    const key=storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const rank=Number(key.slice(prefix.length).split(':')[0]);
    if (Number.isInteger(rank) && tiers[rank]) wins[rank]++;
  }
  return standing(wins);
}
// Wins per tier -> current tier. The first tier short of the promotion target is the current one.
export function standing(wins) {
  const next=tiers.findIndex((_,i)=>(wins[i]||0)<winsToPromote);
  const rank=next<0?tiers.length-1:next;
  return {rank,wins:Math.min(wins[rank]||0,winsToPromote)};
}

export function recordResult(storage,matchId,rank,won) {
  const before=career(storage);
  if (!won || rank!==before.rank || before.wins>=winsToPromote) return before;
  storage.setItem(prefix+rank+':'+matchId,'1');
  return career(storage);
}

// "승급전" only when the next win promotes (9/10). The top tier has no promotion.
export function promotionMatch(standing) {
  return standing.rank < tiers.length - 1 && standing.wins === winsToPromote - 1;
}
// Ranked single play: own tier and below. AI practice: any tier.
export function selectable(rank, standing, practice = false) {
  return practice || rank <= standing.rank;
}

// Dependency-free validation for this repository's explicit stable semver ranges.
// Reject unsupported syntax rather than guessing compatibility.
export function acceptsLocalVersion(range, version) {
  const actual=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  const declared=/^(\^?)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(range);
  if(!actual||!declared)return false;
  const a=actual.slice(1).map(Number),b=declared.slice(2).map(Number);
  if(![...a,...b].every(Number.isSafeInteger))return false;
  if(!declared[1])return a.every((n,i)=>n===b[i]);
  const cmp=a[0]!==b[0]?Math.sign(a[0]-b[0]):a[1]!==b[1]?Math.sign(a[1]-b[1]):Math.sign(a[2]-b[2]);
  if(cmp<0)return false;
  return b[0]>0?a[0]===b[0]:b[1]>0?a[0]===0&&a[1]===b[1]:a[0]===0&&a[1]===0&&a[2]===b[2];
}

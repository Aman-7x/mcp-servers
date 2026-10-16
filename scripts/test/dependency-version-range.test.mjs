import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsLocalVersion } from '../dependency-version-range.mjs';
test('local caret ranges accept compatible patches and reject incompatible or unsupported versions',()=>{
 for(const [range,version,expected] of [
  ['^0.22.6','0.22.7',true],['^0.22.6','0.23.0',false],['^0.22.7','0.22.6',false],
  ['^1.30.0','1.31.0',true],['^1.30.0','2.0.0',false],['^0.0.3','0.0.4',false],
  ['0.22.7','0.22.7',true],['0.22.7','0.22.8',false],['workspace:*','0.22.7',false],
  ['^0.22.6','garbage',false],['^999999999999999999999.0.0','999999999999999999999.0.0',false],
 ])assert.equal(acceptsLocalVersion(range,version),expected,`${range} / ${version}`);
});

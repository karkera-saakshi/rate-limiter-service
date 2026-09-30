import fillBucket from './fillBucket.js';

let consumeToken = (bucket) => {
    let newObj = fillBucket(bucket);
    let tokens = newObj.tokens;
    let lastTime = newObj.lastTime;
    let extraSec = newObj.extraSec;
    let isConsumed;
    if(tokens>0)
    {
        tokens--;
        isConsumed = true;
    }
    else
    {
        isConsumed = false;
    }
    let obj = {
        tokens: tokens,
        lastTime: lastTime,
        extraSec: extraSec,
        isConsumed: isConsumed
    }
    return obj;
}

export default consumeToken;
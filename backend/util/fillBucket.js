let fillBucket = (obj) =>{
    let tokens = obj.tokens;
    let maxTokens = obj.maxTokens;
    let lastTime = obj.lastTime;
    let extraSec = obj.extraSec;
    let now = Date.now()
    let sec = (now - lastTime) + extraSec;
    let afterSec = 5000; 
    let extraToken;
    if(tokens<=maxTokens)
    {
        extraToken = Math.floor(sec / afterSec);
        extraSec = sec - ( extraToken * afterSec );
        if (tokens + extraToken <=maxTokens)
        {
            tokens = tokens + extraToken;
        }
        else
        {
            // extraToken = tokens + extraToken;
            // let diff = extraToken - maxTokens;
            // tokens = extraToken - diff;
            tokens = maxTokens;
        }
        lastTime = now;
    } 
    let newObj = {
        tokens: tokens,
        lastTime: lastTime,
        extraSec: extraSec,
        maxTokens: maxTokens
    }
    return newObj;
}

export default fillBucket
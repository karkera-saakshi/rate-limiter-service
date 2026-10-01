import consumeToken from "./consumeToken.js";
const fetchBucket = new Map();
// let getBucket = (obj) =>{
//     let address = obj.address;
//     if(fetchBucket.has(address) == false)
//     {
//         fetchBucket.set(address, { tokens: 10, maxTokens: 10, lastTime: Date.now(), extraSec: 0 });
//     }
//     let newObj = consumeToken(fetchBucket.get(address)); 
//     const { isConsumed, ...bucket } = newObj;
//     if(newObj.isConsumed == true)
//     {
//         fetchBucket.set(address, bucket);
//     }
//     return isConsumed;
    
// }

let getBucket = (req, res, next) =>{
    let address = req.ip;
    if(fetchBucket.has(address) == false)
    {
        fetchBucket.set(address, { tokens: 10, maxTokens: 10, lastTime: Date.now(), extraSec: 0 });
    }
    let newObj = consumeToken(fetchBucket.get(address)); 
    const { isConsumed, ...bucket } = newObj;
    if(newObj.isConsumed == true)
    {
        fetchBucket.set(address, bucket);
        next();
    }
    else
    {
        res.status(429).send("Too Many Requests");
    }
    
}

export default getBucket;
module.exports = function(f, args, placeholder = "[cb]"){
	return new Promise(resolve => {
		for(let i in args){
			if(args[i] === placeholder){
				args[i] = function(){
					resolve(arguments);
				};
				break;
			}
		}
		f(...args);
	});
};
/*async function myFunc(){
  console.log("calling");
  var result = await cb(setTimeout, ["[cb]", 1000]);
  console.log("finished");
  return result;
}*/

//syncCall().then(e => console.log(e));

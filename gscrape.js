var https = require("https");
var qs = require("querystring");
var jsdom = require("jsdom");
var fs = require("fs");

function gSearch(query, callback){
	var options = {
		host: "www.google.com",
		path: "/search?hl=en&num=20&q="+qs.escape(query).replace(/%20/g, "+"),
		headers: {
			"Accept": "text/html",
			"Host": "www.google.com",
			"User-Agent": "w3m/0.5.3+git20180125",
			"Accept-Language": "en;q=1.0",
			"Cookie": "NID=134=xpFEAv6KC3lstgj-BzUVqPkPwnAYXG3UUtSSfHjIk-GXcabpXdHiOkA00n4mOwoyhQCHKnDEYThJpS1sraoGHtRpDJQLlt4DtuQ747D2Fp_JawAuvxQCT6ktT78XVs4Y1MGfhzqOprSBjXCeCdcpGp_x9xOHa_0seDWXWsrC8Ki-qj0UstOfAZHTstIh9WCMpiG7tXjzt-H8v9dqGEIEOELISPTFKmBP4FNpStzAKvb7dCgekyhG3aE22pmU-J8q4nkGIUnzIVbt84RrK9UgBuYrS3TFaywemY7W5xsPrxnapvLO-EjS8ABy-a-fBgWFuftpdx5pEUFP"
		}
	};

	var req = https.request(options, res => {
		//console.log("STATUS: "+res.statusCode);
		res.setEncoding("utf8");
		var data = "";
		res.on("data", chunk => data += chunk);
		res.on("end", () => {
			//console.log(data);
			fs.writeFileSync("gscrape.html", data, {encoding: "utf8"});
			var dom = new jsdom.JSDOM(data);
			var json = {
				results: []
			};
			var resultDivs = dom.window.document.querySelectorAll("div.g");
			if(resultDivs.length > 0) json.numResults = parseInt(dom.window.document.querySelector("div#resultStats").innerHTML.split(" ")[1].replace(/,/g, ""));
			else json.numResults = 0;

			resultDivs.forEach(r => {
				if(r.childNodes.length > 0 && r.querySelectorAll("h3, cite").length == 2 && r.childNodes[0].tagName == "H3"){
					var result = {};
					result.title = r.querySelector("h3 a").innerHTML;
					result.url = qs.unescape(r.querySelector("h3 a").href.substr(7).split("&")[0]);
					result.displayUrl = r.querySelector("cite").innerHTML;
					result.desc = r.querySelector("span.st").innerHTML;
					json.results.push(result);
				}
			});
			callback(json);
		});
		res.on("error", e => console.log(e));
		//res.on("close", () => console.log("closed"));
	});
	req.on("request error", e => console.log(e));
	req.end();
}

module.exports.gSearch = gSearch;

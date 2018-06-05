var http = require("http");
var https = require("https");
var formidable = require("formidable");
var fs = require("fs");
var readline = require("readline");
var path = require("path");
var url = require("url");
var child_process = require("child_process");
var Canvas = require("canvas");
var cb = require("./sync.js");
var db = require("./db.js");
var async = require("async");

var tables = new db.TableArray();
tables.push(new db.Table("table1.json"));
var domains = ["gender.ml", "www.gender.ml"];

var r1 = readline.createInterface({input: process.stdin, output: process.stdout});
r1.setPrompt("");
r1.on("line", data => {
	if(data !== ""){
		try {
			console.dir(eval(data));
		}
		catch(err){
			console.error(err);
		}
	}
});

var globalVars = {};
var webRoot = "/home/teodor/nroot/";
var mimeTypes = fs.readFileSync("mime.types", "utf8").split("\n").map(e => e.split(" "));
function getMime(mime){
	for(var i = 0; i < mimeTypes.length; i++) if(mimeTypes[i].indexOf(mime) > 0) return mimeTypes[i][0];
}
function getExt(filename){
	var base = filename.split("/").filter(e => e != "").reverse();
	if(base.length == 0) return false;
	var ext = base[0].split(".").filter(e => e != "").reverse();
	if(ext.length > 1) return ext[0];
	else return false;
}

var httpsServer = https.createServer({
	cert: fs.readFileSync("/etc/letsencrypt/live/gender.ml/fullchain.pem"),
	key: fs.readFileSync("/etc/letsencrypt/live/gender.ml/privkey.pem")
}, onRequest);
var httpServer = http.createServer(onRequest);

function onRequest(request, response){
	function responseLogic(){
		function parseN(file, head){
			function subParseN(){
				var body = "";
				var _asyncFunction = "";
				var _parts = file.split(/<script (%>(?:.|\n)*?)<\/script>/);
				for(var i = 0; i < _parts.length; i++){
					if(_parts[i].startsWith("%>")) _asyncFunction += _parts[i].substr(2);
					else {
						_asyncFunction += ` body += _parts[${i}]; `;
						_asyncFunction += "\n".repeat((_parts[i].match(/\n/g) || []).length);
					}
				}
				eval(`(async function(){${_asyncFunction}})();`).then(data => {
					if(request.method == "POST" && !request.takeOverFiles){
						for(let i in request.files) if(request.files[i].name == "" && request.files[i].size == 0) fs.unlink(request.files[i].path, () => {});
					}
					response.writeHead(response.takeOverResponseCode || head);
					response.end(body);
				});
			}

			if(request.method == "POST"){
				request.form = new formidable.IncomingForm();
				request.form.encoding = "utf-8";
				request.form.maxFields = 1000;
				request.form.maxFieldsSize = 10 * 1024 * 1024;
				request.form.maxFileSize = 150 * 1024 * 1024;
				request.form.hash = false; // false || "sha1" || "md5"
				request.form.multiples = false;
				request.takeOverFiles = false;
				request.form.parse(request, (err, fields, files) => {
					console.dir(fields);
					console.dir(files);
					request.files = files;
					request.fields = fields;
					subParseN();
				});
			}
			else subParseN();
		}

		if(request.https) response.setHeader("Access-Control-Allow-Origin", "https://gender.ml");
		else response.setHeader("Access-Control-Allow-Origin", "http://gender.ml");
		//response.setHeader("X-Frame-Options", "SAMEORIGIN");
		response.setHeader("Content-Type", "text/html; charset=utf-8");
		response.setHeader("Server", "NS meme server 0.1.0");

		fs.stat(request.urlLocal, (err, stats) => {
			if(err){
				if(err.code == "ENOENT"){
					response.writeHead(404);
					response.write("404 - file not found: "+request.urlEsc);
				}
				else if(err.code == "ENOTDIR"){
					response.writeHead(404);
					response.write("404 - file not found: "+request.urlEsc);
					response.write("<br>\n"+request.urlEsc+" is a file, not a directory<br>\nRemove the trailing slash");
				}
				else {
					response.writeHead(500);
					response.write("500 - server error, code: "+err.code);
				}
				response.end();
			}
			else {
				if(stats.isDirectory()){
					if(request.urlEsc.endsWith("/")){
						var files = fs.readdirSync(request.urlLocal);
						if(files.indexOf("index.htm") !== -1){
							parseN(fs.readFileSync(request.urlLocal+"index.htm", "utf8"), 200);
						}
						else if(files.indexOf("index.html") !== -1){
							response.writeHead(200);
							fs.createReadStream(request.urlLocal+"index.html").pipe(response);
						}
						else {
							response.writeHead(200);
							response.write("[directory: "+request.urlEsc+"]<br>\n");
							fs.readdirSync(request.urlLocal).forEach(str => response.write("<a href='"+str+"'>"+str+"</a><br>\n"));
							response.end();
						}
					}
					else {
						var rLocation = encodeURI(request.urlNoQs+"/");
						if(request.url.split("?")[1] !== undefined) rLocation += "?"+request.url.split("?")[1];
						response.setHeader("Location", rLocation);
						response.writeHead(301);
						response.end();
					}
				}
				else if(stats.isFile()){
					if(/^index.(?:html|htm)$/.test(request.urlEsc.split("/").reverse()[0])){
						response.writeHead(403);
						response.end("403 - forbidden<br>\nindex pages must be accessed as directories");
					}
					else if(getExt(request.urlEsc) == "htm"){
						parseN(fs.readFileSync(request.urlLocal, "utf8"), 200);
					}
					else {
						response.setHeader("Content-Type", (getMime(getExt(request.urlEsc)) || "text/plain")+"; charset=utf-8");
						if(typeof request.headers["range"] === "string"){
							var regex = /bytes=([0-9]+)-([0-9]+)?$/.exec(request.headers["range"]);
							if(regex !== null){
								var start = parseInt(regex[1]);
								var end = parseInt(regex[2]) || stats.size-1;
								if(start >= 0 && start < stats.size && end >= 0 && end < stats.size && end >= start){
									response.setHeader("Content-Length", end-start+1);
									response.setHeader("Content-Range", "bytes "+start+"-"+end+"/"+stats.size);
									response.writeHead(206);
									fs.createReadStream(request.urlLocal, {start: start, end: end}).pipe(response);
								}
								else {
									response.writeHead(416);
									response.end();
								}
							}
							else {
								response.writeHead(416);
								response.end();
							}
						}
						else if(request.headers["if-none-match"] == '"'+stats.mtimeMs.toFixed()+'"'){
							response.writeHead(304);
							response.end();
						}
						else {
							response.setHeader("Content-Length", stats.size);
							response.setHeader("Accept-Ranges", "bytes");
							response.setHeader("Cache-Control", "public, max-age=3600");
							response.setHeader("ETag", '"'+stats.mtimeMs.toFixed()+'"');
							response.writeHead(200);
							fs.createReadStream(request.urlLocal).pipe(response);
						}
					}
				}
			}
		});
	}

	request.ip = request.connection.remoteAddress.split(":").reverse()[0];
	request.https = false;
	if(request.connection.encrypted) request.https = true;

	if((request.method == "GET" || request.method == "POST") && domains.indexOf(request.headers.host) > -1){
		let urlprop = url.parse(request.url, true);
		request.qs = urlprop.query;
		request.urlNoQs = decodeURI(urlprop.pathname);
		request.urlEsc = "/"+request.urlNoQs.split("/").filter(e => e !== "" && e !== "." && e !== "..").join("/");
		if(request.urlNoQs.endsWith("/") && request.urlNoQs != "/") request.urlEsc += "/";
		if(request.urlEsc == "//")  request.urlEsc = "/";
		request.urlLocal = webRoot+request.urlEsc;
		if(request.headers.range === undefined){
			console.log("\033[34m"+request.ip+"\033[0m "+(request.https ? "\033[32m[S]\033[0m " : "")+request.method+" "+request.url);
			for(e in request.headers) console.log(` | ${e}: ${request.headers[e]}`);
		}
		responseLogic();
	}
}

httpsServer.listen(443);
httpServer.listen(80);
//"/gay/f ag".replace(/\//g, " ").split(" ").filter(e => e !== "")
//decodeURIComponent("name%3Dst%C3%A5le%26car%3Dsaabaaaa ").split("&");
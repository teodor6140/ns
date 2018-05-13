var fs = require("fs");

class Table {
	constructor(name){
		console.log("loading table "+name);
		this.name = name;
		var data = JSON.parse(fs.readFileSync(name, "utf8"));
		this.cols = data.cols;
		this.rows = data.rows;
		this.updated = false;
		return this;
	}
	sync(){
		console.log("syncing table "+this.name);
		fs.writeFileSync(this.name, JSON.stringify({cols: this.cols, rows: this.rows}), "utf8");
		this.updated = false;
	}
	insert(arr){
		if(this.cols.length == arr.length){
			this.rows.push(arr);
			this.updated = true;
		}
		else console.log("invalid insert: cols count doesnt match");
	}
}
class TableArray extends Array {
	constructor(){
		super();
		setInterval(() => {
			this.forEach(table => {
				if(table !== undefined && table.updated) table.sync();
			});
		}, 4000);
	}
	getTableIndex(name){
		for(var i = 0; i < this.length; i++) if(this !== undefined && this[i].name === name) return i;
	}
	getTable(name){
		return this[this.getTableIndex(name)];
	}
}
module.exports = {
	Table,
	TableArray
};
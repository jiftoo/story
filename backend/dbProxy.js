import fs from "fs";

let file = null;
let backupFile = null;

function readDbLines() {
	return fs.readFileSync(file, {encoding: "utf-8", flag: "a+"}).toString().split("\n");
}
function writeDbLines(lines, backup) {
	fs.writeFileSync(backup ? backupFile : file, lines.join("\n"), {encoding: "utf-8"});
}

function open(_file) {
	file = _file;
	backupFile = _file + ".bak";
	if (!fs.existsSync(file)) {
		console.log("creating db");
	}
	const lines = readDbLines();

	if (!fs.existsSync(backupFile)) {
		console.log("creating backup db");
		writeDbLines(lines, true);
	}
	console.log("db open,", lines.length, "lines");
}

function append(line) {
	const lines = readDbLines();
	lines.push(line);
	writeDbLines(lines, true);
	writeDbLines(lines, false);
}

function replaceIndex(i, line) {
	const lines = readDbLines();
	lines[i] = line;
	writeDbLines(lines, true);
	writeDbLines(lines, false);
}

function deleteIndex(i) {
	const lines = readDbLines();
	lines.splice(i, 1);
	writeDbLines(lines, true);
	writeDbLines(lines, false);
}

function readLines() {
	return readDbLines();
}

export default {
	open,
	append,
	replaceIndex,
	deleteIndex,
	readLines,
};

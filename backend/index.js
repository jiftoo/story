"use strict";

import db from "./dbProxy.js";
import {createHash} from "crypto";
import {WebSocket, WebSocketServer} from "ws";
import {gib_dect} from "./gib_detect.cjs";
import fs from "fs";
import {exit} from "process";

const clog = console.log;
const cerr = console.error;
console.log = (...argv) => {
	fs.writeFileSync(config.logFile, `${new Date().toISOString()}(LOG): ${argv.join(" ")}\n`, {flag: "a+"});
	clog(...argv);
};
console.error = (...argv) => {
	fs.writeFileSync(config.logFile, `${new Date().toISOString()}(ERR): ${argv.join(" ")}\n`, {flag: "a+"});
	cerr(...argv);
};

// create config
let config = {
	port: 80,
	bookDuration: 1000 * 60 * 3, // 3 minutes
	submitTimeout: 1000 * 60 * 60 * 3, // 3 hours
	bookTimeout: 1000 * 60 * 30, // 30 minutes
	logFile: "log.txt",
};
if (!fs.existsSync("config.json")) {
	fs.writeFileSync("config.json", JSON.stringify(config, null, 4), {encoding: "utf-8"});
} else {
	let _cfg;
	try {
		_cfg = JSON.parse(fs.readFileSync("config.json", {encoding: "utf-8"}));
		if (!_cfg.port || !_cfg.bookDuration || !_cfg.submitTimeout || !_cfg.bookTimeout || !_cfg.logFile) {
			console.error("malformed config");
			exit(-1);
		}
	} catch (_) {
		console.error("malformed json in config");
		exit(-1);
	}
	config = _cfg;
}

const wss = new WebSocketServer({port: config.port});
console.log("Listening on", wss.address().address, wss.address().port);

db.open("db.txt");

const episodes = db.readLines();

let isBooked = null;
let bookedTimer = null;
let bookedUntil = null;

let adminHash = null;
try {
	adminHash = fs.readFileSync("adminHash.txt", {encoding: "utf-8"});
} catch (_) {
	console.error("no 'adminHash.txt' found. Admin panel is inaccessible.");
}

const BOOK_DURATION = config.bookDuration;

const validateCoherency = (string) => {
	// not gibberish
	// not copy of last episode
	// not only numbers
	return gib_dect(string) && string !== episodes.at(-1) && string.replaceAll(/[^0-9]/g, "").length !== string.length;
};

const validateCharacters = (string) => {
	return string.replaceAll(/[^A-Za-z0-9.,!?":\- ]/g, "") === string && string.length <= 160;
};

const wsMsg = (type, data) => {
	return JSON.stringify({type, data, isBooked: !!isBooked});
};
const wsErr = (err) => {
	return wsMsg("error", err);
};

const broadcast = (msg, exclude) => {
	wss.clients.forEach((c) => {
		if (c.readyState === WebSocket.OPEN && c !== exclude) {
			c.send(msg);
		}
	});
};

const checkHash = (pwd) => {
	return pwd && createHash("sha512").update(pwd).digest("hex") === adminHash;
};

const broadcastUpdate = (bookId) => {
	broadcast(
		wsMsg(
			"update",
			{
				timeouts: null,
				bookedForMe: bookId === isBooked && bookId != null,
				episodes,
				bookedFor: bookedUntil === null ? 0 : bookedUntil - Date.now(),
			},
			bookId
		)
	);
};

const unbook = (ip) => {
	isBooked = false;
	bookedTimer = null;
	bookedUntil = null;
	broadcast(wsMsg("unbooked", episodes, null));
	console.log("no longer booked");
};

let timeoutedIps = {"1.1.1.1": {submit: true, book: true}};
if (!fs.existsSync("ips.json")) {
	fs.writeFileSync("ips.json", JSON.stringify(timeoutedIps, null, 4), {encoding: "utf-8"});
}
try {
	timeoutedIps = JSON.parse(fs.readFileSync("ips.json", {encoding: "utf-8"}));
} catch (_) {
	console.log("malformed ips.json");
	fs.writeFileSync("ips.json", JSON.stringify(timeoutedIps, null, 4), {encoding: "utf-8"});
}

const testIpTimeout = (ip, which) => {
	if (timeoutedIps[ip] === undefined) {
		return false;
	}
	if (which === "submit" || which === "book") {
		return timeoutedIps[ip][which] ?? false;
	}
};

const timeoutIp = (ip, options = {submit: false, book: false}) => {
	if (timeoutedIps[ip] === undefined) {
		timeoutedIps[ip] = {submit: false, book: false, submitUntil: null, bookUntil: null};
	}
	if (options.submit !== undefined) {
		timeoutedIps[ip].submit = options.submit;
		if (options.submit) {
			timeoutedIps[ip].submitUntil = Date.now() + config.submitTimeout;
		}
	}
	if (options.book !== undefined) {
		timeoutedIps[ip].book = options.book;
		if (options.book) {
			timeoutedIps[ip].bookUntil = Date.now() + config.bookTimeout;
		}
	}
	console.log("timed out", ip, options);
	fs.writeFileSync("ips.json", JSON.stringify(timeoutedIps, null, 4), {encoding: "utf-8"});
};

// timeout looper
setInterval(() => {
	const entries = Object.entries(timeoutedIps);
	entries.forEach(([ip, val]) => {
		let changed = false;
		if (val.submit && val.submitUntil < Date.now()) {
			timeoutedIps[ip].submit = false;
			timeoutedIps[ip].submitUntil = null;
			changed = true;
		}
		if (val.book && val.bookUntil < Date.now()) {
			timeoutedIps[ip].book = false;
			timeoutedIps[ip].bookUntil = null;
			changed = true;
		}
		if (changed) {
			console.log("un timed out", timeoutedIps[ip]);
			fs.writeFileSync("ips.json", JSON.stringify(timeoutedIps, null, 4), {encoding: "utf-8"});
		}
	});
}, 1000);

wss.on("connection", (ws, req) => {
	const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;
	console.log("connection", req.socket.remoteAddress, ip);
	ws.on("message", (ev) => {
		const msg = JSON.parse(ev.toString());
		switch (msg.type) {
			case "get":
				let ipTimeoutsObj = timeoutedIps[ip];
				let timeoutSubmit = false;
				let timeoutBook = false;
				if (ipTimeoutsObj) {
					if (ipTimeoutsObj.submit) {
						timeoutSubmit = ipTimeoutsObj.submitUntil;
					}
					if (ipTimeoutsObj.book) {
						timeoutBook = ipTimeoutsObj.bookUntil;
					}
				}
				ws.send(
					wsMsg(
						"update",
						{
							timeouts: {submit: timeoutSubmit, book: timeoutBook},
							bookDuration: BOOK_DURATION,
							bookedForMe: msg.bookId === isBooked && msg.bookId != null,
							episodes,
							bookedFor: bookedUntil === null ? 0 : bookedUntil - Date.now(),
						},
						msg.bookId
					)
				);
				break;
			case "submit":
				if (testIpTimeout(ip, "submit")) {
					ws.send(wsErr("timeout submit"));
					return;
				}
				if (!validateCharacters(msg.data) || !validateCoherency(msg.data)) {
					ws.send(wsErr("gibberish"));
					return;
				}
				if (isBooked && msg.bookId !== isBooked) {
					ws.send(wsErr("booked"));
					return;
				}
				unbook();
				let line = msg.data.trim();
				episodes.push(line);
				db.append(line);
				console.log("submitted", `"${line}"`);
				ws.send(wsMsg("submitSuccess", {submit: Date.now() + config.submitTimeout, book: Date.now() + config.bookTimeout}));
				broadcastUpdate(msg.bookId);

				timeoutIp(ip, {submit: true, book: true});

				break;
			case "book":
				if (testIpTimeout(ip, "submit") || testIpTimeout(ip, "book")) {
					ws.send(wsErr("timeout"));
					return;
				}
				if (isBooked) {
					ws.send(wsErr("booked"));
					return;
				}
				bookedUntil = Date.now() + BOOK_DURATION;

				isBooked = Math.random().toString();
				ws.send(wsMsg("bookSuccess", {isBooked, timeout: Date.now() + config.bookTimeout}));
				broadcast(wsMsg("booked", {bookedFor: BOOK_DURATION}));
				bookedTimer = setTimeout(() => {
					unbook(ip);
				}, BOOK_DURATION);

				timeoutIp(ip, {book: true});

				break;
			// next are admin-only
			case "admin":
				ws.send(wsMsg("adminAttempt", checkHash(msg.data)));
				break;
			case "deleteLine":
				if (checkHash(msg.pwd)) {
					console.log("delete line", msg.data);
					const i = +msg.data;
					episodes.splice(i, 1);
					db.deleteIndex(i);
					broadcastUpdate(0);
				}
				break;
			case "replaceLine":
				if (checkHash(msg.pwd)) {
					console.log("replace line", msg.data.i, "with", msg.data.line);
					const i = +msg.data.i;
					const line = msg.data.line;
					episodes[i] = line;
					db.replaceIndex(i, line);
					broadcastUpdate(0);
				}
				break;
			case "forceSubmit":
				if (checkHash(msg.pwd)) {
					const line = msg.data;
					console.log("force submitted", `"${line}"`);
					episodes.push(line);
					db.append(line);
					broadcastUpdate(0);
				}
		}
	});
});

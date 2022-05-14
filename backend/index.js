"use strict";

import {WebSocket, WebSocketServer} from "ws";
import {gib_dect} from "./gib_detect.cjs";

const wss = new WebSocketServer({port: 80});

const episodes = [
	"A bright flash of light strikes your eyes. As you squint and bring your hand to eyes, a figure appears from beyond the glare.",
];

let isBooked = null;
let bookedTimer = null;
let bookedUntil = null;

const validateCoherency = (string) => {
	return gib_dect(string);
};

const validateCharacters = (string) => {
	return string.replaceAll(/[^A-Za-z0-9.,!?":\- ]/g, "") === string;
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

wss.on("connection", (ws) => {
	ws.on("message", (ev) => {
		const msg = JSON.parse(ev.toString());
		switch (msg.type) {
			case "get":
				ws.send(
					wsMsg(
						"update",
						{bookedForMe: msg.bookId === isBooked && msg.bookId != null, episodes, bookedFor: bookedUntil === null ? 0 : bookedUntil - Date.now()},
						msg.bookId
					)
				);
				break;
			case "submit":
				if (!validateCharacters(msg.data) || !validateCoherency(msg.data)) {
					ws.send(wsErr("gibberish"));
					return;
				}
				if (isBooked && msg.bookId !== isBooked) {
					ws.send(wsErr("booked"));
					return;
				}
				episodes.push(msg.data.trim());
				broadcast(
					wsMsg(
						"update",
						{bookedForMe: msg.bookId === isBooked && msg.bookId != null, episodes, bookedFor: bookedUntil === null ? 0 : bookedUntil - Date.now()},
						msg.bookId
					)
				);
				break;
			case "book":
				if (isBooked) {
					ws.send(wsErr("booked"));
					return;
				}
				const BOOK_DURATION = 1000 * 60 * 2; // 2 minutes
				bookedUntil = Date.now() + BOOK_DURATION;

				isBooked = Math.random().toString();
				ws.send(wsMsg("bookSuccess", isBooked));
				broadcast(wsMsg("booked", {bookedFor: BOOK_DURATION}));
				bookedTimer = setTimeout(() => {
					isBooked = false;
					bookedTimer = null;
					bookedUntil = null;
					broadcast(wsMsg("unbooked", episodes, null));
					console.log("no longer booked");
				}, BOOK_DURATION);
		}
	});
});

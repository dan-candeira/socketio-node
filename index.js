const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
	cors: {
		origins: ["http://localhost:8080", "http://127.0.0.1:5173/"],
	},
});
const { v4: uuidv4 } = require("uuid");
const pokemon = require("pokemon");

// state
const clientRooms = {};
const state = {};

app.get("/", (req, res) => {
	res.send("<h1>Hey Socket.io</h1>");
});

io.on("connection", (socket) => {
	console.log("a user connected");

	socket.on("disconnect", handleDisconnect);

	socket.on("joinRoom", handleJoin);
	socket.on("newRoom", createRoom);

	socket.on("user", handleUser);
	socket.on("vote", handleVote);

	function handleJoin({ roomCode, user }) {
		const room = socket.adapter.rooms[roomCode];
		// if (!room) {
		// 	socket.emit("roomNotFound");
		// 	return;
		// }

		clientRooms[socket.id] = roomCode;
		socket.join(roomCode);

		let _user;
		if (user == null) {
			_user = pokemon.random().toLocaleLowerCase();
		} else {
			_user = user;
		}

		// this will be only listened for the specific browser "instance"
		socket.emit("user", _user);

		const tempRoomState = state[roomCode];
		let users = [];

		if (tempRoomState) {
			users = tempRoomState["users"].filter((u) => u.socket != socket.id);
		}

		const userObj = {
			user: _user,
			socket: socket.id,
			id: uuidv4(),
		};
		users.push(userObj);
		const stateObj = {};

		stateObj["users"] = users;
		// merges user array with room state
		state[roomCode] = { ...state[roomCode], ...stateObj };
		// bradcast to all in the room
		io.to(roomCode).emit("users", users);
	}

	function createRoom() {
		const roomCode = uuidv4();
		// dont think this is being used
		clientRooms[socket.id] = roomCode;
		socket.emit("roomCode", roomCode);
	}

	function handleUser({ user, roomCode }) {
		const rooomState = state[roomCode];
		const _user = rooomState["users"].find((u) => u.socket == socket.id);

		_user.user = user;
		socket.emit("user", user);
	}

	function handleVote({ vote, roomCode }) {
		io.to(roomCode).emit("vote", vote);
	}

	function handleDisconnect() {
		console.log("user disconnected -", socket.id);

		const clientRoom = clientRooms[socket.id];
		const roomState = state[clientRoom];

		if (roomState) {
			const users = roomState["users"].filter(
				(user) => user.socket != socket.id
			);
			state[clientRoom]["users"] = users;
			io.to(clientRoom).emit(users);
		}

		delete clientRooms[socket.id];
	}
});

http.listen(3000, () => {
	console.log("listening on *:3000");
});

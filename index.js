var os = require('os');
const express = require('express');
var app = express(); 
const path = require('path')
const PORT = process.env.PORT || 5000
var http = require('http').createServer(app);
var io = require('socket.io')(http);

// constants
const maxClients = 2;

// Object to maintain a list of non-full rooms
function Rooms(){
  this.arr=[], // array of room names
  this.pos={} // key=room name | val= position in arr
  // used a map because lookup on map is O(1) , where as indexOf on array is O(n)
  // https://stackoverflow.com/questions/32234733/javascript-what-lookup-is-faster-array-indexof-vs-object-hash
};
Rooms.prototype.add=function(room){
  // if the room isn't already in here , add it
  if(!(room in this.pos)){
    // TODO : replace with debug in future
    console.log(`room ${room} added at location ${this.arr.length}`);
    this.pos[room] = this.arr.length;
    this.arr.push(room);
  }
  else{
    // TODO : replace with debug in future
    console.log(`room not added its already in there`);
  }
  return;
};
Rooms.prototype.remove=function(room){
  // if the room is in here , remove it
  if(room in this.pos){
    // TODO : replace with debug in future
    console.log(`removing room ${room} from list of non-full rooms`);
    this.arr.splice(this.pos[room], 1); // remove from array
    delete this.pos[room];  // remove from map
  }
};
Rooms.prototype.get=function(){
  if(this.arr.length === 0){
    // TODO : replace with debug in future
    console.log(`arr is empty`);
    return null;
  }
  let p = Math.floor(Math.random() * this.arr.length);
  return this.arr[p];
};
Rooms.prototype.length = function(){
  return this.arr.length;
}

var nonFullRooms = new Rooms();

// cases :
// 1. when room has 0 clients- remove the room from the nonFullRoom object by finding out its position in the arr through the pos dictionary
// 2. when a clients leaves a room and the room still has greater than 0 clients, try adding the room to the 
console.log("app started");

/** **  **  **  ** ** ** ** ** UTIL FUNCTIONS ** ** ** ** ** ** ** ** ** ** ** ** */
// Random UUID generator
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


/** **  **  **  ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** */

/** **  **  **  ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** */
// Routing Logic
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => res.render('pages/index'));
app.use('/webrtc-scripts', express.static(__dirname + '/node_modules/webrtc-adapter/out/'));
/** **  **  **  ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** */

function getNumClients(room){
  var clientsInRoom = io.sockets.adapter.rooms[room];
  var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
  return numClients;
}

// count of all the clients currently online
function getClientCount(){
  return Object.keys(io.sockets.connected).length;
}

// function log(socket , args){
//   var array = ['Message from server:'];
//   array.concat(args);
//   socket.emit('log', array);
// }

function log(socket , args){
  var array = [];
  console.log(array.concat(args));
}

function createOrJoin(socket){
    // TODO : replace with debug in future
    console.log(`createOrJoin begin`);
  // randomly pick a room with less than max clients
  var room = nonFullRooms.get();
  // if no nonfull room is found
  if(room == null){
    // create a new room name
    room = uuidv4();
    // add room to the list of nonfull rooms
    nonFullRooms.add(room);
  }

  var numClients = getNumClients(room);
  log(socket , ['Room ' + room + ' now has ' + numClients + ' client(s)']);

  if (numClients === 0) {
    socket.join(room);
    log(socket , ['Client ID ' + socket.id + ' created room ' + room]);

    socket.emit('created', room, socket.id);

  } 
  else if (numClients > 0 && numClients < maxClients) {
    log(socket , ['Client ID ' + socket.id + ' joined room ' + room]);
    // tell all the clients in the room that an other client is about to join
    io.sockets.in(room).emit('join', room, socket.id);
    socket.join(room);
    // tell the client that it has joined the room
    socket.emit('joined', room, socket.id);
    io.sockets.in(room).emit('ready');
    // if room has max clients in it now
    if((numClients+1) === maxClients){
      nonFullRooms.remove(room);
      //socket.emit('full', room);
    }
  } 
    // TODO : replace with debug in future
    console.log(`createOrJoin end`);
    sendNonFullRoomCount(socket);
    sendClientCount();
}

function getRoomID(socket){
  var rooms = Object.keys(socket.rooms).filter(item => item!=socket.id); // get the client's room
  if(rooms.length > 0){
    return rooms[0];
  }else{
    return null;
  }
}

function sendNonFullRoomCount(socket){
  //socket.broadcast.emit('non-full-room-count', nonFullRooms.length());  // broadcasts to every one except the current socket
  io.local.emit('non-full-room-count', nonFullRooms.length());  // broadcasts to every one in the current node instance
}

function sendClientCount(socket){
  io.local.emit('client-count', getClientCount());  // broadcasts to every one in the current node instance
}

function bye(socket){
  log(socket , ['received bye']);
  var room = getRoomID(socket); // get the client's room
  if(room != null){
    // move the client out of the room
    log(socket , ['removing client from room']);
    socket.leaveAll();
    // tell the other clients in the room that this client has left
    socket.to(room).emit('message', 'bye');
    console.log(`check the number of clients left in the room`);
    // check the number of clients left in the room
    var numClients = getNumClients(room);
    console.log(`${numClients} clients left in the room`);
    if(numClients === 0){
      // if room is empty , remove it from the list of non full rooms
      console.log(`room is empty , remove it from the list of non full rooms`);
      nonFullRooms.remove(room);
    }else if(numClients < maxClients){
      // if the room is not empty then try adding it to the list of non full rooms
      console.log(`room is not empty add it to the list of non full rooms`);
      nonFullRooms.add(room);
    }
  }
  log(socket , ['adding client to new room']);
  sendNonFullRoomCount(socket);
  sendClientCount(socket);
}

function next(socket){
  // first remove the client from his current room
  bye(socket);
  // now try adding him to what ever room is available
  createOrJoin(socket);
}

io.sockets.on('connection', function(socket) {


  socket.on('message', function(message) {
    console.log(`client said message ${message}`);    // TODO : replace with debug in future
    log(socket , ['Client said: ', message]);
    var room = getRoomID(socket); // get the client's room
    console.log(`get room id returned ${room}`);    // TODO : replace with debug in future
    if(room !=null){
      console.log(`sending message to client`);    // TODO : replace with debug in future
      // send to all clients in the room except the sender
      socket.to(room).emit('message', message);
    }else{
      //createOrJoin(socket);
    }
  });

  socket.on('create or join', function() {
    log(socket , ['Received request to create or join a room ']);
    createOrJoin(socket);
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    bye(socket);
  });

  socket.on('next',function(){
    next(socket);
  });

  socket.on('disconnect', function() {
    bye(socket);
  });

});



http.listen(PORT, () => console.log(`Listening on ${ PORT }`));

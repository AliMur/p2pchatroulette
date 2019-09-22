'use strict';

/**
 * 0. a client can't join a room if he hasn't allowed his web cam  / local stream.
 * 1. when a new client joins a room , it's the joiner's responsibility to send an offer to every one else in the room
 * 2. every one who is in the room and already has their local stream should respond to the offer.
 */
/** **  **  **  ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** */
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var localStream;
var pc;
var remoteStream;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};


/////////////////////////////////////////////

var socket = io.connect();

function createOrJoin(){
  socket.emit('create or join', '');
  console.log('Attempted to create or join room');
}

function joinNext(){
  socket.emit('next', '');
  console.log('Attempted to move to another room');
}

socket.on('created', function(room) {
  // if there is no non-full room available, the client gets a new room and then waits for some one else to join it
  console.log('You created the room ' + room);
  setInHTML('room',room);
});

// this should not usually happen
socket.on('full', function(room,socketID) {
  console.log('Room ' + room + ' is full WTF!');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join the room :' + room);
});

socket.on('joined', function(room) {
  console.log('you joined the room : ' + room);
  setInHTML('room',room);
  invite();
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('non-full-room-count', function (count){
  setInHTML('non-full-room-count',count);
});

socket.on('client-count', function (count){
  setInHTML('client-count',count);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message.type === 'offer') {
    handleOfferMsg(message);
  } 
  else if (message.type === 'answer') {
    handleAnswerMsg(message);
  } 
  else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

//1. get the client's web cam / video stream
navigator.mediaDevices.getUserMedia({
  audio: false,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  // 2. noce you have the client's video stream, now let him join a room
  createOrJoin();
}

//3. once the client has joined a previously existing room, he will invite the other client in the room to a call
function invite(){
  createPeerConnection();
  pc.addStream(localStream);
  doCall();
}

function doCall() {
  console.log('Sending offer to peer');
  function createOfferError(event) {
    console.log('createOffer() error: ', event);
  }
  pc.createOffer().then(setLocalAndSendMessage, createOfferError);
}

// 4. once a client receives an offer he will send an answer
function handleOfferMsg(message){
  createPeerConnection();
  pc.setRemoteDescription(new RTCSessionDescription(message));
  pc.addStream(localStream);
  doAnswer();
}

function doAnswer() {
  console.log('Sending answer to peer.');
  function createAnswerError(error) {
    trace('Failed to create answer: ' + error.toString());
  }
  pc.createAnswer().then( setLocalAndSendMessage, createAnswerError);
}

//5. when the inviting client recieves the answer he will set the answering client in it's remote description
function handleAnswerMsg(message){
  pc.setRemoteDescription(new RTCSessionDescription(message));
}

window.onbeforeunload = function() {
  socket.emit('bye', '');
  //sendMessage('bye');
};

function nextRoom(){
  hangup();
  joinNext();
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
}

function stop() {
  pc.close();
  pc = null;
}


///////////////////////////////////////////
function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}
///////////////////////////////////////////
// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

function setInHTML(nodeID,val){
  $( "#"+nodeID ).html( val );
}
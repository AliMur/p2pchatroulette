// const cool = require('cool-ascii-faces');
const express = require('express');
var app = express(); 
const path = require('path')
const PORT = process.env.PORT || 5000
var http = require('http').createServer(app);
var io = require('socket.io')(http);


console.log("app started");

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.get('/', (req, res) => res.render('pages/index'));
app.use('/webrtc-scripts', express.static(__dirname + '/node_modules/webrtc-adapter/out/'));
  // .get('/cool', (req,res) => res.send(cool()))

// var DepLinker = require('dep-linker');
// DepLinker.copyDependenciesTo('./public/scripts')

  io.on('connection', function(socket){
    console.log('a user connected');

    socket.on('disconnect', function(){
      console.log('user disconnected');
    });

    socket.on('available', function(id){
      console.log('message: ' + id);
    });

    socket.on('taken', function(id){
      console.log('message: ' + id);
    });


  });



http.listen(PORT, () => console.log(`Listening on ${ PORT }`));

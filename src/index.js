const path = require('path')
const http = require('http')
const express = require ('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const {generateMessage, generateLocationMessage} = require('./utils/messages')
const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users')

const app = express();
const server = http.createServer(app)
// socket io ocekuje server napravljen rucno
const io = socketio(server)

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

//koristimo static middleweare
app.use(express.static(publicDirectoryPath))



io.on('connection', (socket)=>{
    console.log('new web socket connection');

    // options je spread operator koji zamenjuje username i room {username, room}
socket.on('join', ({username, room}, callback)=>{
        const {error, user}= addUser({id: socket.id, username, room})

        if(error){
            return callback(error)
        }

        socket.join(user.room)

        // emituje event na tacnu konekekciju
        socket.emit('message', generateMessage('Admin','Welcome!'))

        // salje poruku svima osim ovoj konekciji i ogranicava na jedan room
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin',`${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()

        })

    socket.on('sendMessage', (message, callback)=>{
        const user = getUser(socket.id)
        const filter = new Filter()

        if(filter.isProfane(message)){
            return callback('Profanity is not allowed')
        }

        // emituje event svim konekcijama u odredjenoj sobi
        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()

    })

    socket.on('sendLocation', (cords, callback)=>{
        const user = getUser(socket.id)
        io.to(user.room).emit('locationmessage', generateLocationMessage(user.username, `https://google.com/maps?q=${cords.latitude},${cords.longitude}`))
        callback(socket.io)
    })

    // zatvara konekciju
    socket.on('disconnect', ()=>{

        const user =  removeUser(socket.id)

        if(user){
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })

})

//pokrecemo server
server.listen(port, ()=>{
    console.log(`Server is up on port ${port}!`);
})
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from collections import defaultdict
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_change_this_in_production'
socketio = SocketIO(app, cors_allowed_origins="*")

# Storage
users = {}  # {user_id: socket_id}
online_users = set()
rooms = defaultdict(list)  # {room_name: [user_ids]}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('register')
def handle_register(user_id):
    users[user_id] = request.sid
    online_users.add(user_id)
    emit('registration_success', {'user_id': user_id})
    # Send current online users to everyone
    emit('user_joined', {'users': list(online_users)}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    user_id = None
    for uid, sid in users.items():
        if sid == request.sid:
            user_id = uid
            break
    
    if user_id:
        users.pop(user_id, None)
        online_users.discard(user_id)
        # Remove user from all rooms
        for room_name in list(rooms.keys()):
            if user_id in rooms[room_name]:
                rooms[room_name].remove(user_id)
                if not rooms[room_name]:
                    rooms.pop(room_name, None)
        
        emit('user_left', {'users': list(online_users)}, broadcast=True)

@socketio.on('private_message')
def handle_private_message(data):
    recipient_id = data['to']
    message = data['message']
    sender_id = data['from']
    
    if recipient_id in users:
        emit('new_private_message', {
            'from': sender_id,
            'message': message,
            'timestamp': time.time()
        }, room=users[recipient_id])

@socketio.on('join_group')
def on_join(data):
    user_id = data['user_id']
    room_name = data['room_name']
    join_room(room_name)
    
    if user_id not in rooms[room_name]:
        rooms[room_name].append(user_id)
    
    emit('user_joined_room', {
        'user': user_id,
        'room': room_name
    }, room=room_name)

@socketio.on('group_message')
def handle_group_message(data):
    room_name = data['room_name']
    emit('new_group_message', {
        'from': data['from'],
        'message': data['message'],
        'room': room_name,
        'timestamp': time.time()
    }, room=room_name)

if __name__ == '__main__':
    # Add allow_unsafe_werkzeug=True to fix the error
    socketio.run(app, host='0.0.0.0', port=3009, debug=True, allow_unsafe_werkzeug=True)
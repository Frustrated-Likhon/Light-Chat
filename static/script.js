let socket;
let currentUser = '';
let activeChat = { type: null, id: null, name: null };
let onlineUsers = [];
let chatHistory = {};


window.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('chat_user_id');
    if (savedUser) {
        document.getElementById('user-id-input').value = savedUser;
        
        setTimeout(() => registerUser(), 500);
    }
});

function registerUser() {
    const userId = document.getElementById('user-id-input').value.trim();
    if (!userId) return alert('Please enter a user ID');
    
    
    localStorage.setItem('chat_user_id', userId);
    
    socket = io();
    currentUser = userId;

    socket.on('connect', () => {
        socket.emit('register', userId);
    });

    socket.on('registration_success', (data) => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('chat-app').classList.remove('hidden');
        document.getElementById('current-user').textContent = userId;
        document.getElementById('current-user-display').textContent = userId;
        
        
        loadChatHistory();
    });

    socket.on('user_joined', (data) => {
        onlineUsers = data.users;
        updateOnlineUsersList();
    });

    socket.on('user_left', (data) => {
        onlineUsers = data.users;
        updateOnlineUsersList();
    });

    socket.on('new_private_message', (data) => {
      
        if (!chatHistory[data.from]) chatHistory[data.from] = [];
        chatHistory[data.from].push({
            sender: data.from,
            message: data.message,
            timestamp: new Date().toISOString(),
            type: 'received'
        });

 
        saveChatHistory();

      
        if (activeChat.type === 'private' && activeChat.id === data.from) {
            displayMessage(data.from, data.message, false);
        } else {
            
            updateChatBadge(data.from);
        }
    });

    socket.on('new_group_message', (data) => {
        if (!chatHistory[data.room]) chatHistory[data.room] = [];
        chatHistory[data.room].push({
            sender: data.from,
            message: data.message,
            timestamp: new Date().toISOString(),
            type: 'received'
        });

        saveChatHistory();

        if (activeChat.type === 'room' && activeChat.id === data.room) {
            displayMessage(data.from, data.message, false);
        } else {
            updateChatBadge(data.room);
        }
    });
}

function saveChatHistory() {
    localStorage.setItem('chat_history', JSON.stringify(chatHistory));
    localStorage.setItem('chat_rooms', JSON.stringify(Array.from(document.getElementById('room-list').children).map(item => item.textContent)));
}

function loadChatHistory() {
    
    const savedHistory = localStorage.getItem('chat_history');
    if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
    }

 
    const savedRooms = localStorage.getItem('chat_rooms');
    if (savedRooms) {
        const rooms = JSON.parse(savedRooms);
        const roomList = document.getElementById('room-list');
        roomList.innerHTML = '';
        
        rooms.forEach(roomName => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            roomItem.onclick = () => {
                activeChat = { type: 'room', id: roomName, name: roomName };
                document.getElementById('active-chat-name').textContent = roomName;
                document.getElementById('message-container').innerHTML = '';
                
                if (chatHistory[roomName]) {
                    chatHistory[roomName].forEach(msg => {
                        displayMessage(msg.sender, msg.message, msg.type === 'sent');
                    });
                }
                
                removeChatBadge(roomName);
                updateActiveChatHighlight();
                hideSidebarOnMobile();
            };
            roomItem.textContent = roomName;
            roomList.appendChild(roomItem);
        });
    }
}

function logout() {
    localStorage.removeItem('chat_user_id');
    localStorage.removeItem('chat_history');
    localStorage.removeItem('chat_rooms');
    window.location.reload();
}

function updateOnlineUsersList() {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';

    onlineUsers.filter(user => user !== currentUser).forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = `user-item ${activeChat.type === 'private' && activeChat.id === user ? 'active' : ''}`;
        userItem.onclick = () => startPrivateChat(user);
        userItem.innerHTML = `
            <div class="user-avatar">${user.charAt(0).toUpperCase()}</div>
            <span>${user}</span>
            <span class="online-indicator"></span>
        `;
        userList.appendChild(userItem);
    });
}

function updateChatBadge(chatId) {
    const chatItems = document.querySelectorAll('.user-item, .room-item');
    chatItems.forEach(item => {
        if (item.textContent.includes(chatId)) {
            if (!item.querySelector('.badge')) {
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.style.background = '#f04747';
                badge.style.color = 'white';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '10px';
                badge.style.marginLeft = 'auto';
                badge.style.fontSize = '12px';
                badge.textContent = '!';
                item.appendChild(badge);
            }
        }
    });
}

function startPrivateChat(userId) {
    activeChat = { type: 'private', id: userId, name: userId };
    document.getElementById('active-chat-name').textContent = userId;
    document.getElementById('message-container').innerHTML = '';
    
   
    if (chatHistory[userId]) {
        
        chatHistory[userId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        chatHistory[userId].forEach(msg => {
            displayMessage(msg.sender, msg.message, msg.type === 'sent');
        });
    }
    
    
    removeChatBadge(userId);
    updateActiveChatHighlight();
    hideSidebarOnMobile();
}

function removeChatBadge(chatId) {
    const items = document.querySelectorAll('.user-item, .room-item');
    items.forEach(item => {
        if (item.textContent.includes(chatId)) {
            const badge = item.querySelector('.badge');
            if (badge) badge.remove();
        }
    });
}

function updateActiveChatHighlight() {
    document.querySelectorAll('.user-item, .room-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (activeChat.type === 'private') {
        document.querySelectorAll('.user-item').forEach(item => {
            if (item.textContent.includes(activeChat.id)) {
                item.classList.add('active');
            }
        });
    } else if (activeChat.type === 'room') {
        document.querySelectorAll('.room-item').forEach(item => {
            if (item.textContent.includes(activeChat.id)) {
                item.classList.add('active');
            }
        });
    }
}

function createRoom() {
    const roomName = document.getElementById('new-room-input').value.trim();
    if (!roomName) return alert('Please enter a room name');
    
    socket.emit('join_group', { user_id: currentUser, room_name: roomName });
    

    const roomList = document.getElementById('room-list');
    const roomItem = document.createElement('div');
    roomItem.className = 'room-item';
    roomItem.onclick = () => {
        activeChat = { type: 'room', id: roomName, name: roomName };
        document.getElementById('active-chat-name').textContent = roomName;
        document.getElementById('message-container').innerHTML = '';
        
        if (chatHistory[roomName]) {
           
            chatHistory[roomName].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            chatHistory[roomName].forEach(msg => {
                displayMessage(msg.sender, msg.message, msg.type === 'sent');
            });
        }
        
        removeChatBadge(roomName);
        updateActiveChatHighlight();
        hideSidebarOnMobile();
    };
    roomItem.textContent = roomName;
    roomList.appendChild(roomItem);
    
    document.getElementById('new-room-input').value = '';
    
   
    saveChatHistory();
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    if (!message || !activeChat.type) return;

    const timestamp = new Date().toISOString();

    if (activeChat.type === 'private') {
        socket.emit('private_message', {
            to: activeChat.id,
            message: message,
            from: currentUser
        });
        
        
        if (!chatHistory[activeChat.id]) chatHistory[activeChat.id] = [];
        chatHistory[activeChat.id].push({
            sender: currentUser,
            message: message,
            timestamp: timestamp,
            type: 'sent'
        });
        
        displayMessage(currentUser, message, true);
    } else if (activeChat.type === 'room') {
        socket.emit('group_message', {
            room_name: activeChat.id,
            message: message,
            from: currentUser
        });
        
        if (!chatHistory[activeChat.id]) chatHistory[activeChat.id] = [];
        chatHistory[activeChat.id].push({
            sender: currentUser,
            message: message,
            timestamp: timestamp,
            type: 'sent'
        });
        
        displayMessage(currentUser, message, true);
    }

    
    saveChatHistory();
    messageInput.value = '';
}

function displayMessage(sender, text, isSent) {
    const messageContainer = document.getElementById('message-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    messageDiv.innerHTML = `
        <strong>${isSent ? 'You' : sender}:</strong> ${text}
        <div class="message-time">${time}</div>
    `;
    
    messageContainer.appendChild(messageDiv);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function hideSidebarOnMobile() {
    if (window.innerWidth < 768) {
        document.querySelector('.sidebar').style.display = 'none';
        document.querySelector('.chat-area').style.display = 'flex';
    }
}

function showSidebarOnMobile() {
    if (window.innerWidth < 768) {
        document.querySelector('.sidebar').style.display = 'block';
        document.querySelector('.chat-area').style.display = 'none';
    }
}

function clearChatHistory() {
    if (confirm('Are you sure you want to clear all chat history?')) {
        localStorage.removeItem('chat_history');
        localStorage.removeItem('chat_rooms');
        chatHistory = {};
        document.getElementById('room-list').innerHTML = '';
        document.getElementById('message-container').innerHTML = '';
        alert('Chat history cleared!');
    }
}


document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('show-chats').addEventListener('click', showSidebarOnMobile);
    document.getElementById('show-chat').addEventListener('click', hideSidebarOnMobile);

});

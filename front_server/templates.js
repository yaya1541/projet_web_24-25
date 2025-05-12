import { handleLogin, oauth } from './utils.js';

class Footer extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
        <footer class="main-footer">
            <div class="footer-content">
            <div class="footer-info">
                <div class="footer-brand">
                    <span class="footer-name">Kart Fever</span>
                </div>
            </div>
            
            <div class="footer-links">
                <div class="footer-column">
                <h4>Informations</h4>
                <ul>
                    <li><a href="#">À propos</a></li>
                    <li><a href="#">Comment jouer</a></li>
                    <li><a href="#">Classement</a></li>
                </ul>
                </div>
                
                <div class="footer-column">
                <h4>Support</h4>
                <ul>
                    <li><a href="#">FAQ</a></li>
                    <li><a href="#">Contact</a></li>
                    <li><a href="#">Signaler un bug</a></li>
                </ul>
                </div>
                
                <div class="footer-column">
                <h4>Légal</h4>
                <ul>
                    <li><a href="#">Conditions</a></li>
                    <li><a href="#">Confidentialité</a></li>
                    <li><a href="#">Cookies</a></li>
                </ul>
                </div>
            </div>
            </div>
            
            <div class="footer-bottom">
            <p>&copy; 2025 KartFever. Tous droits réservés.</p>
            <div class="social-icons">
                <a href="#" class="social-icon">FB</a>
                <a href="#" class="social-icon">TW</a>
                <a href="#" class="social-icon">IG</a>
                <a href="#" class="social-icon">YT</a>
            </div>
            </div>
        </footer>`;
    }
}

class Header extends HTMLElement {
    constructor() {
        super();
        this.fr = document.createElement('iframe');
        this.fr.id = 'myFrame';
        this.fr.frameBorder = 0;
        this.fr.width = '500';
        this.fr.height = '700';
        this.fr.scrolling = 'no';
        this.fr.style = 'top:5vh;right:5vw;position:absolute;z-index:200';
    }

    async connectedCallback() {
        this.innerHTML = `
        <header class="main-header">
            <div class="header-content">
                <div class="logo-text">KART<span>FEVER</span></div>
                <div class="header-decoration"></div>
                <div class="header-auth">
                    <!--<button id="login" class="auth-btn">Login</button>
                    <button id="register" class="auth-btn">Register</button>-->
                </div>
            </div>
            <div class="menu-wrapper">
                <ul class="nav-items">
                    <li class="nav-item">
                        <a href="/home" class="nav-link">Home</a>
                    </li>
                    <li class="nav-item">
                        <a href="/news" class="nav-link">News</a>
                    </li>
                    <li class="nav-item">
                        <a href="/home" class="nav-link">Discord</a>
                    </li>
                    <li class="nav-item">
                        <a href="/about" class="nav-link">À propos</a>
                    </li>
                </ul>
            </div>
        </header>
        `;
        await this.oauthHandler();
    }

    async oauthHandler() {
        const login = document.createElement('button');
        const register = document.createElement('button');
        const logout = document.createElement('button');
        const play = document.createElement('li');
        const play_link = document.createElement('a');

        login.id = 'login';
        login.innerText = 'Login';
        login.classList.add('auth-btn');

        login.addEventListener('click', (ev) => {
            this.bindIFrame(this.fr, ev);
        });

        register.id = 'register';
        register.innerText = 'Register';
        register.classList.add('auth-btn');

        register.addEventListener('click', (ev) => {
            this.bindIFrame(this.fr, ev);
        });

        logout.id = 'logout';
        logout.innerText = 'Log out';
        logout.classList.add('auth-btn');

        logout.addEventListener('click', async (_ev) => {
            await this.logout();
        });

        play.classList.add('nav-item');
        play.appendChild(play_link);
        play_link.href = '/kartfever/game';
        play_link.innerHTML = 'Play';
        play_link.classList.add('nav-link');

        console.log(await oauth);
        if (await oauth == 200) {
            // 1. First, let's modify your code to add some debugging and styles
            const avatar = document.createElement('div');
            avatar.innerHTML = `
            <div class="account-menu-wrapper">
                <button id="avatar-btn" class="avatar-btn">
                <img 
                    src="https://localhost:3000/src/user.svg" 
                    alt="User avatar" 
                    class="avatar-img"
                    onerror="console.error('Failed to load SVG:', this.src)"
                    onload="console.log('SVG loaded successfully')"
                >
                </button>
            </div>
            `;
            avatar.addEventListener('click', (_ev) => {
                document.location.pathname = '/account';
            });

            const headerAuth = document.querySelector('.header-auth');
            headerAuth.appendChild(logout);
            headerAuth.appendChild(avatar);
            console.log('Oauth : Already Logged in !');

            const navbar = document.querySelector('.nav-items');
            navbar.appendChild(play);
        } else if (await oauth == 401) {
            const headerAuth = document.querySelector('.header-auth');
            headerAuth.appendChild(login);
            headerAuth.appendChild(register);
        }
    }

    async logout() {
        const response = await fetch(`https://localhost:3000/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        if (response.status == 200) {
            document.location.reload();
        }
    }

    bindIFrame(frame, ev) {
        frame.src = `./${ev.target.id}`;
        ev.target.after(this.fr);
        try {
            // Attendre que l'iframe soit complètement chargée
            frame.addEventListener('load', function () {
                // Accéder au document de l'iframe
                const cw = frame.contentWindow.document;
                console.log('Document iframe chargé:', cw);

                // Maintenant que l'iframe est chargée, on peut chercher les éléments
                const password = cw.getElementById('password');
                const loginBtn = cw.getElementById('login-btn');

                // Vérifier que les éléments existent
                if (password && loginBtn) {
                    // Ajouter les écouteurs d'événements
                    password.addEventListener('keyup', function (event) {
                        if (event.key === 'Enter') {
                            handleLogin(cw);
                        }
                    });

                    loginBtn.addEventListener('click', function () {
                        handleLogin(cw);
                    });
                } else {
                    console.error("Éléments non trouvés dans l'iframe");
                }
            });
        } catch (e) {
            console.error('Cannot access iframe content:', e);
        }
    }
}

class ChatComponent extends HTMLElement {
    constructor() {
        super();
        this.isOpen = false;
        this.activeChat = 'general';
        this.chats = {
            general: {
                name: 'General',
                messages: [],
            },
            // Private chats will be loaded dynamically
        };
        this.privateChats = [];
        this.isContextMenuOpened = false;
    }

    async connectedCallback() {
        // Check if user is authenticated
        if (await oauth == 200) {
            this.render();
            await this.initUserData();
            this.setupEventListeners();
            this.loadChats();
            this.initWebsocket();
        }
    }

    render() {
        // Create the chat button
        const chatButton = document.createElement('div');
        chatButton.classList.add('chat-button');
        chatButton.innerHTML = `
            <div class="chat-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
        `;

        // Create the chat interface (initially hidden)
        const chatInterface = document.createElement('div');
        chatInterface.classList.add('chat-interface');
        chatInterface.style.display = 'none';

        chatInterface.innerHTML = `
            <div class="chat-header">
                <h3>KartingFever Chat</h3>
                <button class="close-chat-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="chat-container">
                <div class="chat-sidebar">
                    <div class="chat-rooms">
                        <div class="chat-room active" data-room="general">
                            <span class="room-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="2" y1="12" x2="22" y2="12"></line>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                </svg>
                            </span>
                            <span class="room-name">General</span>
                        </div>
                        <div class="private-chats">
                            <!-- Private chats will be added here dynamically -->
                        </div>
                    </div>
                </div>
                <div class="chat-content">
                    <div class="messages-container" id="general-messages">
                        <!-- Messages will be added here dynamically -->
                        <div class="welcome-message">
                            <p>Welcome to the General Chat! 🏎️</p>
                        </div>
                    </div>
                    <div class="chat-input-container">
                        <input type="text" class="chat-input" placeholder="Type your message...">
                        <button class="send-message-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .chat-button {
                position: fixed;
                bottom: 30px;
                left: 30px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: var(--primary-medium);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 900;
            }
            
            .chat-button:hover {
                transform: scale(1.05);
                background: var(--primary-medium-light);
            }
            
            .chat-icon {
                color: white;
            }
            
            .chat-interface {
                position: fixed;
                bottom: 30px;
                left: 30px;
                width: 800px;
                height: 500px;
                background: var(--dark);
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                z-index: 950;
                border: 1px solid var(--primary-dark);
            }
            
            .chat-header {
                background: var(--primary-dark);
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid var(--accent);
            }
            
            .chat-header h3 {
                margin: 0;
                color: var(--light);
                font-family: 'Russo One', sans-serif;
                letter-spacing: 1px;
            }
            
            .close-chat-btn {
                background: transparent;
                border: none;
                color: var(--light);
                cursor: pointer;
                transition: color 0.2s ease;
            }
            
            .close-chat-btn:hover {
                color: var(--accent);
            }
            
            .chat-container {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            .chat-sidebar {
                width: 220px;
                background: var(--primary-dark);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                padding: 15px 0;
                overflow-y: auto;
            }
            
            .chat-rooms {
                display: flex;
                flex-direction: column;
            }
            
            .chat-room {
                padding: 12px 15px;
                display: flex;
                align-items: center;
                color: var(--light);
                cursor: pointer;
                transition: background 0.2s ease;
                border-left: 3px solid transparent;
            }
            
            .chat-room:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            
            .chat-room.active {
                background: rgba(255, 255, 255, 0.08);
                border-left: 3px solid var(--accent);
            }
            
            .room-icon {
                margin-right: 10px;
                opacity: 0.7;
            }
            
            .private-chats {
                margin-top: 15px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding-top: 15px;
            }
            
            .chat-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: var(--dark);
            }
            
            .messages-container {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }
            
            .welcome-message {
                text-align: center;
                margin: 20px 0;
                color: var(--neutral);
                font-style: italic;
            }
            
            .message {
                margin-bottom: 15px;
                max-width: 80%;
                align-self: flex-start;
            }
            
            .message.outgoing {
                align-self: flex-end;
            }
            
            .message-content {
                background: var(--primary-dark);
                padding: 10px 15px;
                border-radius: 15px;
                color: var(--light);
                position: relative;
            }
            
            .message.outgoing .message-content {
                background: var(--primary-medium-dark);
                color: white;
            }
            
            .message-sender {
                font-size: 0.8rem;
                margin-bottom: 4px;
                color: var(--neutral);
            }
            
            .message-time {
                font-size: 0.7rem;
                color: var(--neutral);
                text-align: right;
                margin-top: 4px;
            }
            
            .chat-input-container {
                padding: 15px;
                display: flex;
                background: var(--primary-dark);
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .chat-input {
                flex: 1;
                padding: 12px 15px;
                border-radius: 8px;
                border: 1px solid var(--primary-dark);
                background: rgba(255, 255, 255, 0.05);
                color: var(--light);
                font-size: 0.9rem;
                transition: all 0.3s ease;
            }
            
            .chat-input:focus {
                border-color: var(--light);
                outline: none;
                box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
            }
            
            .chat-input::placeholder {
                color: rgba(255, 255, 255, 0.3);
            }
            
            .send-message-btn {
                background: var(--primary-medium);
                color: white;
                border: none;
                border-radius: 8px;
                width: 40px;
                height: 40px;
                margin-left: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.3s ease;
            }
            
            .send-message-btn:hover {
                background: var(--primary-medium-light);
            }
            
            /* Responsive design */
            @media (max-width: 900px) {
                .chat-interface {
                    width: 90vw;
                    left: 5vw;
                }
            }
            
            @media (max-width: 600px) {
                .chat-interface {
                    height: 70vh;
                }
                
                .chat-sidebar {
                    width: 150px;
                }
            }
        `;

        // Append elements to the component
        this.appendChild(styleElement);
        this.appendChild(chatButton);
        this.appendChild(chatInterface);
    }

    setupEventListeners() {
        const chatButton = this.querySelector('.chat-button');
        const chatInterface = this.querySelector('.chat-interface');
        const closeBtn = this.querySelector('.close-chat-btn');
        const chatInput = this.querySelector('.chat-input');
        const sendBtn = this.querySelector('.send-message-btn');
        const chatRooms = this.querySelectorAll('.chat-room');

        // Toggle chat interface
        chatButton.addEventListener('click', () => {
            this.toggleChat();
        });

        // Close chat interface
        closeBtn.addEventListener('click', () => {
            this.toggleChat(false);
        });

        // Send message on button click
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Add glow effect when typing
        chatInput.addEventListener('focus', () => {
            chatInput.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.5)';
        });

        chatInput.addEventListener('blur', () => {
            chatInput.style.boxShadow = 'none';
        });

        // Switch between chat rooms
        chatRooms.forEach((room) => {
            room.addEventListener('click', () => {
                this.switchChat(room.dataset.room);
            });
        });

        const messagesContainer = this.querySelector('.chat-content');
        messagesContainer.addEventListener('contextmenu', (e) => {
            const messageElement = e.target.closest('.message');
            if (messageElement) {
                e.preventDefault();
                this.triggerContextMenu(e, messageElement);
            }
        });
    }

    triggerContextMenu(e, messageElement) {
        // Remove any existing context menus
        const existingMenu = document.querySelector('.message-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.classList.add('message-context-menu');

        // Position the menu at the mouse position
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;

        // Add menu items
        contextMenu.innerHTML = `
        <ul>
        <li class="menu-item copy-text">Copy</li>
        <li class="menu-item private-message">Private Message</li>
        <li class="menu-item delete">Delete</li>
        </ul>
    `;

        // Add event listeners for menu items
        contextMenu.querySelector('.copy-text').addEventListener(
            'click',
            () => {
                const messageContent =
                    messageElement.querySelector('.message-content')
                        .textContent;
                navigator.clipboard.writeText(messageContent)
                    .then(() => console.log('Text copied to clipboard'))
                    .catch((err) =>
                        console.error('Failed to copy text: ', err)
                    );
                contextMenu.remove();
            },
        );

        contextMenu.querySelector('.private-message').addEventListener(
            'click',
            () => {
                const sender = messageElement.querySelector('.message-sender')
                    ?.textContent;

                // Don't allow private messaging yourself
                if (!messageElement.classList.contains('outgoing') && sender) {
                    // Find user ID from the message (in a real app, you'd store this in a data attribute)
                    const userId = messageElement.dataset.senderId || sender;

                    // Start or switch to private chat with this user
                    this.startPrivateChat(userId, sender);
                } else {
                    console.log("Can't start private chat with yourself");
                }
                contextMenu.remove();
            },
            // TODO : Add a channel create private channel if not exist;
            // TODO : send private to user
        );

        contextMenu.querySelector('.delete').addEventListener('click', () => {
            // Only enable delete for outgoing messages
            if (messageElement.classList.contains('outgoing')) {
                messageElement.remove();
                // In a real app, you would send a delete request to the server
            } else {
                console.log('Can only delete your own messages');
            }
            contextMenu.remove();
            // TODO : remove message in db
            // TODO : send update to ws
        });

        // Add the menu to the DOM
        document.body.appendChild(contextMenu);

        // Close menu when clicking outside
        const clickOutsideHandler = (event) => {
            if (!contextMenu.contains(event.target)) {
                contextMenu.remove();
                document.removeEventListener('click', clickOutsideHandler);
            }
        };

        // Small delay to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', clickOutsideHandler);
        }, 100);
    }

    // TODO : handle private chat
    startPrivateChat() {
    }

    toggleChat(open = null) {
        const chatButton = this.querySelector('.chat-button');
        const chatInterface = this.querySelector('.chat-interface');

        this.isOpen = open !== null ? open : !this.isOpen;

        if (this.isOpen) {
            chatButton.style.display = 'none';
            chatInterface.style.display = 'flex';
            // Scroll to bottom of active chat
            this.scrollToBottom();
        } else {
            chatButton.style.display = 'flex';
            chatInterface.style.display = 'none';
        }
    }

    switchChat(chatId) {
        this.activeChat = chatId;

        // Update active chat in UI
        const chatRooms = this.querySelectorAll('.chat-room');
        chatRooms.forEach((room) => {
            if (room.dataset.room === chatId) {
                room.classList.add('active');
            } else {
                room.classList.remove('active');
            }
        });

        // Update messages container
        this.updateMessagesDisplay();
    }

    updateMessagesDisplay() {
        const messageContainers = this.querySelectorAll('.messages-container');

        // Hide all message containers
        messageContainers.forEach((container) => {
            container.style.display = 'none';
        });

        // Show active chat messages
        const activeContainer = this.querySelector(
            `#${this.activeChat}-messages`,
        );
        if (activeContainer) {
            activeContainer.style.display = 'flex';
        } else {
            // Create container if it doesn't exist (for private chats)
            this.createMessagesContainer(this.activeChat);
        }

        this.scrollToBottom();
    }

    createMessagesContainer(chatId) {
        const chatContent = this.querySelector('.chat-content');
        const existingContainer = this.querySelector('.messages-container');

        const messagesContainer = document.createElement('div');
        messagesContainer.id = `${chatId}-messages`;
        messagesContainer.classList.add('messages-container');

        // Add welcome message
        const welcomeMessage = document.createElement('div');
        welcomeMessage.classList.add('welcome-message');
        welcomeMessage.innerHTML = `<p>Chat with ${
            this.chats[chatId]?.name || chatId
        }</p>`;
        messagesContainer.appendChild(welcomeMessage);

        // Insert before the chat input container
        chatContent.insertBefore(
            messagesContainer,
            existingContainer.nextSibling,
        );
        existingContainer.style.display = 'none';
    }

    sendMessage() {
        const chatInput = this.querySelector('.chat-input');
        const messageText = chatInput.value.trim();

        if (!messageText) return;

        console.log(this.activeChat);

        // Create message object
        const message = {
            sender: this.userData.id, // In a real app, this would be the user's name
            receiver: this.activeChat == 'general' ? 1 : this.activeChat,
            content: messageText,
            timestamp: new Date(),
            isOutgoing: true,
        };

        // Add message to the active chat
        if (!this.chats[this.activeChat]) {
            this.chats[this.activeChat] = {
                name: this.activeChat,
                messages: [],
            };
        }

        this.chats[this.activeChat].messages.push(message);

        // Add message to UI
        this.addMessageToUI(message);

        // Clear input
        chatInput.value = '';
        chatInput.focus();

        // In a real app, you would send the message to the server here
        //this.mockServerResponse();
        this.ws.send(JSON.stringify({ message: message }));
    }

    addMessageToUI(message) {
        const messagesContainer = this.querySelector(
            `#${this.activeChat}-messages`,
        );

        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (message.isOutgoing) {
            messageElement.classList.add('outgoing');
        }

        const formattedTime = this.formatTime(message.timestamp);

        messageElement.innerHTML = `
            ${
            !message.isOutgoing
                ? `<div class="message-sender">${message.sender}</div>`
                : ''
        }
            <div class="message-content">${message.content}</div>
            <div class="message-time">${formattedTime}</div>
        `;

        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messagesContainer = this.querySelector(
            `#${this.activeChat}-messages`,
        );
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    formatTime(date) {
        //console.log(date);

        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    async loadChats() {
        // In a real app, you would fetch chats from the server
        // This is just a mock implementation
        const data = await fetch(
            'https://localhost:3000/api/messages/conversation/global',
            {
                method: 'GET',
                credentials: 'include',
            },
        ).then(
            async (data) => {
                return await data.json();
            },
        ).then(
            (data) => {
                //console.log(data);
                data.messages.forEach((elt) => {
                    //console.log(elt.sender == this.userData.id);

                    const mes = {
                        sender: elt.sender, // In a real app, this would be the user's name
                        receiver: elt.receiver,
                        content: elt.content,
                        timestamp: new Date(elt.sentAt),
                        isOutgoing: elt.sender == this.userData.id,
                    };
                    this.addMessageToUI(mes);
                });
            },
        );

        // TODO : fetch and add privates chats.
    }

    addPrivateChat(chatId, displayName) {
        // Add to chats object
        this.chats[chatId] = {
            name: displayName,
            messages: [],
        };

        // Add to UI
        const privateChatsContainer = this.querySelector('.private-chats');

        const chatRoom = document.createElement('div');
        chatRoom.classList.add('chat-room');
        chatRoom.dataset.room = chatId;

        chatRoom.innerHTML = `
            <span class="room-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </span>
            <span class="room-name">${displayName}</span>
        `;

        privateChatsContainer.appendChild(chatRoom);

        // Add event listener
        chatRoom.addEventListener('click', () => {
            this.switchChat(chatId);
        });
    }

    initWebsocket() {
        this.activeUsers = [];
        this.ws = new WebSocket('wss://localhost:3000/chat');
        this.activeUsers.push(this.ws);
        this.ws.onopen = (ev) => {
            console.log('chat connected');
        };
        this.ws.onmessage = (ev) => {
            console.log('received message');
            let data = JSON.parse(ev.data);
            console.log(data);
            data = data.message;
            data.isOutgoing = false;
            data.timestamp = new Date(data.timestamp);
            if (data.sender != this.userData.id) {
                this.addMessageToUI(data);
            }
        };
    }

    async initUserData() {
        this.userData = await fetch('https://localhost:3000/api/users/me', {
            method: 'GET',
            credentials: 'include',
        }).then(
            async (ev) => {
                return await ev.json();
            },
        ).then((data) => {
            return data.user;
        });
    }
}

// Define the custom element
customElements.define('chat-component', ChatComponent);
customElements.define('footer-component', Footer);
customElements.define('header-component', Header);

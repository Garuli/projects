// chatId comes from the JSON data block read in main.js (the CSP blocks inline scripts)
const chatId = motionData.chatId;
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const newChatBtn = document.getElementById('newChatBtn');
const chatSendBtn = document.getElementById('chatSendBtn');

function appendMessage(role, content) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = content;

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage(message) {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message');
    }
    return data.reply;
}

if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) {
            return;
        }

        chatInput.value = '';
        appendMessage('user', message);
        chatSendBtn.disabled = true;

        try {
            const reply = await sendMessage(message);
            appendMessage('assistant', reply);
        } catch (error) {
            alert(error.message);
        } finally {
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    });
}

if (newChatBtn) {
    newChatBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'New Chat' })
            });
            const data = await response.json();
            if (!response.ok || !data.id) {
                throw new Error(data.error || 'Failed to create chat');
            }
            window.location.href = `/chat/${data.id}`;
        } catch (error) {
            alert(error.message);
        }
    });
}

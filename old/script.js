// script.js
// ... existing functions ...

// Helper function to get API key storage key and endpoint based on model
function getApiKeyStorageKeyAndEndpoint(selectedModel) {
    let apiKeyStorageKey = 'apiKey_deepseek';
    let endpoint = 'https://api.deepseek.com/chat/completions'; // Default to deepseek

    if (selectedModel.startsWith('qwen') || selectedModel.startsWith('qwq')) {
        apiKeyStorageKey = 'apiKey_qwen';
        endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    } else if (selectedModel.startsWith('deepseek')) {
        apiKeyStorageKey = 'apiKey_deepseek';
        endpoint = 'https://api.deepseek.com/chat/completions';
    } else if (selectedModel.startsWith('hunyuan')) {
        apiKeyStorageKey = 'apiKey_hunyuan';
        endpoint = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
    }

    return { apiKeyStorageKey, endpoint };
}


// 格式化消息文本
function formatMessage(text) {
    if (!text) return '';

    // 处理标题和换行
    let lines = text.split('\n');
    let formattedLines = lines.map(line => {
        // 处理标题（**文本**）
        line = line.replace(/\*\*(.*?)\*\*/g, '<span class="bold-text">$1</span>');
        return line;
    });

    // 将 ### 替换为换行，并确保每个部分都是一个段落
    let processedText = formattedLines.join('\n');
    let sections = processedText
        .split('###')
        .filter(section => section.trim())
        .map(section => {
            // 移除多余的换行和空格
            let lines = section.split('\n').filter(line => line.trim());

            if (lines.length === 0) return '';

            // 处理每个部分
            let result = '';
            let currentIndex = 0;

            while (currentIndex < lines.length) {
                let line = lines[currentIndex].trim();

                // 如果是数字开头（如 "1.")
                if (/^\d+\./.test(line)) {
                    result += `<p class="section-title">${line}</p>`;
                }
                // 如果是小标题（以破折号开头）
                else if (line.startsWith('-')) {
                    result += `<p class="subsection"><span class="bold-text">${line.replace(/^-/, '').trim()}</span></p>`;
                }
                // 如果是正文（包含冒号的行）
                else if (line.includes(':')) {
                    let [subtitle, content] = line.split(':').map(part => part.trim());
                    result += `<p><span class="subtitle">${subtitle}</span>: ${content}</p>`;
                }
                // 普通文本
                else {
                    result += `<p>${line}</p>`;
                }
                currentIndex++;
            }
            return result;
        });

    return sections.join('');
}

// 显示消息
function displayMessage(role, message, messageContentElement = null) {
    const messagesContainer = document.getElementById('messages');
    let messageElement;
    let messageContent;

    if (!messageContentElement) {
        messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;

        const avatar = document.createElement('img');
        if (role === 'user') {
            avatar.src = 'images/yyc.png'; // User avatar remains the same
        } else { // Bot avatar changes based on model
            const selectedModel = document.getElementById('model-selector').value;
            if (selectedModel.startsWith('qwen') || selectedModel.startsWith('qwq')) {
                avatar.src = 'images/qwen.png'; // Avatar for Qwen-Max
            } else if (selectedModel.startsWith('deepseek')) {
                avatar.src = 'images/deepseek.png'; // Avatar for Deepseek
            } else if (selectedModel.startsWith('hunyuan')) {
                avatar.src = 'images/hunyuan.png'; // Avatar for Hunyuan
            }
        }
        // avatar.alt = role === 'user' ? 'User' : 'Bot';

        messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        messageElement.appendChild(avatar);
        messageElement.appendChild(messageContent);
        messagesContainer.appendChild(messageElement);
    } else {
        messageContent = messageContentElement;
        messageElement = messageContentElement.parentElement; // Get the parent message element
    }


    // 用户消息直接显示，机器人消息需要格式化
    messageContent.innerHTML = role === 'user' ? message : formatMessage(message);

    // 平滑滚动到底部
    messageElement.scrollIntoView({ behavior: 'smooth' });
    return messageContent; // Return messageContent for updating in streaming
}

// API Key handling functions
function showApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    modal.style.display = 'flex';
    document.getElementById('apiKeyInput').focus();
}

function hideApiKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    modal.style.display = 'none';
    document.getElementById('apiKeyInput').value = '';
}

function submitApiKey() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    if (apiKey) {
        const selectedModel = document.getElementById('model-selector').value;
        const { apiKeyStorageKey } = getApiKeyStorageKeyAndEndpoint(selectedModel);
        localStorage.setItem(apiKeyStorageKey, apiKey);
        hideApiKeyModal();
        // If there was a pending message, send it now
        if (window.pendingMessage) {
            sendMessage(window.pendingMessage);
            window.pendingMessage = null;
        }
    }
}

// Add event listener for Enter key in API key input
document.getElementById('apiKeyInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        submitApiKey();
    }
});

// A global variable to hold the conversation history
let conversationHistory = [];

// 消息发送的核心函数
function sendMessage(forcedMessage = null) {
    // 获取必要的DOM元素和用户输入
    const inputElement = document.getElementById('chat-input');
    const modelSelector = document.getElementById('model-selector');
    const message = forcedMessage || inputElement.value;
    const selectedModel = modelSelector.value;

    // 验证消息不为空
    if (!message.trim()) return;

    // 获取 API key 和 endpoint
    const { apiKeyStorageKey, endpoint } = getApiKeyStorageKeyAndEndpoint(selectedModel);
    const apiKey = localStorage.getItem(apiKeyStorageKey);


    if (!apiKey) {
        // 如果没有 API key，保存当前消息并显示输入框
        window.pendingMessage = message;
        showApiKeyModal();
        return;
    }

    // 如果不是强制消息，清空输入框
    if (!forcedMessage) {
        inputElement.value = '';
    }

    // 显示用户消息
    displayMessage('user', message);

    // 更新 conversationHistory
    conversationHistory.push({ role: 'user', content: message });

    // 显示加载动画
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }

    // 准备 API 请求的消息数组
    const messages = [
        { role: "system", content: "You are a helpful assistant." },
        ...conversationHistory
    ];

    // 创建机器人回复的消息容器 (Now using displayMessage to create it)
    let botMessageContentElement = displayMessage('bot', ''); // Create bot message container and get content element
    const reasoningElement = document.createElement('div');
    reasoningElement.className = 'reasoning-content';
    const contentElement = document.createElement('div');
    contentElement.className = 'final-content';
    botMessageContentElement.appendChild(reasoningElement);
    botMessageContentElement.appendChild(contentElement);


    const messagesContainer = document.getElementById('messages');
    // 初始滚动到底部
    scrollToBottom(messagesContainer, false);

    // 用于存储消息内容
    let reasoningContent = '';
    let finalContent = '';
    let botResponseMessage = ''; // 用于累积机器人的完整回复

    // 创建防抖滚动函数
    let scrollTimeout;
    const debouncedScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            scrollToBottom(messagesContainer);
        }, 100);
    };
    console.log(messages)

    // 发起 API 请求
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model: selectedModel, messages: messages, stream: true })
    })
        .then(response => {
            // 检查响应状态
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 创建流式读取器
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // 处理流式响应
            return new ReadableStream({
                start(controller) {
                    function push() {
                        reader.read().then(({ done, value }) => {
                            if (done) {
                                controller.close();
                                // 确保最后一次滚动到底部
                                setTimeout(() => scrollToBottom(messagesContainer), 100);
                                // 将机器人的完整回复添加到 conversationHistory
                                conversationHistory.push({ role: 'assistant', content: botResponseMessage });
                                return;
                            }

                            // 解码并处理数据块
                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n');

                            lines.forEach(line => {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        if (data.choices && data.choices.length > 0) {
                                            const delta = data.choices[0].delta;

                                            // 处理推理内容
                                            if (delta.reasoning_content) {
                                                reasoningContent += delta.reasoning_content;
                                                reasoningElement.innerHTML = formatMessage(reasoningContent);
                                                debouncedScroll();
                                            }
                                            // 处理最终内容
                                            else if (delta.content) {
                                                finalContent += delta.content;
                                                botResponseMessage += delta.content; // 累积机器人回复
                                                contentElement.innerHTML = formatMessage(finalContent);
                                                debouncedScroll();
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Error parsing chunk:', e);
                                    }
                                }
                            });

                            controller.enqueue(value);
                            push();
                        });
                    }
                    push();
                }
            });
        })
        .then(() => {
            // 请求完成后，隐藏加载动画
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        })
        .catch(error => {
            // 错误处理
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }

            if (error.message.includes('401')) {
                // API key 无效的情况
                const selectedModel = document.getElementById('model-selector').value;
                const { apiKeyStorageKey } = getApiKeyStorageKeyAndEndpoint(selectedModel);
                localStorage.removeItem(apiKeyStorageKey);
                contentElement.innerHTML = formatMessage('API Key无效，请重新输入');
                window.pendingMessage = message;
                showApiKeyModal();
            } else {
                // 其他错误情况
                contentElement.innerHTML = formatMessage('出错了，请稍后再试。错误信息: ' + error.message);
            }
            console.error('Error:', error);
        });
}
// Keep your existing event listeners and other functions...

// Load saved API key on page load
document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.querySelector('.messages');
    if (messagesContainer) {
        scrollToBottom(messagesContainer, false);
    }

    updateApiKeyStatus();
    // 点击模态框外部关闭
    window.onclick = function (event) {
        const modal = document.getElementById('apiKeyManager');
        if (event.target === modal) {
            hideApiKeyManager();
        }
    };

    // Previous DOMContentLoaded handlers
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.querySelector('.chat-container').classList.add('dark-mode');
        document.querySelector('.messages').classList.add('dark-mode');
        document.querySelector('.settings-bar').classList.add('dark-mode');
        document.getElementById('themeToggle').checked = true;
    }

    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel) {
        document.getElementById('model-selector').value = savedModel;
    }
});


// 添加下拉菜单功能
function toggleDropdown(event) {
    event.preventDefault();
    document.getElementById('dropdownMenu').classList.toggle('show');
}

// API Key 管理功能
function showApiKeyManager() {
    const modal = document.getElementById('apiKeyManager');
    modal.style.display = 'flex';
    updateAllApiKeyStatuses();
}

function hideApiKeyManager() {
    const modal = document.getElementById('apiKeyManager');
    modal.style.display = 'none';
}

function saveConversation() {
    if (conversationHistory.length === 0) {
        alert('当前没有可保存的对话');
        return;
    }

    // 创建对话内容
    let content = '聊天记录\n\n';
    content += `保存时间: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `使用模型: ${document.getElementById('model-selector').value}\n\n`;
    content += '对话内容:\n';
    content += '----------------------------------------\n\n';

    conversationHistory.forEach((message, index) => {
        const role = message.role === 'user' ? '用户' : 'AI';
        content += `${role}:\n${message.content}\n\n`;
    });

    // 创建 Blob 对象
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chat_history_${timestamp}.txt`;
    
    // 创建下载链接并触发下载
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    
    // 将链接添加到文档中并点击
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function updateAllApiKeyStatuses() {
    // Deepseek
    const deepseekKey = localStorage.getItem('apiKey_deepseek');
    const deepseekStatus = document.getElementById('deepseek-key-status');
    if (deepseekKey) {
        deepseekStatus.textContent = '已设置';
        deepseekStatus.style.color = '#28a745';
    } else {
        deepseekStatus.textContent = '未设置';
        deepseekStatus.style.color = '#dc3545';
    }
    
    // Qwen
    const qwenKey = localStorage.getItem('apiKey_qwen');
    const qwenStatus = document.getElementById('qwen-key-status');
    if (qwenKey) {
        qwenStatus.textContent = '已设置';
        qwenStatus.style.color = '#28a745';
    } else {
        qwenStatus.textContent = '未设置';
        qwenStatus.style.color = '#dc3545';
    }
    
    // Hunyuan
    const hunyuanKey = localStorage.getItem('apiKey_hunyuan');
    const hunyuanStatus = document.getElementById('hunyuan-key-status');
    if (hunyuanKey) {
        hunyuanStatus.textContent = '已设置';
        hunyuanStatus.style.color = '#28a745';
    } else {
        hunyuanStatus.textContent = '未设置';
        hunyuanStatus.style.color = '#dc3545';
    }
    
    // Update the main API key status button
    updateApiKeyStatus();
}
function toggleKeyVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '👁️‍🗨️';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('modalVisibilityIcon');

    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '👁️‍🗨️';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

// Update a specific API key
function updateApiKey(provider) {
    let inputId, storageKey;
    
    switch(provider) {
        case 'deepseek':
            inputId = 'deepseek-key-input';
            storageKey = 'apiKey_deepseek';
            break;
        case 'qwen':
            inputId = 'qwen-key-input';
            storageKey = 'apiKey_qwen';
            break;
        case 'hunyuan':
            inputId = 'hunyuan-key-input';
            storageKey = 'apiKey_hunyuan';
            break;
        default:
            return;
    }
    
    const input = document.getElementById(inputId);
    const apiKey = input.value.trim();
    
    if (apiKey) {
        localStorage.setItem(storageKey, apiKey);
        input.value = '';
        
        // Update status displays
        updateAllApiKeyStatuses();
        
        // Flash success message
        const statusId = `${provider}-key-status`;
        const statusElement = document.getElementById(statusId);
        const originalText = statusElement.textContent;
        const originalColor = statusElement.style.color;
        
        statusElement.textContent = '更新成功！';
        statusElement.style.color = '#28a745';
        
        setTimeout(() => {
            statusElement.textContent = '已设置';
            statusElement.style.color = '#28a745';
        }, 1000);
    } else {
        alert('请输入有效的 API Key');
    }
}

// Remove a specific API key
function removeApiKey(provider) {
    let storageKey;
    
    switch(provider) {
        case 'deepseek':
            storageKey = 'apiKey_deepseek';
            break;
        case 'qwen':
            storageKey = 'apiKey_qwen';
            break;
        case 'hunyuan':
            storageKey = 'apiKey_hunyuan';
            break;
        default:
            return;
    }
    
    if (confirm(`确定要删除 ${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key 吗？`)) {
        localStorage.removeItem(storageKey);
        
        // Clear the input field if it has content
        const inputId = `${provider}-key-input`;
        document.getElementById(inputId).value = '';
        
        // Update all status displays
        updateAllApiKeyStatuses();
        
        // Flash removed message
        const statusId = `${provider}-key-status`;
        const statusElement = document.getElementById(statusId);
        
        statusElement.textContent = '已删除';
        statusElement.style.color = '#dc3545';
    }
}

// 主题切换功能
function toggleTheme() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode');
    document.querySelector('.chat-container').classList.toggle('dark-mode');
    document.querySelector('.messages').classList.toggle('dark-mode');
    document.querySelector('.settings-bar').classList.toggle('dark-mode');

    // 更新复选框状态
    document.getElementById('themeToggle').checked = !isDarkMode;

    // 保存主题设置
    localStorage.setItem('darkMode', !isDarkMode);
}

// 添加一个新的函数来处理平滑滚动
function scrollToBottom(element, smooth = true) {
    // 获取消息容器
    const container = document.querySelector('.messages');
    if (!container) return;

    // 计算需要滚动的位置
    const scrollTop = container.scrollHeight - container.clientHeight;

    // 使用平滑滚动或即时滚动
    container.scrollTo({
        top: scrollTop,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

// 点击其他地方关闭下拉菜单
window.onclick = function (event) {
    if (!event.target.matches('.dropdown button')) {
        const dropdowns = document.getElementsByClassName('dropdown-content');
        for (const dropdown of dropdowns) {
            if (dropdown.classList.contains('show')) {
                dropdown.classList.remove('show');
            }
        }
    }
}

// 保存选择的模型
document.getElementById('model-selector').addEventListener('change', function (event) {
    localStorage.setItem('selectedModel', event.target.value);
    updateApiKeyStatus(); // Update API key status when model changes
});

// 添加回车发送功能
document.getElementById('chat-input').addEventListener('keypress', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
